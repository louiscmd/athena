// hooks/useVoice.web.ts
// Two-phase speech recognition engine:
//
// PHASE 1 — "dormant": continuous SpeechRecognition listening only for "Athena"
// PHASE 2 — "listening": continuous:FALSE SpeechRecognition for the command
//
// Why two phases instead of one continuous instance?
// - continuous:true makes isFinal unreliable in Chrome (sometimes never fires)
// - continuous:false always fires isFinal + onend when the user stops speaking
// - Switching instances avoids the abort() → onend → restart loop that
//   causes the mic indicator to flicker
//
// Metro resolves .web.ts over .ts on web builds automatically.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAthena } from '@/contexts/AthenaContext';
import { askAthena } from '@/lib/ai';
import {
  saveMessage, createTask, createEvent, createHabit,
  createGoal, createFinanceEntry, createNote,
} from '@/lib/database';
import { elevenLabsSpeak, stopElevenLabs } from '@/lib/elevenlabs';
import { router } from 'expo-router';
import type { AthenaAction, AthenaSettings } from '@/types';

// Dynamic import of Buffer (web only, may not exist on older builds)
let _schedulePostByService: ((text: string, service: string, at?: string) => Promise<string>) | null = null;
import('@/lib/buffer.web').then(m => { _schedulePostByService = m.schedulePostByService; }).catch(() => {});

// ─── Greeting (once per hour) ──────────────────────────────────────────────────

