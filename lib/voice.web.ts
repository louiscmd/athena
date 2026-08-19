// Web voice library
// — Continuous wake-word detection ("athena" triggers activation)
// — Command capture via SpeechRecognition
// — Web Speech API TTS fallback

import type { AthenaSettings } from '@/types';

// ─── Wake word / continuous recognition ──────────────────────────────────────

type WakeCallbacks = {
  onWake:       ()              => void;   // "athena" heard, no inline command
  onCommand:    (text: string)  => void;   // full command ready
  onTranscript: (text: string)  => void;   // live interim text (for UI)
};

let rec: any = null;  // SpeechRecognition instance
let cbs: WakeCallbacks | null = null;
let wakeActive = false;
let paused = false;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTranscript = '';
let inCommandMode = false;
let followUpUntil = 0;   // timestamp; if Date.now() < followUpUntil, skip wake word check

const SILENCE_MS    = 2200;  // wait this long after last speech before submitting
const FOLLOW_UP_MS  = 6000;  // listen for follow-up this long after Athena stops speaking

function SR(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function initWakeWord(callbacks: WakeCallbacks): boolean {
  const SRClass = SR();
  if (!SRClass) return false;
  cbs        = callbacks;
  wakeActive = true;
  paused     = false;
  _startRec();
  return true;
}

export function pauseWakeWord(): void {
  paused = true;
  try { rec?.abort(); } catch {}
}

export function resumeWakeWord(openFollowUp = true): void {
  paused = false;
  if (openFollowUp) followUpUntil = Date.now() + FOLLOW_UP_MS;
  inCommandMode = false;
  pendingTranscript = '';
  _clearSilence();
  setTimeout(_startRec, 400);
}

export function stopWakeWord(): void {
  wakeActive = false;
  paused     = false;
  try { rec?.abort(); } catch {}
  rec = null;
  _clearSilence();
}

function _startRec() {
  if (!wakeActive || paused) return;
  const SRClass = SR();
  if (!SRClass) return;

  try { rec?.abort(); } catch {}

  const r = new SRClass();
  r.continuous      = true;
  r.interimResults  = true;
  r.lang            = 'en-US';
  rec = r;

  r.onresult = _handleResult;
  r.onend    = () => { if (wakeActive && !paused) setTimeout(_startRec, 300); };
  r.onerror  = (e: any) => {
    if (e.error === 'not-allowed') { wakeActive = false; return; }
    if (wakeActive && !paused) setTimeout(_startRec, 600);
  };

  try { r.start(); } catch {}
}

function _handleResult(evt: any) {
  let interim = '';
  let final_  = '';
  for (let i = evt.resultIndex; i < evt.results.length; i++) {
    const t = evt.results[i][0].transcript;
    if (evt.results[i].isFinal) final_ += t;
    else interim += t;
  }

  const text    = (final_ || interim).trim().toLowerCase();
  const isFinal = final_.length > 0;

  cbs?.onTranscript(text);

  const inFollowUp = Date.now() < followUpUntil;

  if (!inCommandMode && !inFollowUp) {
    // ── Dormant: look for wake word ─────────────────────────────────────
    if (!text.includes('athena')) return;

    const afterWake = text.slice(text.indexOf('athena') + 6).replace(/^[,\s!?]+/, '').trim();
    if (isFinal && afterWake.length > 3) {
      // Full command in same utterance: "Athena, open my calendar"
      cbs?.onCommand(afterWake);
      return;
    }
    // Just wake word — activate listening
    inCommandMode    = true;
    pendingTranscript = afterWake;
    cbs?.onWake();
    _resetSilence(isFinal);

  } else {
    // ── Active / follow-up: capture command ────────────────────────────
    const command = inFollowUp ? text : text.replace('athena', '').replace(/^[,\s]+/, '').trim();
    pendingTranscript = command;
    _resetSilence(isFinal);

    if (isFinal && command.length > 2) {
      _clearSilence();
      inCommandMode = false;
      followUpUntil = 0;
      cbs?.onCommand(command);
    }
  }
}

function _resetSilence(isFinal: boolean) {
  _clearSilence();
  const delay = isFinal ? 800 : SILENCE_MS;
  silenceTimer = setTimeout(() => {
    if (pendingTranscript.length > 2) {
      inCommandMode = false;
      followUpUntil = 0;
      cbs?.onCommand(pendingTranscript);
    } else {
      // Heard wake word but no command — go back to dormant
      inCommandMode = false;
      cbs?.onTranscript('');
    }
    pendingTranscript = '';
  }, delay);
}

function _clearSilence() {
  if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
}

// ─── Browser TTS fallback ────────────────────────────────────────────────────

let ttsUtterance: SpeechSynthesisUtterance | null = null;
let ttsSpeaking = false;

export async function speakFallback(
  text:     string,
  voice:    AthenaSettings['voice'],
  onStart?: () => void,
  onDone?:  () => void,
): Promise<void> {
  stopSpeakingFallback();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang  = voice?.language ?? 'en-US';
    u.rate  = voice?.speed   ?? 0.95;
    u.pitch = voice?.pitch   ?? 1.0;
    u.onstart = () => { ttsSpeaking = true; onStart?.(); };
    u.onend   = () => { ttsSpeaking = false; onDone?.(); resolve(); };
    u.onerror = () => { ttsSpeaking = false; onDone?.(); resolve(); };
    ttsUtterance = u;
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeakingFallback(): void {
  window.speechSynthesis?.cancel();
  ttsSpeaking = false;
}

// ─── Recording + Whisper STT ─────────────────────────────────────────────────

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;

export async function startRecording(): Promise<boolean> {
  if (isRecording) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks  = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.start(100);
    isRecording = true;
    return true;
  } catch { return false; }
}

export async function stopRecording(): Promise<string | null> {
  if (!mediaRecorder || !isRecording) return null;
  return new Promise(resolve => {
    mediaRecorder!.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      isRecording = false;
      mediaRecorder?.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      resolve(URL.createObjectURL(blob));
    };
    mediaRecorder!.stop();
  });
}

export async function transcribeAudio(uri: string, openAiKey: string): Promise<string | null> {
  if (!openAiKey) return null;
  try {
    const blob = await (await fetch(uri)).blob();
    const fd   = new FormData();
    fd.append('file', new File([blob], 'audio.webm', { type: 'audio/webm' }));
    fd.append('model', 'whisper-1');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${openAiKey}` }, body: fd,
    });
    if (!res.ok) return null;
    return ((await res.json()) as { text: string }).text?.trim() || null;
  } catch { return null; }
}

export async function requestAudioPermission(): Promise<boolean> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop());
    return true;
  } catch { return false; }
}

export async function getRecordingAmplitude(): Promise<number> { return 0; }
export function isCurrentlyRecording(): boolean { return isRecording; }
export function getIsSpeaking(): boolean { return ttsSpeaking; }

// Keep old speak export for any callers that still use it
export async function speak(
  text: string,
  settings?: AthenaSettings['voice'],
  onStart?: () => void,
  onDone?: () => void,
): Promise<void> {
  return speakFallback(text, settings ?? { speed: 0.95, pitch: 1.0, language: 'en-US' }, onStart, onDone);
}
export async function stopSpeaking(): Promise<void> { stopSpeakingFallback(); }
