import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAthena } from '@/contexts/AthenaContext';
import { askAthena } from '@/lib/ai';
import { saveMessage, createTask, createEvent, createHabit, createGoal, createFinanceEntry, createNote } from '@/lib/database';
import { router } from 'expo-router';
import type { AthenaAction } from '@/types';

// ─── Platform-specific voice imports ─────────────────────────────────────────

let initWakeWord: any, pauseWakeWord: any, resumeWakeWord: any, stopWakeWord: any;
let elevenLabsSpeak: any, stopElevenLabs: any;
let speakFallback: any, stopSpeakingFallback: any;

if (Platform.OS === 'web') {
  // Dynamic imports at module level via require (Metro resolves .web.ts)
  const voiceMod = require('@/lib/voice');
  initWakeWord       = voiceMod.initWakeWord;
  pauseWakeWord      = voiceMod.pauseWakeWord;
  resumeWakeWord     = voiceMod.resumeWakeWord;
  stopWakeWord       = voiceMod.stopWakeWord;
  speakFallback      = voiceMod.speakFallback;
  stopSpeakingFallback = voiceMod.stopSpeakingFallback;

  const elMod = require('@/lib/elevenlabs');
  elevenLabsSpeak    = elMod.elevenLabsSpeak;
  stopElevenLabs     = elMod.stopElevenLabs;
}

// ─── Greeting logic ───────────────────────────────────────────────────────────

const GREET_INTERVAL = 60 * 60 * 1000; // 1 hour

