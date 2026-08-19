// hooks/useVoice.web.ts — Two-phase wake word + command engine
//
// Phase 1 (dormant): continuous SpeechRecognition, keyword "Athena"
// Phase 2 (listening): continuous:false SpeechRecognition — isFinal guaranteed
//
// KEY FIX: Chrome autoplay policy blocks all audio (WebAudio + SpeechSynthesis)
// unless the user has clicked the page. We unlock audio on first click/touch
// and add a hard timeout to TTS so it can never hang the pipeline.

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

// Dynamic import of Buffer
let _schedulePostByService: ((text: string, service: string, at?: string) => Promise<string>) | null = null;
import('@/lib/buffer.web').then(m => { _schedulePostByService = m.schedulePostByService; }).catch(() => {});

// ── Greeting once per hour ──────────────────────────────────────────────────

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

// ── Audio unlock ─────────────────────────────────────────────────────────────
// Chrome blocks all audio until a user gesture (click/touch) has occurred.
// We listen for the first interaction and run a zero-volume AudioContext
// resume + silent SpeechSynthesis utterance to satisfy the policy.

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      ctx.resume().then(() => ctx.close()).catch(() => {});
    }
  } catch {}
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis?.speak(u);
  } catch {}
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceInteraction() {
  const { mode, setMode, settings, setAmplitude } = useAthena();

  const settingsRef   = useRef(settings);
  const modeRef       = useRef(mode);
  settingsRef.current = settings;
  modeRef.current     = mode;

  const [transcript, setTranscript]         = useState('');
  const [lastReply, setLastReply]           = useState('');
  const [actionFeedback, setActionFeedback] = useState(''); // shows "✓ Task created" etc.

  type Phase = 'dormant' | 'listening' | 'processing';
  const phaseRef      = useRef<Phase>('dormant');
  const processingRef = useRef(false);
  const followUpRef   = useRef(false);
  const followUpTimer = useRef<any>(null);
  const stoppedRef    = useRef(false);

  const p1Ref        = useRef<any>(null); // wake word rec (continuous)
  const p2Ref        = useRef<any>(null); // command rec (continuous:false)
  const switchingRef = useRef(false);     // prevents onend restart during phase switch

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getSR() {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }

  function extractCmd(segment: string): string {
    const idx = segment.toLowerCase().indexOf('athena');
    if (idx === -1) return segment.trim();
    return segment.slice(idx + 6).replace(/^[,\s!?—.]+/, '').trim();
  }

  // ── Phase 1: wake word ────────────────────────────────────────────────────

  function startWakeWordRec() {
    if (stoppedRef.current || phaseRef.current !== 'dormant') return;
    const SRClass = getSR();
    if (!SRClass) { console.warn('[Athena] SpeechRecognition not available — need Chrome'); return; }

    const rec = new SRClass();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    p1Ref.current      = rec;

    rec.onresult = (event: any) => {
      if (phaseRef.current !== 'dormant') return;
      let segment = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        segment += event.results[i][0].transcript;
      }
      segment = segment.toLowerCase().trim();
      if (!segment.includes('athena')) return;

      console.log('[Athena] Wake word detected in:', segment);
      const cmd = extractCmd(segment);

      switchingRef.current = true;
      try { rec.abort(); } catch {}

      if (cmd.length > 2) {
        phaseRef.current = 'processing';
        setMode('thinking');
        console.log('[Athena] Inline command:', cmd);
        runCommand(cmd);
      } else {
        phaseRef.current = 'listening';
        setMode('listening');
        console.log('[Athena] Switching to command capture');
        startCommandRec();
      }
    };

    rec.onend = () => {
      if (switchingRef.current) { switchingRef.current = false; return; }
      if (!stoppedRef.current && phaseRef.current === 'dormant') {
        setTimeout(startWakeWordRec, 300);
      }
    };

    rec.onerror = (e: any) => {
      console.warn('[Athena] P1 error:', e.error);
      if (e.error === 'not-allowed') stoppedRef.current = true;
    };

    try { rec.start(); console.log('[Athena] Phase 1 listening...'); } catch {}
  }

  // ── Phase 2: command capture ──────────────────────────────────────────────
  // continuous:false → Chrome always fires isFinal then onend when speech ends

  function startCommandRec() {
    if (stoppedRef.current) return;
    phaseRef.current = 'listening';
    const SRClass = getSR();
    if (!SRClass) return;

    const rec = new SRClass();
    rec.continuous     = false;  // GUARANTEES isFinal fires
    rec.interimResults = true;
    rec.lang           = 'en-US';
    p2Ref.current      = rec;

    let lastText = '';
    let gotFinal = false;

    rec.onresult = (event: any) => {
      let segment = '', isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        segment += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      const cmd = extractCmd(segment) || segment.trim();
      lastText = cmd;
      setTranscript(cmd);

      if (isFinal && cmd.length > 0) {
        gotFinal = true;
        phaseRef.current = 'processing';
        setTranscript('');
        console.log('[Athena] Command captured:', cmd);
        runCommand(cmd);
      }
    };

    rec.onend = () => {
      p2Ref.current = null;
      if (gotFinal) return;
      if (phaseRef.current === 'listening') {
        if (lastText.length > 0) {
          phaseRef.current = 'processing';
          setTranscript('');
          console.log('[Athena] Partial command (no isFinal):', lastText);
          runCommand(lastText);
        } else {
          console.log('[Athena] No command heard, back to dormant');
          phaseRef.current = 'dormant';
          setMode('idle');
          setTranscript('');
          startWakeWordRec();
        }
      }
    };

    rec.onerror = (e: any) => {
      console.warn('[Athena] P2 error:', e.error);
      if (e.error === 'not-allowed') stoppedRef.current = true;
    };

    try { rec.start(); } catch {}
  }

  // ── Process command ───────────────────────────────────────────────────────

  async function runCommand(text: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setMode('thinking');
    setTranscript('');

    try {
      const s     = settingsRef.current;
      const greet = checkGreeting();

      console.log('[Athena] Calling Claude with:', text.slice(0, 60));
      await saveMessage({ role: 'user', content: text, timestamp: Date.now() });
      const response = await askAthena(text, greet);
      await saveMessage({ role: 'athena', content: response.reply, timestamp: Date.now() });
      console.log('[Athena] Got reply:', response.reply.slice(0, 80));

      if (response.actions?.length) {
        console.log('[Athena] Executing actions:', response.actions.length, JSON.stringify(response.actions));
        const feedback = await executeActions(response.actions, s);
        if (feedback) {
          setActionFeedback(feedback);
          setTimeout(() => setActionFeedback(''), 5000);
        }
      } else {
        console.log('[Athena] No actions in response (conversational reply only)');
      }

      setLastReply(response.reply); // always show text
      setMode('speaking');
      await speakReply(response.reply, s);

    } catch (err) {
      console.error('[Athena] Error:', err);
    } finally {
      processingRef.current = false;
      setMode('idle');
      setAmplitude(0);
      phaseRef.current = 'dormant';
      console.log('[Athena] Done — resuming listening');

      if (!stoppedRef.current) {
        followUpRef.current = true;
        if (followUpTimer.current) clearTimeout(followUpTimer.current);
        followUpTimer.current = setTimeout(() => {
          followUpRef.current = false;
          setLastReply('');
        }, 6000);
        // Follow-up: listen immediately without needing wake word
        setTimeout(() => { if (!stoppedRef.current) startCommandRec(); }, 400);
      }
    }
  }

  // ── TTS ───────────────────────────────────────────────────────────────────
  // HARD TIMEOUTS on both paths — prevents the pipeline from ever hanging.

  async function speakReply(text: string, s: AthenaSettings) {
    const hasEl = s.elevenLabsApiKey?.trim() && s.elevenLabsVoiceId?.trim();

    if (hasEl) {
      try {
        console.log('[Athena] Speaking via ElevenLabs...');
        await new Promise<void>((resolve, reject) => {
          // 30s hard timeout — in case AudioContext is suspended or network hangs
          const timeout = setTimeout(() => {
            console.warn('[Athena] ElevenLabs timeout — falling through to browser TTS');
            resolve();
          }, 30_000);

          elevenLabsSpeak(
            text,
            s.elevenLabsApiKey!.trim(),
            s.elevenLabsVoiceId!.trim(),
            amp => setAmplitude(amp),
            () => { clearTimeout(timeout); resolve(); },
          ).catch(err => { clearTimeout(timeout); reject(err); });
        });
        return;
      } catch (e) {
        console.warn('[Athena] ElevenLabs failed:', e);
      }
    }

    // Browser TTS fallback — pick Chrome's Google voice (sounds human), 8s hard timeout
    console.log('[Athena] Speaking via browser TTS...');
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        console.warn('[Athena] Browser TTS timeout — click the page once to unlock Chrome audio');
        resolve();
      }, 8_000);

      try {
        window.speechSynthesis?.cancel();
        const u = new SpeechSynthesisUtterance(text);

        // Pick the best available voice:
        // Chrome's "Google US English" sounds natural; system voices are robotic.
        const voices = window.speechSynthesis?.getVoices() ?? [];
        const best =
          voices.find(v => v.name === 'Google US English') ||
          voices.find(v => v.name.toLowerCase().includes('google') && v.lang.startsWith('en')) ||
          voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('female')) ||
          voices.find(v => v.lang === 'en-US') ||
          voices.find(v => v.lang.startsWith('en')) ||
          null;

        if (best) u.voice = best;
        u.lang   = 'en-US';
        u.rate   = 1.1;   // slightly faster = more natural, less robotic
        u.pitch  = 1.0;
        u.volume = 1;

        u.onend  = () => { clearTimeout(timeout); resolve(); };
        u.onerror = (e) => { console.warn('[Athena] TTS error:', e); clearTimeout(timeout); resolve(); };
        window.speechSynthesis?.speak(u);
      } catch (e) {
        console.warn('[Athena] SpeechSynthesis threw:', e);
        clearTimeout(timeout);
        resolve();
      }
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

  // ── Actions ───────────────────────────────────────────────────────────────

  // Returns a short feedback string shown on screen, e.g. "✓ Task created"
  async function executeActions(actions: AthenaAction[], s: AthenaSettings): Promise<string> {
    const labels: string[] = [];
    let navigateTo: string | null = null;

    for (const action of actions) {
      try {
        console.log('[Athena] Executing action:', action.type, JSON.stringify(action.data));
        switch (action.type) {
          case 'create_task':
            await createTask({
              title: action.data.title as string,
              priority: (action.data.priority as any) ?? 'medium',
              category: (action.data.category as any) ?? 'personal',
              completed: false,
              ...(action.data.dueDate     ? { dueDate:     action.data.dueDate as number }     : {}),
              ...(action.data.dueTime     ? { dueTime:     action.data.dueTime as string }     : {}),
              ...(action.data.description ? { description: action.data.description as string } : {}),
            });
            labels.push(`✓ Task created: "${action.data.title}"`);
            if (!navigateTo) navigateTo = '/(tabs)/tasks';
            break;
          case 'create_event':
            await createEvent({
              title: action.data.title as string,
              startTime: action.data.startTime as number,
              endTime: action.data.endTime as number,
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.location    ? { location:    action.data.location as string }    : {}),
              ...(action.data.color       ? { color:       action.data.color as string }       : {}),
            });
            labels.push(`✓ Event added: "${action.data.title}"`);
            if (!navigateTo) navigateTo = '/(tabs)/schedule';
            break;
          case 'create_habit':
            await createHabit({
              name: action.data.name as string,
              frequency: (action.data.frequency as any) ?? 'daily',
              icon: (action.data.icon as string) ?? '✅',
              color: (action.data.color as string) ?? '#b8b8cc',
              ...(action.data.description ? { description: action.data.description as string } : {}),
            });
            labels.push(`✓ Habit created: "${action.data.name}"`);
            if (!navigateTo) navigateTo = '/(tabs)/habits';
            break;
          case 'create_goal':
            await createGoal({
              title: action.data.title as string,
              timeframe: (action.data.timeframe as any) ?? 'month',
              icon: (action.data.icon as string) ?? '🎯',
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.targetDate  ? { targetDate:  action.data.targetDate as number }  : {}),
            });
            labels.push(`✓ Goal set: "${action.data.title}"`);
            if (!navigateTo) navigateTo = '/(tabs)/goals';
            break;
          case 'add_finance':
            await createFinanceEntry({
              type: (action.data.type as any) ?? 'expense',
              amount: action.data.amount as number,
              currency: (action.data.currency as string) ?? s.currency ?? 'USD',
              category: (action.data.category as any) ?? 'other',
              description: action.data.description as string,
              date: (action.data.date as number) ?? Date.now(),
            });
            labels.push(`✓ Finance logged: ${action.data.amount} ${action.data.currency ?? s.currency}`);
            if (!navigateTo) navigateTo = '/(tabs)/finance';
            break;
          case 'create_note':
            await createNote({
              title: action.data.title as string,
              content: (action.data.content as string) ?? '',
              tags: (action.data.tags as string[]) ?? [],
              pinned: (action.data.pinned as boolean) ?? false,
            });
            labels.push(`✓ Note saved: "${action.data.title}"`);
            if (!navigateTo) navigateTo = '/(tabs)/notes';
            break;
          case 'schedule_post':
            if (_schedulePostByService) {
              await _schedulePostByService(
                action.data.text as string,
                (action.data.platform as string) ?? 'instagram',
                action.data.scheduledAt as string | undefined,
              );
            }
            labels.push(`✓ Post queued on ${action.data.platform}`);
            break;
          case 'open_screen': {
            const map: Record<string, string> = {
              schedule: '/(tabs)/schedule', tasks: '/(tabs)/tasks',
              habits: '/(tabs)/habits',     finance: '/(tabs)/finance',
              goals: '/(tabs)/goals',       notes: '/(tabs)/notes',
              gmail: '/(tabs)/gmail',       music: '/(tabs)/youtube',
            };
            const path = map[action.data.screen as string];
            if (path) { router.push(path as any); navigateTo = null; } // explicit nav, skip auto-nav
            break;
          }
        }
        console.log('[Athena] Action OK:', action.type);
      } catch (e) {
        console.error('[Athena] Action failed:', action.type, e);
        labels.push(`⚠ ${action.type} failed: ${(e as Error).message}`);
      }
    }

    // Auto-navigate to show the user the result (after TTS finishes, handled by caller)
    if (navigateTo) {
      setTimeout(() => router.push(navigateTo as any), 1200);
    }

    return labels.join(' · ');
  }

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    // Unlock audio on first user interaction with the page
    // (Chrome blocks all audio without a prior user gesture)
    const onInteract = () => unlockAudio();
    document.addEventListener('click', onInteract, { once: true });
    document.addEventListener('touchstart', onInteract, { once: true });
    document.addEventListener('keydown', onInteract, { once: true });

    // Request mic permission (Chrome asks for it on start() but this surfaces
    // the prompt immediately rather than waiting for the wake word attempt)
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        unlockAudio(); // permission grant counts as user gesture in some contexts
      })
      .catch(() => {});

    stoppedRef.current = false;
    phaseRef.current   = 'dormant';
    startWakeWordRec();

    return () => {
      stoppedRef.current = true;
      document.removeEventListener('click', onInteract);
      document.removeEventListener('touchstart', onInteract);
      document.removeEventListener('keydown', onInteract);
      if (followUpTimer.current) clearTimeout(followUpTimer.current);
      switchingRef.current = true; // prevent onend restart
      try { p1Ref.current?.abort(); } catch {}
      try { p2Ref.current?.abort(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Text fallback ─────────────────────────────────────────────────────────

  const processMessage = useCallback(async (text: string) => {
    if (processingRef.current) return;
    phaseRef.current = 'processing';
    switchingRef.current = true;
    try { p1Ref.current?.abort(); } catch {}
    try { p2Ref.current?.abort(); } catch {}
    await runCommand(text);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => setMode('listening'), [setMode]);
  const stopListening  = useCallback(() => {}, []);

  return { startListening, stopListening, processMessage, stopSpeaking, transcript, lastReply, actionFeedback };
}
