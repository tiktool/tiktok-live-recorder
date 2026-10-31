/**
 * tiktok-live-recorder
 *
 * Capture any TikTok LIVE stream to a local MP4 file. One method, one
 * username, one MP4 on your disk. Uses ffmpeg under the hood.
 *
 * @example
 * ```ts
 * import { TikTokLiveRecorder } from 'tiktok-live-recorder';
 *
 * const rec = new TikTokLiveRecorder('streamer');
 * await rec.record({ outFile: 'streamer.mp4' });
 * ```
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';

const STREAM_URL_ENDPOINT = 'https://api.tik.tools/webcast/room_video';

export type Quality = 'origin' | 'FULL_HD1' | 'HD1' | 'SD1' | 'SD2';
export type Container = 'mp4' | 'mkv' | 'flv' | 'ts';

export interface StreamSources {
    /** Whether the user is currently live. */
    live: boolean;
    /** Username (without `@`). */
    uniqueId: string;
    /** Numeric room id. */
    roomId?: string;
    /** Map of quality tag to HLS playlist URL. Best-quality first. */
    hls?: Record<string, string>;
    /** Map of quality tag to FLV URL. */
    flv?: Record<string, string>;
    /** Stream title at time of resolution. */
    title?: string;
}

export interface RecordOptions {
    /** Output file path. Defaults to `<uniqueId>-<timestamp>.mp4`. */
    outFile?: string;
    /** Preferred video quality. Falls back to next available. */
    quality?: Quality;
    /** Container/codec preset. Defaults to `mp4`. */
    container?: Container;
    /** Override ffmpeg binary location. */
    ffmpegPath?: string;
    /** Auto-rotate output files every N seconds. */
    rotateEverySec?: number;
    /** Cap total recording duration in seconds. */
    maxDurationSec?: number;
    /** Print ffmpeg's stderr to console. */
    verbose?: boolean;
    /** Callback fired whenever a new segment file starts. */
    onSegmentStart?: (path: string) => void;
    /** Callback fired whenever a segment file closes. */
    onSegmentEnd?: (path: string) => void;
}

export interface RecorderOptions {
    /** Override the stream-URL resolver endpoint. */
    endpoint?: string;
    /**
     * Your TikTools API key. Get one at https://tik.tools/pricing
     * (7-day free evaluation). Can also be passed via the
     * `TIKTOOL_API_KEY` environment variable.
     */
    apiKey?: string;
}

/** Recorder error thrown when the user is offline. */
export class StreamOfflineError extends Error {
    constructor(public uniqueId: string) {
        super(`@${uniqueId} is not currently live.`);
        this.name = 'StreamOfflineError';
    }
}

/** Recorder error thrown when the server rejects the API key that was sent. */
export class ApiKeyRejectedError extends Error {
    constructor(public reason: string) {
        super(`API key rejected: ${reason}`);
        this.name = 'ApiKeyRejectedError';
    }
}

/** Recorder error thrown when ffmpeg is missing on PATH. */
export class FfmpegMissingError extends Error {
    constructor() {
        super('ffmpeg binary not found on PATH. Install ffmpeg from https://ffmpeg.org/download.html');
        this.name = 'FfmpegMissingError';
    }
}

/**
 * Record a TikTok LIVE stream to disk.
 *
 * @example
 * ```ts
 * import { TikTokLiveRecorder } from 'tiktok-live-recorder';
 *
 * const rec = new TikTokLiveRecorder('streamer');
 * const { outFile } = await rec.record({ quality: 'origin' });
 * console.log('Saved to', outFile);
 * ```
 */
export class TikTokLiveRecorder {
    private readonly uniqueId: string;
    private readonly endpoint: string;
    private readonly apiKey: string;

    constructor(uniqueId: string, options: RecorderOptions = {}) {
        this.uniqueId = (uniqueId || '').replace(/^@/, '').trim();
        if (!this.uniqueId) throw new Error('uniqueId is required.');
        this.endpoint = options.endpoint || STREAM_URL_ENDPOINT;
        // Anonymous mode is supported. Add an API key from
        // https://tik.tools/pricing (7-day free evaluation) to lift the per-IP caps.
        this.apiKey = options.apiKey || process.env.TIKTOOL_API_KEY || '';
    }