function checkGreeting(): boolean {
  try {
    const last = parseInt(sessionStorage.getItem('athena_greeted') ?? '0', 10);
    if (Date.now() - last > 3_600_000) {
      sessionStorage.setItem('athena_greeted', String(Date.now()));
      return true;
    }
    return false;
  } catch { return false; }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceInteraction() {
  const { mode, setMode, settings, setAmplitude } = useAthena();

  // Always-current refs — safe inside async callbacks
  const settingsRef   = useRef(settings);
  const modeRef       = useRef(mode);
  settingsRef.current = settings;
  modeRef.current     = mode;

  const [transcript, setTranscript] = useState('');

  // ── Phase refs ─────────────────────────────────────────────────────────────
  type Phase = 'dormant' | 'listening' | 'processing';
  const phaseRef       = useRef<Phase>('dormant');
  const processingRef  = useRef(false);
  const followUpRef    = useRef(false);
  const followUpTimer  = useRef<any>(null);
  const stoppedRef     = useRef(false); // set true when mic is denied or hook unmounts

  // ── Recognition instances ───────────────────────────────────────────────────
  // p1 = wake word (continuous), p2 = command capture (continuous:false)
  const p1Ref        = useRef<any>(null);
  const p2Ref        = useRef<any>(null);
  const switchingRef = useRef(false); // true while we intentionally abort p1 to start p2

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getSRClass() {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }

  function extractCommand(segment: string): string {
    // Strip the wake word and leading punctuation
    const idx = segment.toLowerCase().indexOf('athena');
    if (idx === -1) return segment.trim();
    return segment
      .slice(idx + 6)
      .replace(/^[,\s!?—.]+/, '')
      .trim();
  }

  // ── Phase 1: wake word listener ────────────────────────────────────────────

  function startWakeWordRec() {
    if (stoppedRef.current) return;
    if (phaseRef.current !== 'dormant') return;

    const SRClass = getSRClass();
    if (!SRClass) { console.warn('SpeechRecognition not available — use Chrome'); return; }

    const rec = new SRClass();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    p1Ref.current      = rec;

    rec.onresult = (event: any) => {
      // Don't act if we've already switched phases
      if (phaseRef.current !== 'dormant') return;

      let segment = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        segment += event.results[i][0].transcript;
      }
      segment = segment.toLowerCase().trim();

      if (!segment.includes('athena')) return;

      const cmd = extractCommand(segment);

      if (cmd.length > 2) {
        // Full command in the same breath: "Athena, open my tasks"
        phaseRef.current = 'processing';
        switchingRef.current = true;
        try { rec.abort(); } catch {}
        setMode('thinking');
        runCommand(cmd);
      } else {
        // Just the wake word — switch to command capture
        phaseRef.current = 'listening';
        switchingRef.current = true;
        try { rec.abort(); } catch {}
        setMode('listening');
        startCommandRec();
      }
    };

    rec.onend = () => {
      // Intentional switch to phase 2 — don't restart
      if (switchingRef.current) { switchingRef.current = false; return; }
      // Chrome timed out (continuous sessions expire ~60s) — restart phase 1
      if (!stoppedRef.current && phaseRef.current === 'dormant') {
        setTimeout(startWakeWordRec, 300);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        console.warn('Microphone access denied');
        stoppedRef.current = true;
      }
      // other errors: onend will fire next and handle restart
    };

    try { rec.start(); } catch {}
  }

  // ── Phase 2: command capture ────────────────────────────────────────────────
  // continuous:false → Chrome always fires isFinal then onend when speech ends.
  // This is the key to reliable command detection.

  function startCommandRec() {
    if (stoppedRef.current) return;
    phaseRef.current = 'listening';

    const SRClass = getSRClass();
    if (!SRClass) return;

    const rec = new SRClass();
    rec.continuous     = false; // ← KEY: guarantees isFinal fires
    rec.interimResults = true;
    rec.lang           = 'en-US';
    p2Ref.current      = rec;

    let lastText = '';
    let gotFinal = false;

    rec.onresult = (event: any) => {
      let segment = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        segment += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      // Remove wake word if user repeated "Athena, ..."
      const cmd = extractCommand(segment) || segment.trim();
      lastText = cmd;
      setTranscript(cmd);

      if (isFinal && cmd.length > 0) {
        gotFinal = true;
        phaseRef.current = 'processing';
        setTranscript('');
        runCommand(cmd);
      }
    };

    rec.onend = () => {
      p2Ref.current = null;
      if (gotFinal) return; // command already dispatched in onresult

      if (phaseRef.current === 'listening') {
        if (lastText.length > 0) {
          // Got partial text without isFinal (Chrome cut off) — process anyway
          phaseRef.current = 'processing';
          setTranscript('');
          runCommand(lastText);
        } else {
          // Silence / no speech detected — go back to dormant
          phaseRef.current = 'dormant';
          setMode('idle');
          setTranscript('');
          startWakeWordRec();
        }
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') { stoppedRef.current = true; }
      // onend fires next
    };

    try { rec.start(); } catch {}
  }

  // ── Process a command ──────────────────────────────────────────────────────

  async function runCommand(text: string) {
    if (processingRef.current) return;
    processingRef.current = true;

    setMode('thinking');
    setTranscript('');

    try {
      const s     = settingsRef.current;
      const greet = checkGreeting();

      await saveMessage({ role: 'user', content: text, timestamp: Date.now() });
      const response = await askAthena(text, greet);
      await saveMessage({ role: 'athena', content: response.reply, timestamp: Date.now() });

      if (response.actions?.length) await executeActions(response.actions, s);

      setMode('speaking');
      await speakReply(response.reply, s);

    } catch (err) {
      console.error('Athena error:', err);
    } finally {
      processingRef.current = false;
      setMode('idle');
      setAmplitude(0);
      phaseRef.current = 'dormant';

      if (!stoppedRef.current) {
        // Open 6s follow-up window (no need to say "Athena" again)
        followUpRef.current = true;
        if (followUpTimer.current) clearTimeout(followUpTimer.current);
        followUpTimer.current = setTimeout(() => { followUpRef.current = false; }, 6000);

        // Start capturing immediately for the follow-up
        setTimeout(() => {
          if (!stoppedRef.current) startCommandRec();
        }, 400);
      }
    }
  }

  // ── TTS ────────────────────────────────────────────────────────────────────

  async function speakReply(text: string, s: AthenaSettings) {
    const hasEl = s.elevenLabsApiKey?.trim() && s.elevenLabsVoiceId?.trim();
    if (hasEl) {
      try {
        await new Promise<void>((resolve, reject) => {
          elevenLabsSpeak(
            text,
            s.elevenLabsApiKey!.trim(),
            s.elevenLabsVoiceId!.trim(),
            (amp) => setAmplitude(amp),
            resolve, // onDone resolves the promise
          ).catch(reject);
        });
        return;
      } catch (e) {
        console.warn('ElevenLabs failed, falling back to browser TTS:', e);
      }
    }
    // Browser TTS fallback
    await new Promise<void>(resolve => {
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang   = s.voice?.language ?? 'en-US';
      u.rate   = s.voice?.speed   ?? 0.95;
      u.onend  = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  const stopSpeaking = useCallback(() => {
    stopElevenLabs();
    window.speechSynthesis?.cancel();
    setAmplitude(0);
    setMode('idle');
    phaseRef.current = 'dormant';
    if (!stoppedRef.current) setTimeout(startWakeWordRec, 300);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────

  async function executeActions(actions: AthenaAction[], s: AthenaSettings) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'create_task':
            await createTask({
              title:     action.data.title as string,
              priority:  (action.data.priority as any)  ?? 'medium',
              category:  (action.data.category as any)  ?? 'personal',
              completed: false,
              ...(action.data.dueDate     ? { dueDate:     action.data.dueDate as number }     : {}),
              ...(action.data.dueTime     ? { dueTime:     action.data.dueTime as string }     : {}),
              ...(action.data.description ? { description: action.data.description as string } : {}),
            });
            break;
          case 'create_event':
            await createEvent({
              title:     action.data.title as string,
              startTime: action.data.startTime as number,
              endTime:   action.data.endTime as number,
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.location    ? { location:    action.data.location as string }    : {}),
              ...(action.data.color       ? { color:       action.data.color as string }       : {}),
            });
            break;
          case 'create_habit':
            await createHabit({
              name:      action.data.name as string,
              frequency: (action.data.frequency as any) ?? 'daily',
              icon:      (action.data.icon as string)   ?? '✅',
              color:     (action.data.color as string)  ?? '#b8b8cc',
              ...(action.data.description ? { description: action.data.description as string } : {}),
            });
            break;
          case 'create_goal':
            await createGoal({
              title:     action.data.title as string,
              timeframe: (action.data.timeframe as any) ?? 'month',
              icon:      (action.data.icon as string)   ?? '🎯',
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.targetDate  ? { targetDate:  action.data.targetDate as number }  : {}),
            });
            break;
          case 'add_finance':
            await createFinanceEntry({
              type:        (action.data.type as any)        ?? 'expense',
              amount:      action.data.amount as number,
              currency:    (action.data.currency as string) ?? s.currency ?? 'USD',
              category:    (action.data.category as any)    ?? 'other',
              description: action.data.description as string,
              date:        (action.data.date as number)     ?? Date.now(),
            });
            break;
          case 'create_note':
            await createNote({
              title:   action.data.title as string,
              content: (action.data.content as string) ?? '',
              tags:    (action.data.tags as string[])  ?? [],
              pinned:  (action.data.pinned as boolean) ?? false,
            });
            break;
          case 'schedule_post':
            if (_schedulePostByService) {
              await _schedulePostByService(
                action.data.text as string,
                (action.data.platform as string) ?? 'instagram',
                action.data.scheduledAt as string | undefined,
              );
            }
            break;
          case 'open_screen': {
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
            const path = map[action.data.screen as string];
            if (path) router.push(path as any);
            break;
          }
        }
      } catch (e) { console.error('Action failed:', action.type, e); }
    }
  }

  // ── Mount / unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    // Request mic permission upfront so Chrome shows the allow prompt
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => stream.getTracks().forEach(t => t.stop()))
      .catch(() => {});

    stoppedRef.current = false;
    phaseRef.current   = 'dormant';
    startWakeWordRec();

    return () => {
      stoppedRef.current = true;
      if (followUpTimer.current) clearTimeout(followUpTimer.current);
      try { p1Ref.current?.abort(); } catch {}
      try { p2Ref.current?.abort(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Text input fallback ────────────────────────────────────────────────────

  const processMessage = useCallback(async (text: string) => {
    if (processingRef.current) return;
    phaseRef.current = 'processing';
    // Stop any active recognition
    try { p1Ref.current?.abort(); } catch {}
    try { p2Ref.current?.abort(); } catch {}
    await runCommand(text);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => setMode('listening'), [setMode]);
  const stopListening  = useCallback(() => {}, []);

  return { startListening, stopListening, processMessage, stopSpeaking, transcript };
}
