// Web-specific voice hook — wake word engine + conversation loop
// Metro resolves useVoice.web.ts over useVoice.ts on web builds.

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

// Dynamic import of Buffer (web only — .web.ts resolved by Metro)
let _schedulePostByService: ((text: string, service: string, at?: string) => Promise<string>) | null = null;
import('@/lib/buffer.web').then(m => { _schedulePostByService = m.schedulePostByService; }).catch(() => {});

// ─── Greeting (once per hour) ─────────────────────────────────────────────────

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceInteraction() {
  const { mode, setMode, settings, setAmplitude } = useAthena();

  // Refs — always current, safe inside callbacks
  const settingsRef    = useRef(settings);
  const modeRef        = useRef(mode);
  const processingRef  = useRef(false);
  const recRef         = useRef<any>(null);
  const activeRef      = useRef(false);       // recognition running?
  const inCommandRef   = useRef(false);       // past wake word, capturing cmd?
  const followUpRef    = useRef(false);       // in follow-up window?
  const silenceTimer   = useRef<any>(null);
  const followUpTimer  = useRef<any>(null);
  const pendingCmd     = useRef('');

  settingsRef.current = settings;
  modeRef.current     = mode;

  const [transcript, setTranscript] = useState('');

  // ── Silence helpers ──────────────────────────────────────────────────────
  function clearSilence() {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  }

  function armSilence(delayMs = 1600) {
    clearSilence();
    silenceTimer.current = setTimeout(() => {
      const cmd = pendingCmd.current.trim();
      pendingCmd.current = '';
      inCommandRef.current  = false;
      followUpRef.current   = false;
      setTranscript('');
      if (cmd.length > 1) {
        runCommand(cmd);
      } else {
        setMode('idle');
      }
    }, delayMs);
  }

  // ── SpeechRecognition ─────────────────────────────────────────────────────
  function startRec() {
    if (!activeRef.current) return;
    const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) { console.warn('SpeechRecognition not available — use Chrome'); return; }

    try { recRef.current?.abort(); } catch {}

    const rec = new SRClass();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    recRef.current     = rec;

    rec.onresult = (event: any) => {
      // Collect the latest transcript segment
      let segment = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        segment += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      segment = segment.toLowerCase().trim();

      const inFollowUp = followUpRef.current;
      const inCommand  = inCommandRef.current;

      if (!inCommand && !inFollowUp) {
        // ── Dormant: listen for wake word ──────────────────────────────────
        if (!segment.includes('athena')) return;

        const after = segment
          .slice(segment.indexOf('athena') + 6)
          .replace(/^[,\s!?—]+/, '')
          .trim();

        inCommandRef.current = true;
        pendingCmd.current   = after;
        setMode('listening');
        setTranscript(after || '...');

        if (isFinal && after.length > 2) {
          // Full command in same utterance ("Athena, add a task…")
          clearSilence();
          inCommandRef.current = false;
          pendingCmd.current   = '';
          setTranscript('');
          runCommand(after);
        } else {
          armSilence();
        }
      } else {
        // ── Command mode / follow-up: accumulate ───────────────────────────
        const cleaned = segment.replace(/^athena[,\s!?—]*/i, '').trim();
        const cmd = cleaned || segment;
        pendingCmd.current = cmd;
        setTranscript(cmd);

        if (isFinal && cmd.length > 1) {
          // Final result → submit immediately
          clearSilence();
          inCommandRef.current = false;
          followUpRef.current  = false;
          pendingCmd.current   = '';
          setTranscript('');
          runCommand(cmd);
        } else {
          armSilence(1600);
        }
      }
    };

    rec.onend = () => {
      // Auto-restart unless we're speaking or stopped
      if (activeRef.current && modeRef.current !== 'speaking') {
        setTimeout(startRec, 200);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') { activeRef.current = false; return; }
      if (activeRef.current) setTimeout(startRec, 500);
    };

    try { rec.start(); } catch {}
  }

  function stopRec() {
    try { recRef.current?.abort(); } catch {}
    recRef.current = null;
  }

  // ── Process a command through Claude ─────────────────────────────────────
  async function runCommand(text: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    activeRef.current = false;
    stopRec();

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
      // Open follow-up window then restart recognition
      followUpRef.current = true;
      inCommandRef.current = false;
      if (followUpTimer.current) clearTimeout(followUpTimer.current);
      followUpTimer.current = setTimeout(() => { followUpRef.current = false; }, 6000);
      activeRef.current = true;
      setTimeout(startRec, 500);
    }
  }

  // ── TTS ───────────────────────────────────────────────────────────────────
  async function speakReply(text: string, s: AthenaSettings) {
    const hasEl = s.elevenLabsApiKey?.trim() && s.elevenLabsVoiceId?.trim();
    if (hasEl) {
      try {
        // Wrap in a promise that resolves when audio finishes (onDone callback)
        await new Promise<void>((resolve, reject) => {
          elevenLabsSpeak(
            text,
            s.elevenLabsApiKey!.trim(),
            s.elevenLabsVoiceId!.trim(),
            (amp) => setAmplitude(amp),
            resolve, // called by source.onended
          ).catch(reject);
        });
        return;
      } catch (e) {
        console.warn('ElevenLabs failed, falling back to browser TTS:', e);
      }
    }
    // Browser TTS fallback
    await new Promise<void>(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang  = s.voice?.language ?? 'en-US';
      u.rate  = s.voice?.speed   ?? 0.95;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  const stopSpeaking = useCallback(() => {
    stopElevenLabs();
    window.speechSynthesis?.cancel();
    setMode('idle');
    setAmplitude(0);
    // Resume listening
    activeRef.current = true;
    setTimeout(startRec, 300);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function executeActions(actions: AthenaAction[], s: AthenaSettings) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'create_task':
            await createTask({
              title:       action.data.title as string,
              priority:    (action.data.priority as any)  ?? 'medium',
              category:    (action.data.category as any)  ?? 'personal',
              completed:   false,
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
          case 'schedule_post': {
            if (_schedulePostByService) {
              const msg = await _schedulePostByService(
                action.data.text as string,
                (action.data.platform as string) ?? 'instagram',
                action.data.scheduledAt as string | undefined,
              );
              console.log('Buffer result:', msg);
            }
            break;
          }
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

  // ── Init recognition on mount ─────────────────────────────────────────────
  useEffect(() => {
    // Request mic permission
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(s => { s.getTracks().forEach(t => t.stop()); })
      .catch(() => {});

    activeRef.current = true;
    startRec();

    return () => {
      activeRef.current = false;
      clearSilence();
      if (followUpTimer.current) clearTimeout(followUpTimer.current);
      stopRec();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Text input fallback ───────────────────────────────────────────────────
  const processMessage = useCallback(async (text: string) => {
    await runCommand(text);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => setMode('listening'), [setMode]);
  const stopListening  = useCallback(() => {}, []);

  return { startListening, stopListening, processMessage, stopSpeaking, transcript };
}
