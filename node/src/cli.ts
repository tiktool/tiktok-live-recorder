#!/usr/bin/env node
/**
 * tiktok-live-recorder CLI.
 *
 * Usage:
 *   tiktok-live-recorder <username> [--out file.mp4] [--quality origin] [--max 3600] [--verbose]
 */
import { TikTokLiveRecorder, StreamOfflineError, FfmpegMissingError, Quality, Container } from './index.js';
import * as readline from 'readline';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.tiktok-live-events');
const KEY_FILE = join(CONFIG_DIR, 'api-key');

function loadStoredKey(): string {
    try {
        if (existsSync(KEY_FILE)) return readFileSync(KEY_FILE, 'utf-8').trim();
    } catch { }
    return '';
}

function saveKey(key: string): void {
    try {
        if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
        writeFileSync(KEY_FILE, key, { mode: 0o600 });
    } catch { }
}

function promptKey(message: string): Promise<string> {
    return new Promise((resolveP) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        console.log('');
        console.log(`[limit]   ${message}`);
        rl.question('[recorder] Paste your API key (or press Enter to quit): ', (answer) => {
            rl.close();
            resolveP((answer || '').trim());
        });
    });
}

function isRateLimit(e: any): boolean {
    const m = (e?.message || '').toLowerCase();
    return m.includes('anonymous') || m.includes('rate-limit') || m.includes('rate limit') || m.includes('cap reached');
}

function parseArgs(argv: string[]) {
    const out: { username?: string; outFile?: string; quality?: Quality; container?: Container; max?: number; verbose?: boolean; apiKey?: string } = {};
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out' || a === '-o') out.outFile = argv[++i];
        else if (a === '--quality' || a === '-q') out.quality = argv[++i] as Quality;
        else if (a === '--container' || a === '-c') out.container = argv[++i] as Container;
        else if (a === '--max') out.max = Number(argv[++i]);
        else if (a === '--verbose' || a === '-v') out.verbose = true;
        else if (a === '--api-key') out.apiKey = argv[++i];
        else if (a === '--help' || a === '-h') { help(); process.exit(0); }
        else if (!out.username) out.username = a;
    }
    return out;
}

function help() {
    console.log(`tiktok-live-recorder <username> [options]

Options:
  -o, --out <file>         Output file (default: <username>-<timestamp>.mp4)
  -q, --quality <q>        origin | FULL_HD1 | HD1 | SD1 | SD2  (default: origin)
  -c, --container <ext>    mp4 | flv | ts | mkv  (default: mp4)
      --max <seconds>      Stop after N seconds
  -v, --verbose            Print ffmpeg output
  -h, --help               Show this help

Examples:
  tiktok-live-recorder streamer
  tiktok-live-recorder streamer --out streamer.mp4 --max 7200
  tiktok-live-recorder streamer -q origin -c flv
`);
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.username) { help(); process.exit(1); }
    let apiKey = args.apiKey || process.env.TIKTOOL_API_KEY || loadStoredKey();
    if (apiKey && !args.apiKey) {
        console.log(`[recorder] using stored API key from ${KEY_FILE}`);
    }
    if (args.apiKey) saveKey(args.apiKey);

    while (true) {
        console.log(`[recorder] resolving @${args.username} ...`);
        const rec = new TikTokLiveRecorder(args.username, { apiKey });
        try {
            const result = await rec.record({
                outFile: args.outFile,
                quality: args.quality,
                container: args.container,
                maxDurationSec: args.max,
                verbose: args.verbose,
                onSegmentStart: (p) => console.log(`[recorder] recording -> ${p}`),
                onSegmentEnd: (p) => console.log(`[recorder] finalised ${p}`),
            });
            console.log(`[recorder] done. duration ${result.durationSec}s, file ${result.outFile}`);
            return;
        } catch (e: any) {
            if (e instanceof StreamOfflineError) {
                console.error(`[recorder] @${args.username} is not currently live.`);
                process.exit(2);
            }
            if (e instanceof FfmpegMissingError) {
                console.error('[recorder] ffmpeg is missing. Install it from https://ffmpeg.org/download.html');
                process.exit(3);
            }
            if (isRateLimit(e)) {
                const newKey = await promptKey(e?.message || 'Anonymous limit reached. Get an API key at https://tik.tools/pricing to lift the cap (7-day free evaluation).');
                if (!newKey) { console.log('[recorder] no key entered. Exiting.'); process.exit(0); }
                apiKey = newKey;
                saveKey(newKey);
                console.log(`[recorder] API key saved to ${KEY_FILE}`);
                continue;
            }
            console.error('[recorder] failed:', e?.message || e);
            process.exit(1);
        }
    }
}

main();
