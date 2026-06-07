// Poll a creator every 30s. When live, record. When offline, wait.
// Run: USERNAME=streamername node 02-watch-and-record.js
import { TikTokLiveRecorder, StreamOfflineError } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder(process.env.USERNAME || 'tiktokuser');

while (true) {
    try {
        console.log(`[${new Date().toISOString()}] checking...`);
        const { outFile, durationSec } = await rec.record();
        console.log(`captured ${outFile} (${durationSec}s)`);
    } catch (e) {
        if (e instanceof StreamOfflineError) console.log('offline, retry in 30s');
        else throw e;
    }
    await new Promise(r => setTimeout(r, 30_000));
}
