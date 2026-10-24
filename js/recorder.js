// Picks a video format, opens the camera and records camera + beat + mic.

export const MAX_SECONDS = 120;

// H.264 MP4 first: Photos and Gallery play it everywhere. Plain 'video/mp4' comes last,
// because a browser without H.264 fills it with VP9, which galleries may not play.
const FORMATS = [
  { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mimeType: 'video/webm', ext: 'webm' },
  { mimeType: 'video/mp4', ext: 'mp4' },
];

export const WEBM_NOTE = 'This video is a WebM file. Some photo apps can’t play it, but browsers and computers can.';
export const NO_VIDEO_NOTE = 'Videos don’t work in this browser yet. Beats still do!';

// MP4 where the browser can (Safari, recent Chrome), WebM otherwise, null if neither.
export function pickFormat(Recorder = globalThis.MediaRecorder) {
  if (typeof Recorder?.isTypeSupported !== 'function') return null;
  const format = FORMATS.find(({ mimeType }) => Recorder.isTypeSupported(mimeType));
  if (!format) return null;
  return { ...format, type: format.mimeType.split(';')[0], note: format.ext === 'webm' ? WEBM_NOTE : '' };
}

export function canRecord(env = globalThis) {
  const AudioCtx = env.AudioContext ?? env.webkitAudioContext;
  return Boolean(
    pickFormat(env.MediaRecorder) &&
      env.navigator?.mediaDevices?.getUserMedia &&
      AudioCtx?.prototype?.createMediaStreamDestination,
  );
}

const NICE = {
  video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};
const PLAIN = { video: { facingMode: 'user' }, audio: true };

// Tries the nicest settings, then the plainest. A "no" from the person is final.
export async function openCamera(mediaDevices = navigator.mediaDevices) {
  try {
    return await mediaDevices.getUserMedia(NICE);
  } catch (error) {
    if (error?.name === 'NotAllowedError') throw error;
    return mediaDevices.getUserMedia(PLAIN);
  }
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

const CAMERA_ERRORS = {
  NotAllowedError: 'The camera is turned off for PopRocks. A grown-up can turn it on in Settings.',
  SecurityError: 'The camera is turned off for PopRocks. A grown-up can turn it on in Settings.',
  NotFoundError: 'No camera found on this device.',
  OverconstrainedError: 'No camera found on this device.',
  NotReadableError: 'Another app is using the camera. Close it, then try again.',
  AbortError: 'Another app is using the camera. Close it, then try again.',
};

export function cameraError(error) {
  return CAMERA_ERRORS[error?.name] ?? 'The camera didn’t start. Try again.';
}

// Mixes the beat and the mic into one audio track next to the camera's video.
export function createMix(engine, camera) {
  const { ctx } = engine;
  const micTracks = camera.getAudioTracks();
  // Made first: it can throw, and then nothing is left connected.
  const source = micTracks.length ? ctx.createMediaStreamSource(new MediaStream(micTracks)) : null;
  const dest = ctx.createMediaStreamDestination();
  const mic = ctx.createGain();
  engine.output.connect(dest);
  mic.connect(dest);
  source?.connect(mic);
  return {
    stream: new MediaStream([...camera.getVideoTracks(), ...dest.stream.getAudioTracks()]),
    setMic(on) {
      mic.gain.value = on ? 1 : 0;
    },
    close() {
      engine.output.disconnect(dest);
      source?.disconnect();
      mic.disconnect();
    },
  };
}

export function startRecorder(stream, format, onDone) {
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 2_500_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.addEventListener('stop', () => onDone(new Blob(chunks, { type: format.type })));
  recorder.start(1000);
  return recorder;
}
