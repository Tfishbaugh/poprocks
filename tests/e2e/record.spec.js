// Recording with Chromium's fake camera and mic, checked with ffprobe.
// The fake mic beeps, so turning it off proves which sound comes from where.

import { test, expect } from '@playwright/test';
import { download, duration, maxVolume, openCamera, probe, record, startApp } from './helpers.js';

const SILENT = -60;

test('a 3 s video has picture, sound and the beat in it', async ({ page }, testInfo) => {
  await startApp(page);
  await page.click('#surprise');
  await openCamera(page);
  await page.click('#mic');
  await expect(page.locator('#mic')).toContainText('Mic off');

  await page.click('#rec-btn');
  await expect(page.locator('#countdown')).toHaveText('3');
  await expect(page.locator('#countdown')).toHaveText('2');
  await expect(page.locator('#countdown')).toHaveText('1');
  await expect(page.locator('#rec-btn')).toContainText('Stop');
  await expect(page.locator('#rec-time')).toContainText('left');
  await page.waitForTimeout(3000);
  await page.click('#rec-btn');
  await expect(page.locator('#watch')).toBeVisible();

  const { path, name } = await download(page, testInfo);
  const { format, streams } = probe(path);
  const kinds = streams.map((s) => s.codec_type).sort();
  expect(kinds).toEqual(['audio', 'video']);
  expect(name).toMatch(/^PopRocks-\d{4}-\d{2}-\d{2}-\d{4}\.(mp4|webm)$/);
  expect(format).toMatch(name.endsWith('.mp4') ? /mp4/ : /webm/);
  const video = streams.find((s) => s.codec_type === 'video').codec_name;
  expect(name.endsWith('.mp4') ? ['h264'] : ['vp8', 'vp9'], 'MP4 only ever holds H.264').toContain(video);
  const length = duration(path);
  expect(length).toBeGreaterThan(2.5);
  expect(length).toBeLessThan(4.5);
  expect(maxVolume(path), 'the beat is in the video').toBeGreaterThan(-30);
  testInfo.annotations.push({ type: 'video', description: `${name}: ${streams.map((s) => s.codec_name).join(' + ')}, ${length.toFixed(2)} s` });
});

test('the mic is mixed in, and the 🎤 off button really mutes it', async ({ page }, testInfo) => {
  await startApp(page);
  await page.click('#clear');
  await openCamera(page);
  await expect(page.locator('#mic')).toContainText('Mic on');
  await record(page, 2);
  const withMic = maxVolume((await download(page, testInfo)).path);

  await page.click('#watch-again');
  await expect(page.locator('#rec-btn')).toBeEnabled();
  await page.click('#mic');
  await record(page, 2);
  const muted = maxVolume((await download(page, testInfo)).path);

  expect(withMic, 'mic on, no beat: the voice is there').toBeGreaterThan(-30);
  expect(muted, 'mic off, no beat: silence').toBeLessThan(SILENT);
});

test('videos stop by themselves at 2 minutes', async ({ page }) => {
  await page.clock.install();
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await page.clock.runFor(3100);
  await expect(page.locator('#rec-btn')).toContainText('Stop');
  await page.waitForTimeout(1500); // real time, so the recorder has frames to save
  await page.clock.fastForward(115_000);
  await expect(page.locator('#rec-btn')).toContainText('Stop');
  await page.clock.fastForward(5_000);
  await expect(page.locator('#watch')).toBeVisible();
});

test('🗑 deletes the video, and Undo brings it back', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await record(page, 1);
  await page.click('#watch-delete');
  await expect(page.locator('#beats')).toBeVisible();
  await expect(page.locator('#last-video')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Video deleted');
  await page.click('#toast-action');
  await expect(page.locator('#watch')).toBeVisible();
  const playable = await page.locator('#playback').evaluate((v) => v.src.startsWith('blob:'));
  expect(playable).toBe(true);
});

test('← keeps the video, and 🎬 My video opens it again', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await record(page, 1);
  await page.click('#watch-back');
  await expect(page.locator('#beats')).toBeVisible();
  await page.click('#last-video');
  await expect(page.locator('#watch')).toBeVisible();
});

