import { useCallback, useRef } from 'react';
import { useAthena } from '@/contexts/AthenaContext';
import { askAthena } from '@/lib/ai';
import {
  startRecording, stopRecording, transcribeAudio,
  speak, stopSpeaking, getRecordingAmplitude,
} from '@/lib/voice';
import {
  createTask, createEvent, createHabit, createGoal,
  createFinanceEntry, createNote,
  scheduleTaskNotification,
} from '@/lib/database';
import { scheduleTaskNotification as scheduleNotif } from '@/lib/notifications';
import type { AthenaAction } from '@/types';

export function useVoiceInteraction() {
  const { mode, setMode, settings, addMessage, setAmplitude } = useAthena();
  const amplitudeInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Amplitude polling (for sphere animation) ─────────────────────────────

  function startAmplitudePolling() {
    amplitudeInterval.current = setInterval(async () => {
      const amp = await getRecordingAmplitude();
      setAmplitude(amp);
    }, 80);
  }

  function stopAmplitudePolling() {
    if (amplitudeInterval.current) {
      clearInterval(amplitudeInterval.current);
      amplitudeInterval.current = null;
    }
    setAmplitude(0);
  }

  // ─── Execute actions returned by Athena ───────────────────────────────────

  async function executeActions(actions: AthenaAction[]) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'create_task': {
            const data = action.data as Parameters<typeof createTask>[0];
            const task = await createTask({
              title: data.title as string,
              priority: (data.priority as 'low' | 'medium' | 'high') ?? 'medium',
              category: (data.category as 'personal' | 'work' | 'health' | 'finance' | 'other') ?? 'personal',
              completed: false,
              ...(data.dueDate ? { dueDate: data.dueDate as number } : {}),
              ...(data.dueTime ? { dueTime: data.dueTime as string } : {}),
              ...(data.description ? { description: data.description as string } : {}),
            });
            if (task.dueDate && settings.notifications.taskReminders) {
              const notifId = await scheduleNotif(task.id, task.title, task.dueDate, task.dueTime);
              if (notifId) {
                await createTask({ ...task, notificationId: notifId });
              }
            }
            break;
          }
          case 'create_event': {
            await createEvent({
              title: action.data.title as string,
              startTime: action.data.startTime as number,
              endTime: action.data.endTime as number,
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.location ? { location: action.data.location as string } : {}),
              ...(action.data.color ? { color: action.data.color as string } : {}),
            });
            break;
          }
          case 'create_habit': {
            await createHabit({
              name: action.data.name as string,
              frequency: (action.data.frequency as 'daily' | 'weekly' | 'weekdays' | 'weekends') ?? 'daily',
              icon: (action.data.icon as string) ?? '✅',
              color: (action.data.color as string) ?? '#00d4ff',
              ...(action.data.description ? { description: action.data.description as string } : {}),
            });
            break;
          }
          case 'create_goal': {
            await createGoal({
              title: action.data.title as string,
              timeframe: (action.data.timeframe as 'week' | 'month' | 'quarter' | 'year' | 'custom') ?? 'month',
              icon: (action.data.icon as string) ?? '🎯',
              ...(action.data.description ? { description: action.data.description as string } : {}),
              ...(action.data.targetDate ? { targetDate: action.data.targetDate as number } : {}),
            });
            break;
          }
          case 'add_finance': {
            await createFinanceEntry({
              type: action.data.type as 'income' | 'expense',
              amount: action.data.amount as number,
              currency: (action.data.currency as string) ?? settings.currency,
              category: (action.data.category as 'food' | 'transport' | 'housing' | 'entertainment' | 'health' | 'shopping' | 'work' | 'savings' | 'other') ?? 'other',
              description: action.data.description as string,
              date: (action.data.date as number) ?? Date.now(),
            });
            break;
          }
          case 'create_note': {
            await createNote({
              title: action.data.title as string,
              content: action.data.content as string,
              tags: (action.data.tags as string[]) ?? [],
              pinned: (action.data.pinned as boolean) ?? false,
            });
            break;
          }
        }
      } catch (err) {
        console.error(`Failed to execute action ${action.type}:`, err);
      }
    }
  }

  // ─── Process a text message ────────────────────────────────────────────────

  const processMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    await addMessage({ role: 'user', content: text, timestamp: Date.now() });
    setMode('thinking');

    const response = await askAthena(text);

    if (response.actions?.length) {
      await executeActions(response.actions);
    }

    await addMessage({ role: 'athena', content: response.reply, timestamp: Date.now() });

    setMode('speaking');
    await speak(response.reply, settings.voice,
      () => setMode('speaking'),
      () => setMode('idle'),
    );
  }, [settings, addMessage, setMode]);

  // ─── Voice interaction ─────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (mode !== 'idle') {
      if (mode === 'speaking') await stopSpeaking();
      else return;
    }

    const started = await startRecording();
    if (!started) return;

    setMode('listening');
    startAmplitudePolling();
  }, [mode, setMode]);

  const stopListening = useCallback(async () => {
    if (mode !== 'listening') return;

    stopAmplitudePolling();
    setMode('thinking');

    const uri = await stopRecording();
    if (!uri) {
      setMode('idle');
      return;
    }

    let text: string | null = null;
    if (settings.openAiApiKey) {
      text = await transcribeAudio(uri, settings.openAiApiKey);
    }

    if (!text) {
      // No transcription available — show input prompt
      setMode('idle');
      return;
    }

    await processMessage(text);
  }, [mode, settings, setMode, processMessage]);

  const cancelListening = useCallback(async () => {
    stopAmplitudePolling();
    await stopRecording();
    setMode('idle');
  }, [setMode]);

  return {
    mode,
    startListening,
    stopListening,
    cancelListening,
    processMessage,
    stopSpeaking: async () => {
      await stopSpeaking();
      setMode('idle');
    },
  };
}
