import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import type { AthenaSettings } from '@/types';

let recording: Audio.Recording | null = null;
let isRecording = false;

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestAudioPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Recording ────────────────────────────────────────────────────────────────

export async function startRecording(): Promise<boolean> {
  if (isRecording) return false;

  const hasPermission = await requestAudioPermission();
  if (!hasPermission) return false;

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: rec } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );

  recording = rec;
  isRecording = true;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  return true;
}

export async function stopRecording(): Promise<string | null> {
  if (!recording || !isRecording) return null;

  isRecording = false;
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;

  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  return uri ?? null;
}

export function isCurrentlyRecording(): boolean {
  return isRecording;
}

// ─── Speech-to-Text ───────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioUri: string,
  openAiKey: string,
): Promise<string | null> {
  if (!openAiKey) return null;

  try {
    // Build form data for Whisper API
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as unknown as Blob);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
      body: formData,
    });

    if (!res.ok) return null;
    const data = await res.json() as { text: string };
    return data.text.trim() || null;
  } catch (err) {
    console.error('Transcription error:', err);
    return null;
  }
}

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

let isSpeaking = false;

export async function speak(
  text: string,
  settings?: AthenaSettings['voice'],
  onStart?: () => void,
  onDone?: () => void,
): Promise<void> {
  // Stop any existing speech
  await stopSpeaking();

  isSpeaking = true;
  onStart?.();

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  return new Promise((resolve) => {
    Speech.speak(text, {
      language: settings?.language ?? 'en-US',
      rate: settings?.speed ?? 0.95,
      pitch: settings?.pitch ?? 1.0,
      onDone: () => {
        isSpeaking = false;
        onDone?.();
        resolve();
      },
      onStopped: () => {
        isSpeaking = false;
        resolve();
      },
      onError: () => {
        isSpeaking = false;
        onDone?.();
        resolve();
      },
    });
  });
}

export async function stopSpeaking(): Promise<void> {
  if (Speech.isSpeakingAsync) {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) {
      Speech.stop();
    }
  }
  isSpeaking = false;
}

export function getIsSpeaking(): boolean {
  return isSpeaking;
}

// ─── Audio Analysis (amplitude for sphere animation) ─────────────────────────

export async function getRecordingAmplitude(): Promise<number> {
  if (!recording || !isRecording) return 0;
  try {
    const status = await recording.getStatusAsync();
    if (status.isRecording && status.metering !== undefined) {
      // metering is in dB, typically -160 to 0
      // Normalize to 0–1
      const normalized = (status.metering + 60) / 60;
      return Math.max(0, Math.min(1, normalized));
    }
  } catch {
    // ignore
  }
  return 0;
}
