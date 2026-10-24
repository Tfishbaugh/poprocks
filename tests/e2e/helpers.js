import { execFileSync, spawnSync } from 'node:child_process';
import { expect } from '@playwright/test';

// Counts camera requests and keeps the streams, so tests can check every track stops.
export function watchCamera() {
  window.__camera = { calls: 0, streams: [] };
  const media = navigator.mediaDevices;
  if (!media) return;
  const open = media.getUserMedia.bind(media);
  media.getUserMedia = async (constraints) => {
    window.__camera.calls += 1;
    const stream = await open(constraints);
    window.__camera.streams.push(stream);
    return stream;
  };
}

export const cameraCalls = (page) => page.evaluate(() => window.__camera.calls);

export const liveTracks = (page) => page.evaluate(() => (
  window.__camera.streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length
));

export async function startApp(page) {
  await page.goto('./');
  await page.click('#start-btn');
  await expect(page.locator('#beats')).toBeVisible();
}

export async function openCamera(page) {
  await page.click('#make-video');
  await expect(page.locator('#record')).toBeVisible();
  await expect(page.locator('#rec-btn')).toBeEnabled();
}

// Taps Record, waits out the 3-2-1, films for `seconds`, then stops.
export async function record(page, seconds) {
  await page.click('#rec-btn');
  await expect(page.locator('#rec-btn')).toContainText('Stop', { timeout: 6000 });
  await page.waitForTimeout(seconds * 1000);
  await page.click('#rec-btn');
  await expect(page.locator('#watch')).toBeVisible({ timeout: 10_000 });
}

export async function download(page, testInfo) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.click('#watch-save')]);
  const path = testInfo.outputPath(file.suggestedFilename());
  await file.saveAs(path);
  return { path, name: file.suggestedFilename() };
}

export function probe(path) {
  const json = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name:format=format_name', '-of', 'json', path]);
  const { streams, format } = JSON.parse(json);
  return { format: format.format_name, streams };
}

// The real length, from the packets: MediaRecorder files often have no duration in the header.
export function duration(path) {
  const csv = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'packet=pts_time,duration_time', '-of', 'csv=p=0', path], { maxBuffer: 64 * 1024 * 1024 });
  const ends = String(csv).trim().split('\n').map((line) => line.split(',').map(Number)).map(([pts, dur]) => pts + (dur || 0));
  return Math.max(...ends.filter(Number.isFinite));
}

// Loudest moment of the audio track in dB (about -91 means silence).
export function maxVolume(path) {
  const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  return Number(stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? -Infinity);
}
