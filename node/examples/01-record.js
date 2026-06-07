// Record a stream by username. Saves to <username>-<ISO>.mp4.
// Run: USERNAME=streamername node 01-record.js
import { TikTokLiveRecorder } from 'tiktok-live-recorder';

const rec = new TikTokLiveRecorder(process.env.USERNAME || 'tiktokuser');
const { outFile, durationSec } = await rec.record({ quality: 'origin' });
console.log(`saved ${outFile} (${durationSec}s)`);