    /** Ask the TikTools edge for the current HLS / FLV URLs for this user. */
    async resolve(): Promise<StreamSources> {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (this.apiKey) headers['x-api-key'] = this.apiKey;
        const res = await fetch(this.endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ unique_id: this.uniqueId }),
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => null) as any;
            const serverMsg: string | undefined = errBody?.error;
            if (res.status === 429) {
                throw new Error(serverMsg || 'Anonymous rate-limit reached. Get an API key at https://tik.tools/pricing to lift the cap (7-day free evaluation).');
            }
            if (res.status === 404) return { live: false, uniqueId: this.uniqueId, hls: {}, flv: {} };
            if ((res.status === 401 || res.status === 403) && this.apiKey) throw new ApiKeyRejectedError(serverMsg || `HTTP ${res.status}`);
            throw new Error(`stream_url failed: HTTP ${res.status}${serverMsg ? ` (${serverMsg})` : ''}`);
        }
        const body = (await res.json()) as any;
        if (body && body.status_code === -1 && body.error) throw new Error(`stream_url: ${body.error}`);

        const data = body?.data ?? {};
        const hls: Record<string, string> = {};
        const flv: Record<string, string> = {};
        const su = data.stream_urls || {};
        for (const [q, info] of Object.entries(su as Record<string, any>)) {
            if (info && typeof info === 'object') {
                if (info.flv) flv[q] = info.flv as string;
                if (info.hls) hls[q] = info.hls as string;
            }
        }
        if (data.flvPullUrl && !flv['default']) flv['default'] = data.flvPullUrl as string;
        if (data.hlsPullUrl && !hls['default']) hls['default'] = data.hlsPullUrl as string;

        return {
            live: !!data.alive,
            uniqueId: this.uniqueId,
            roomId: String(data.room_id || ''),
            hls,
            flv,
            title: data.title,
        };
    }

    /**
     * Record the live stream to a file. Resolves when the recording ends
     * (stream went offline, max duration reached, or `stop()` called).
     */
    async record(options: RecordOptions = {}): Promise<{ outFile: string; durationSec: number }> {
        const sources = await this.resolve();
        if (!sources.live) throw new StreamOfflineError(this.uniqueId);

        const quality = options.quality || 'origin';
        const inputUrl = pickInput(sources, quality);
        if (!inputUrl) throw new Error(`No stream URL available for quality "${quality}".`);

        const container = options.container || 'mp4';
        const outFile = resolve(options.outFile || defaultOutName(this.uniqueId, container));
        const outDir = dirname(outFile);
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

        const ffmpeg = options.ffmpegPath || 'ffmpeg';
        const args = buildFfmpegArgs(inputUrl, outFile, container);
        if (options.verbose) args.unshift('-stats');

        const before = fileStamp(outFile);
        const startedAt = Date.now();
        let child: ChildProcess | null = null;

        // Use 'q' on stdin as ffmpeg's clean-shutdown signal so the mp4
        // moov atom gets written. SIGINT alone can leave an unfinalised
        // file. We force-kill 10s later if ffmpeg ignores the quit.
        const cleanQuit = () => {
            try { child?.stdin?.write('q\n'); } catch {}
            setTimeout(() => { try { child?.kill('SIGTERM'); } catch {} }, 10_000).unref();
        };

        const promise = new Promise<{ outFile: string; durationSec: number }>((resolveP, rejectP) => {
            try {
                // Undrained pipes fill up on long recordings and stall ffmpeg.
                child = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', options.verbose ? 'pipe' : 'ignore'] });
            } catch (e: any) {
                if (e?.code === 'ENOENT') return rejectP(new FfmpegMissingError());
                return rejectP(e);
            }

            const proc = child!;
            options.onSegmentStart?.(outFile);

            if (options.verbose) {
                proc.stderr?.on('data', (b) => process.stderr.write(b));
            }
            proc.on('error', (e: any) => {
                if (e?.code === 'ENOENT') rejectP(new FfmpegMissingError());
                else rejectP(e);
            });
            proc.on('close', (code) => {
                if (code !== 0 && code !== null && !wroteMedia(outFile, before)) {
                    return rejectP(new Error(`ffmpeg exited with code ${code} before recording any media (enable verbose output to see the ffmpeg error).`));
                }
                options.onSegmentEnd?.(outFile);
                resolveP({ outFile, durationSec: Math.round((Date.now() - startedAt) / 1000) });
            });

            if (options.maxDurationSec && options.maxDurationSec > 0) {
                setTimeout(cleanQuit, options.maxDurationSec * 1000);
            }
        });

        // SIGINT cleanup so Ctrl+C still finalises the mp4.
        const onSigint = () => cleanQuit();
        process.once('SIGINT', onSigint);
        try { return await promise; } finally { process.off('SIGINT', onSigint); }
    }
}

function pickInput(sources: StreamSources, preferred: Quality): string | null {
    const order: string[] = [preferred, 'origin', 'FULL_HD1', 'HD1', 'hd', 'SD1', 'ld', 'SD2', 'ao', 'default'];
    // FLV first: it is the primary pull format and stays reachable when the
    // HLS edge for a stream does not answer.
    for (const q of order) {
        if (sources.flv?.[q]) return sources.flv[q];
        if (sources.hls?.[q]) return sources.hls[q];
    }
    const anyFlv = sources.flv ? Object.values(sources.flv).find(Boolean) : undefined;
    if (anyFlv) return anyFlv;
    const anyHls = sources.hls ? Object.values(sources.hls).find(Boolean) : undefined;
    return anyHls ?? null;
}

// Container headers alone are about 1-2 KB; anything below this holds no media.
const MIN_MEDIA_BYTES = 16 * 1024;

function fileStamp(path: string): string | null {
    try { const st = statSync(path); return `${st.size}:${st.mtimeMs}`; } catch { return null; }
}

function wroteMedia(path: string, before: string | null): boolean {
    const after = fileStamp(path);
    if (after === null || after === before) return false;
    try { return statSync(path).size >= MIN_MEDIA_BYTES; } catch { return false; }
}

function buildFfmpegArgs(input: string, outFile: string, container: Container): string[] {
    const base = ['-hide_banner', '-loglevel', 'warning', '-y', '-i', input];
    if (container === 'flv' || container === 'ts') {
        // Remux only - keep original codecs.
        base.push('-c', 'copy', outFile);
    } else if (container === 'mp4') {
        // Fragmented MP4 writes its index up front, so the file stays playable
        // even when ffmpeg is killed (window closed, crash, power loss).
        base.push('-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', outFile);
    } else {
        base.push('-c', 'copy', outFile);
    }
    return base;
}

function defaultOutName(uniqueId: string, container: Container): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${uniqueId}-${ts}.${container}`;
}

export default TikTokLiveRecorder;