test('a browser that cannot record says so without asking for the camera', async ({ page }) => {
  await page.addInitScript(() => { delete window.MediaRecorder; });
  await startApp(page);
  await page.click('#make-video');
  await expect(page.locator('#rec-msg')).toContainText('Beats still do');
  await expect(page.locator('#rec-btn')).toBeDisabled();
});

test('on a phone, More shows a dot while a video waits under it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await expect(page.locator('#more')).not.toHaveClass(/has-video/);
  await openCamera(page);
  await record(page, 1);
  await page.click('#watch-back');
  await expect(page.locator('#more')).toHaveClass(/has-video/);
  await page.click('#more');
  await page.click('#last-video');
  await page.click('#watch-delete');
  await expect(page.locator('#more')).not.toHaveClass(/has-video/);
});

test('if filming fails to start, the kid sees why and can try again', async ({ page }) => {
  await page.addInitScript(() => {
    const Real = window.MediaRecorder;
    window.MediaRecorder = class extends Real {
      constructor() {
        throw new DOMException('no', 'NotSupportedError');
      }
    };
  });
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await expect(page.locator('#rec-msg')).toContainText('Try again', { timeout: 6000 });
  await expect(page.locator('#rec-btn')).toBeEnabled();
  await expect(page.locator('#rec-btn')).toContainText('Record');
});

test('🔁 Again stops the old clip, so it can’t play over the new one', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await record(page, 2);
  await page.locator('#playback').evaluate((v) => v.play());
  await expect.poll(() => page.locator('#playback').evaluate((v) => v.paused)).toBe(false);
  await page.click('#watch-again');
  expect(await page.locator('#playback').evaluate((v) => v.paused)).toBe(true);
});

test('Cancel during the 3-2-1 stops it for good', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await expect(page.locator('#countdown')).toHaveText('3');
  await expect(page.locator('#rec-btn')).toContainText('Cancel');
  await page.click('#rec-btn');
  await expect(page.locator('#countdown')).toBeEmpty();
  await page.waitForTimeout(3500);
  await expect(page.locator('#rec-btn')).toContainText('Record');
  await expect(page.locator('#rec-time')).toBeHidden();
  await expect(page.locator('#record')).toBeVisible();
});

test('an empty recording goes back to the beat with an “Oops”', async ({ page }) => {
  await page.addInitScript(() => {
    const Real = window.MediaRecorder;
    window.MediaRecorder = class extends Real {
      addEventListener(type, handler, options) {
        const empty = () => handler({ data: new Blob([]) });
        super.addEventListener(type, type === 'dataavailable' ? empty : handler, options);
      }
    };
  });
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await expect(page.locator('#rec-btn')).toContainText('Stop', { timeout: 6000 });
  await page.waitForTimeout(1000);
  await page.click('#rec-btn');
  await expect(page.locator('#beats')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('Oops');
  await expect(page.locator('#last-video')).toBeHidden();
});

test('a recorder that stops by itself resets everything and keeps the clip', async ({ page }) => {
  await page.addInitScript(() => {
    const Real = window.MediaRecorder;
    window.MediaRecorder = class extends Real {
      start(slice) {
        super.start(slice);
        setTimeout(() => this.stop(), 1500);
      }
    };
  });
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await expect(page.locator('#watch')).toBeVisible({ timeout: 8000 });
  await page.click('#watch-back');
  await expect(page.locator('#play')).toContainText('Play');
  await page.waitForTimeout(300);
  await expect(page.locator('.pad.now')).toHaveCount(0);
  await openCamera(page);
  await expect(page.locator('#rec-btn')).toContainText('Record');
});

test('if mixing the sound fails, the kid sees why and nothing is left half-open', async ({ page }) => {
  await page.addInitScript(() => {
    AudioContext.prototype.createMediaStreamSource = () => { throw new DOMException('no', 'NotSupportedError'); };
  });
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await expect(page.locator('#rec-msg')).toContainText('Try again', { timeout: 6000 });
  await expect(page.locator('#rec-btn')).toContainText('Record');
});
