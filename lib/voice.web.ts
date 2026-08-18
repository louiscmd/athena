// Web implementation of voice I/O using Web Speech API + MediaRecorder

import type { AthenaSettings } from '@/types';

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestAudioPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch { return false; }
}

// ─── Recording ────────────────────────────────────────────────────────────────

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;
let currentAmplitude = 0;

let analyser: AnalyserNode | null = null;
let animFrame: number | null = null;

export async function startRecording(): Promise<boolean> {
  if (isRecording) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Amplitude analysis
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      currentAmplitude = avg / 128; // 0–1
      animFrame = requestAnimationFrame(tick);
    }
    tick();

    audioChunks = [];
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
      if (animFrame) cancelAnimationFrame(animFrame);
      analyser = null;
      currentAmplitude = 0;
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      isRecording = false;
      mediaRecorder?.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      resolve(url);
    };
    mediaRecorder!.stop();
  });
}

export function isCurrentlyRecording(): boolean { return isRecording; }

// ─── Speech-to-Text ───────────────────────────────────────────────────────────

export async function transcribeAudio(audioUri: string, openAiKey: string): Promise<string | null> {
  if (!openAiKey) return null;
  try {
    const res = await fetch(audioUri);
    const blob = await res.blob();
    const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: formData,
    });
    if (!response.ok) return null;
    const data = await response.json() as { text: string };
    return data.text?.trim() || null;
  } catch { return null; }
}

// ─── Text-to-Speech (Web Speech API) ─────────────────────────────────────────

let isSpeaking = false;

export async function speak(
  text: string,
  settings?: AthenaSettings['voice'],
  onStart?: () => void,
  onDone?: () => void,
): Promise<void> {
  await stopSpeaking();

  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings?.language ?? 'en-US';
    utterance.rate = settings?.speed ?? 0.95;
    utterance.pitch = settings?.pitch ?? 1.0;

    utterance.onstart = () => { isSpeaking = true; onStart?.(); };
    utterance.onend = () => { isSpeaking = false; onDone?.(); resolve(); };
    utterance.onerror = () => { isSpeaking = false; onDone?.(); resolve(); };

    window.speechSynthesis.speak(utterance);
  });
}

export async function stopSpeaking(): Promise<void> {
  window.speechSynthesis?.cancel();
  isSpeaking = false;
}

export function getIsSpeaking(): boolean { return isSpeaking; }

// ─── Amplitude ───────────────────────────────────────────────────────────────

export async function getRecordingAmplitude(): Promise<number> {
  return currentAmplitude;
}
