import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_VIDEO_NOTE, WEBM_NOTE, cameraError, canRecord, pickFormat } from '../../js/recorder.js';

// What each browser's MediaRecorder.isTypeSupported says yes to.
const BROWSERS = {
  safari: (type) => type.startsWith('video/mp4'),
  safariWithWebm: (type) => type.startsWith('video/mp4') || type.startsWith('video/webm'),
  oldSafari: (type) => type === 'video/mp4',
  safariNoAac: (type) => type === 'video/mp4' || type === 'video/mp4;codecs=avc1',
  chrome: (type) => type.startsWith('video/mp4') || type.startsWith('video/webm'),
  chromiumNoH264: (type) => type.startsWith('video/webm') || type === 'video/mp4' || type.includes('vp9'),
  oldChrome: (type) => type.startsWith('video/webm'),
  firefox: (type) => type === 'video/webm' || type === 'video/webm;codecs=vp8,opus',
  none: () => false,
};

const recorderFor = (name) => ({ isTypeSupported: BROWSERS[name] });

test('Safari records MP4', () => {
  const format = pickFormat(recorderFor('safari'));
  assert.equal(format.ext, 'mp4');
  assert.equal(format.type, 'video/mp4');
  assert.equal(format.note, '');
});

test('every Safari records MP4, even with WebM support or no codec strings', () => {
  ['safariWithWebm', 'oldSafari', 'safariNoAac'].forEach((name) => {
    const format = pickFormat(recorderFor(name));
    assert.equal(format.ext, 'mp4', name);
    assert.equal(format.type, 'video/mp4', name);
    assert.equal(format.note, '', name);
  });
  assert.equal(pickFormat(recorderFor('safariNoAac')).mimeType, 'video/mp4;codecs=avc1');
});

test('Chromium without H.264 records honest WebM, not VP9 hidden in an MP4', () => {
  const format = pickFormat(recorderFor('chromiumNoH264'));
  assert.equal(format.mimeType, 'video/webm;codecs=vp9,opus');
  assert.equal(format.ext, 'webm');
});

test('recent Chrome records MP4 with H.264 and AAC', () => {
  const format = pickFormat(recorderFor('chrome'));
  assert.equal(format.mimeType, 'video/mp4;codecs=avc1,mp4a.40.2');
  assert.equal(format.ext, 'mp4');
  assert.equal(format.type, 'video/mp4');
});

test('older Chrome records WebM with VP9 and says so', () => {
  const format = pickFormat(recorderFor('oldChrome'));
  assert.equal(format.mimeType, 'video/webm;codecs=vp9,opus');
  assert.equal(format.ext, 'webm');
  assert.equal(format.type, 'video/webm');
  assert.equal(format.note, WEBM_NOTE);
});

test('Firefox records WebM with VP8', () => {
  const format = pickFormat(recorderFor('firefox'));
  assert.equal(format.mimeType, 'video/webm;codecs=vp8,opus');
  assert.equal(format.ext, 'webm');
  assert.equal(format.note, WEBM_NOTE);
});

test('a browser with no video support gets no format', () => {
  assert.equal(pickFormat(recorderFor('none')), null);
  assert.equal(pickFormat(undefined), null);
  assert.equal(pickFormat({}), null);
  assert.match(NO_VIDEO_NOTE, /Beats still do/);
});

function env({ recorder = recorderFor('chrome'), gum = true, mix = true } = {}) {
  const AudioContext = function AudioContext() {};
  if (mix) AudioContext.prototype.createMediaStreamDestination = () => {};
  return {
    MediaRecorder: recorder,
    AudioContext,
    navigator: { mediaDevices: gum ? { getUserMedia: () => {} } : undefined },
  };
}

test('canRecord needs a format, the camera API and audio mixing', () => {
  assert.equal(canRecord(env()), true);
  assert.equal(canRecord(env({ recorder: null })), false);
  assert.equal(canRecord(env({ recorder: recorderFor('none') })), false);
  assert.equal(canRecord(env({ gum: false })), false, 'no camera API (plain http or old browser)');
  assert.equal(canRecord(env({ mix: false })), false);
});

test('camera errors get kid-friendly messages', () => {
  assert.match(cameraError({ name: 'NotAllowedError' }), /grown-up/);
  assert.match(cameraError({ name: 'NotFoundError' }), /No camera/);
  assert.match(cameraError(new Error('boom')), /Try again/);
  assert.match(cameraError(undefined), /Try again/);
});
