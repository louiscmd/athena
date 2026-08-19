// ElevenLabs TTS — web only
// Fetches audio from ElevenLabs, plays it via WebAudio, and streams amplitude to caller.

const API = 'https://api.elevenlabs.io/v1';

let audioCtx: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let animHandle: number | null = null;
let _isSpeaking = false;

function ctx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * Speak text via ElevenLabs.
 * Calls onAmplitude (0–1) every animation frame while audio plays.
 * Calls onDone when audio ends or is stopped.
 */
export async function elevenLabsSpeak(
  text:      string,
  apiKey:    string,
  voiceId:   string,
  onAmplitude: (v: number) => void,
  onDone:    () => void,
): Promise<void> {
  stopElevenLabs();

  const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.15, use_speaker_boost: true },
    }),
  });

  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);

  const ab    = await res.arrayBuffer();
  const ac    = ctx();
  const buf   = await ac.decodeAudioData(ab);

  const analyser = ac.createAnalyser();
  analyser.fftSize = 256;
  analyserNode = analyser;

  const source = ac.createBufferSource();
  source.buffer = buf;
  source.connect(analyser);
  analyser.connect(ac.destination);
  sourceNode = source;
  _isSpeaking = true;

  // Amplitude polling
  const data = new Uint8Array(analyser.frequencyBinCount);
  function poll() {
    if (!analyserNode) return;
    analyserNode.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    onAmplitude(Math.min(Math.sqrt(sum / data.length) * 4, 1));
    animHandle = requestAnimationFrame(poll);
  }
  poll();

  source.onended = () => {
    _cleanup();
    onAmplitude(0);
    onDone();
  };

  source.start();
}

export function stopElevenLabs(): void {
  try { sourceNode?.stop(); } catch {}
  _cleanup();
}

function _cleanup() {
  if (animHandle) { cancelAnimationFrame(animHandle); animHandle = null; }
  sourceNode   = null;
  analyserNode = null;
  _isSpeaking  = false;
}

export function isElevenLabsSpeaking(): boolean { return _isSpeaking; }