function checkGreeting(): boolean {
  try {
    const last = parseInt(sessionStorage.getItem('athena_greeted') ?? '0', 10);
    if (Date.now() - last > GREET_INTERVAL) {
      sessionStorage.setItem('athena_greeted', String(Date.now()));
      return true;
    }
    return false;
  } catch { return false; }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceInteraction() {
  const { mode, setMode, settings, addMessage, setAmplitude } = useAthena();
  const [transcript, setTranscript] = useState('');
  const processingRef = useRef(false);

  // ── Process a command ─────────────────────────────────────────────────────

  const processCommand = useCallback(async (text: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    setTranscript('');
    setMode('thinking');

    try {
      await saveMessage({ role: 'user', content: text, timestamp: Date.now() });
      const greet    = checkGreeting();
      const response = await askAthena(text, greet);

      await saveMessage({ role: 'athena', content: response.reply, timestamp: Date.now() });
      if (response.actions) await executeActions(response.actions);

      // Speak the reply
      setMode('speaking');
      await speakReply(response.reply);
    } catch (err) {
      console.error('Athena error:', err);
    } finally {
      processingRef.current = false;
      setMode('idle');
      // Open a follow-up window so the next thing the user says is captured without re-saying "Athena"
      if (Platform.OS === 'web') resumeWakeWord?.(true);
    }
  }, [settings, setMode, setAmplitude]);

  // ── TTS ───────────────────────────────────────────────────────────────────

  const speakReply = useCallback(async (text: string) => {
    const hasElevenLabs = settings.elevenLabsApiKey?.trim() && settings.elevenLabsVoiceId?.trim();

    if (Platform.OS === 'web' && hasElevenLabs) {
      try {
        await elevenLabsSpeak(
          text,
          settings.elevenLabsApiKey!.trim(),
          settings.elevenLabsVoiceId!.trim(),
          (amp: number) => setAmplitude(amp),
          () => {},
        );
        return;
      } catch (e) {
        console.warn('ElevenLabs failed, falling back to browser TTS:', e);
      }
    }

    // Fallback: browser Web Speech API
    if (Platform.OS === 'web') {
      await speakFallback?.(text, settings.voice);
    }
  }, [settings, setAmplitude]);

  // ── Stop speaking ─────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (Platform.OS === 'web') {
      stopElevenLabs?.();
      stopSpeakingFallback?.();
    }
    setMode('idle');
    setAmplitude(0);
  }, [setMode, setAmplitude]);

  // ── Wake word initialization ───────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Request mic permission silently
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(() => {});

    const started = initWakeWord?.({
      onWake: () => {
        if (processingRef.current) return;
        setMode('listening');
        setTranscript('');
      },
      onCommand: (text: string) => {
        if (processingRef.current) return;
        processCommand(text);
      },
      onTranscript: (text: string) => {
        setTranscript(text);
      },
    });

    if (!started) {
      console.warn('SpeechRecognition not available — use Chrome for wake word support');
    }

    return () => { stopWakeWord?.(); };
  }, []); // only init once

  // ── Pause recognition while speaking ──────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (mode === 'speaking') {
      pauseWakeWord?.();
    }
    // resume is called in processCommand's finally block
  }, [mode]);

  // ── Execute AI actions ─────────────────────────────────────────────────────

  async function executeActions(actions: AthenaAction[]) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'create_task':
            await createTask({
              title:       action.data.title as string,
              priority:    (action.data.priority as any) ?? 'medium',
              category:    (action.data.category as any) ?? 'personal',
              completed:   false,
              ...(action.data.dueDate      ? { dueDate:      action.data.dueDate as number } : {}),
              ...(action.data.dueTime      ? { dueTime:      action.data.dueTime as string } : {}),
              ...(action.data.description  ? { description:  action.data.description as string } : {}),
            });
            break;
          case 'create_event':
            await createEvent({
              title:     action.data.title as string,
              startTime: action.data.startTime as number,
              endTime:   action.data.endTime as number,
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.location    ? { location:    action.data.location as string } : {}),
              ...(action.data.color       ? { color:       action.data.color as string } : {}),
            });
            break;
          case 'create_habit':
            await createHabit({
              name:      action.data.name as string,
              frequency: (action.data.frequency as any) ?? 'daily',
              icon:      (action.data.icon as string) ?? '✅',
              color:     (action.data.color as string) ?? '#b8b8cc',
              ...(action.data.description ? { description: action.data.description as string } : {}),
            });
            break;
          case 'create_goal':
            await createGoal({
              title:     action.data.title as string,
              timeframe: (action.data.timeframe as any) ?? 'month',
              icon:      (action.data.icon as string) ?? '🎯',
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.targetDate  ? { targetDate:  action.data.targetDate as number } : {}),
            });
            break;
          case 'add_finance':
            await createFinanceEntry({
              type:        (action.data.type as any) ?? 'expense',
              amount:      action.data.amount as number,
              currency:    (action.data.currency as string) ?? settings.currency ?? 'USD',
              category:    (action.data.category as any) ?? 'other',
              description: action.data.description as string,
              date:        (action.data.date as number) ?? Date.now(),
            });
            break;
          case 'create_note':
            await createNote({
              title:   action.data.title as string,
              content: (action.data.content as string) ?? '',
              tags:    (action.data.tags as string[]) ?? [],
              pinned:  (action.data.pinned as boolean) ?? false,
            });
            break;
          case 'open_screen': {
            const screen = action.data.screen as string;
            const map: Record<string, string> = {
              schedule: '/(tabs)/schedule',
              tasks:    '/(tabs)/tasks',
              habits:   '/(tabs)/habits',
              finance:  '/(tabs)/finance',
              goals:    '/(tabs)/goals',
              notes:    '/(tabs)/notes',
              gmail:    '/(tabs)/gmail',
              music:    '/(tabs)/youtube',
            };
            if (map[screen]) router.push(map[screen] as any);
            break;
          }
        }
      } catch (e) {
        console.error('Action failed:', action.type, e);
      }
    }
  }

  // ── Exposed API ───────────────────────────────────────────────────────────

  // Legacy button-based methods (still used by text input)
  const startListening = useCallback(() => { setMode('listening'); }, [setMode]);
  const stopListening  = useCallback(() => {}, []);

  return {
    startListening,
    stopListening,
    processMessage: processCommand,
    stopSpeaking,
    transcript,
  };
}
