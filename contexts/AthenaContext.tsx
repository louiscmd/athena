import React, {
  createContext, useContext, useEffect, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import { initDatabase, saveMessage, getSettings, saveSettings } from '@/lib/database';
import { requestNotificationPermission } from '@/lib/notifications';
import type { AthenaMode, AthenaSettings, Message } from '@/types';

interface AthenaContextValue {
  // State
  mode: AthenaMode;
  messages: Message[];
  settings: AthenaSettings;
  initialized: boolean;
  amplitude: number;

  // Setters
  setMode: (mode: AthenaMode) => void;
  setAmplitude: (v: number) => void;
  addMessage: (msg: Omit<Message, 'id'>) => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (s: AthenaSettings) => Promise<void>;
}

const AthenaContext = createContext<AthenaContextValue | null>(null);

const DEFAULT_SETTINGS: AthenaSettings = {
  userName: '',
  anthropicApiKey: '',
  openAiApiKey: '',
  googleClientId: '',
  spotifyClientId: '',
  youtubeApiKey: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '',
  voice: { speed: 1.0, pitch: 1.0, language: 'en-US' },
  currency: 'USD',
  notifications: {
    dailyBriefing: true,
    briefingTime: '08:00',
    taskReminders: true,
    habitReminders: true,
  },
  wakeWord: false,
  bufferAccessToken: '',
};

export function AthenaProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AthenaMode>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<AthenaSettings>(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const msgCounter = useRef(0);

  useEffect(() => {
    (async () => {
      await initDatabase();
      const s = await getSettings();
      setSettings(s);
      await requestNotificationPermission();
      setInitialized(true);
    })();
  }, []);

  // Reset mode when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        setMode('idle');
      }
    });
    return () => sub.remove();
  }, []);

  async function addMessage(msg: Omit<Message, 'id'>): Promise<void> {
    const id = `msg-${Date.now()}-${++msgCounter.current}`;
    const full: Message = { id, ...msg };
    setMessages(prev => [...prev.slice(-49), full]); // Keep last 50
    await saveMessage(msg);
  }

  async function loadSettings(): Promise<void> {
    const s = await getSettings();
    setSettings(s);
  }

  async function updateSettings(s: AthenaSettings): Promise<void> {
    await saveSettings(s);
    setSettings(s);
  }

  return (
    <AthenaContext.Provider value={{
      mode,
      messages,
      settings,
      initialized,
      amplitude,
      setMode,
      setAmplitude,
      addMessage,
      loadSettings,
      updateSettings,
    }}>
      {children}
    </AthenaContext.Provider>
  );
}

export function useAthena(): AthenaContextValue {
  const ctx = useContext(AthenaContext);
  if (!ctx) throw new Error('useAthena must be used within AthenaProvider');
  return ctx;
}
