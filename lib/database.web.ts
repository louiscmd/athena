// Web implementation of the database using localStorage + Supabase cloud sync
// Mirrors the exact same API as database.ts (SQLite) so all imports work on both platforms

import type {
  Task, CalendarEvent, Habit, FinanceEntry, Goal, Note,
  AthenaSettings, Message,
} from '@/types';
import { scheduleSyncToCloud } from './sync';

// ─── Generic localStorage store ───────────────────────────────────────────────

function getStore<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch { return []; }
}

function setStore<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Init (no-op on web) ──────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  // Nothing to init — localStorage is always available
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(msg: Omit<Message, 'id'>): Promise<Message> {
  const messages = getStore<Message>('messages');
  const full: Message = { id: uid(), ...msg };
  messages.push(full);
  // Keep last 100
  setStore('messages', messages.slice(-100));
  return full;
}

export async function getRecentMessages(limit = 20): Promise<Message[]> {
  const messages = getStore<Message>('messages');
  return messages.slice(-limit);
}

export async function clearMessages(): Promise<void> {
  localStorage.removeItem('messages');
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(data: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const tasks = getStore<Task>('tasks');
  const task: Task = { id: uid(), createdAt: Date.now(), ...data };
  tasks.push(task);
  setStore('tasks', tasks);
  scheduleSyncToCloud();
  return task;
}

export async function getTasks(includeCompleted = false): Promise<Task[]> {
  const tasks = getStore<Task>('tasks');
  return includeCompleted ? tasks : tasks.filter(t => !t.completed);
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  const tasks = getStore<Task>('tasks');
  setStore('tasks', tasks.map(t => t.id === id ? { ...t, ...data } : t));
  scheduleSyncToCloud();
}

export async function deleteTask(id: string): Promise<void> {
  setStore('tasks', getStore<Task>('tasks').filter(t => t.id !== id));
  scheduleSyncToCloud();
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function createEvent(data: Omit<CalendarEvent, 'id' | 'createdAt'>): Promise<CalendarEvent> {
  const events = getStore<CalendarEvent>('events');
  const event: CalendarEvent = { id: uid(), createdAt: Date.now(), ...data };
  events.push(event);
  setStore('events', events);
  scheduleSyncToCloud();
  return event;
}

export async function getEvents(from: number, to: number): Promise<CalendarEvent[]> {
  return getStore<CalendarEvent>('events')
    .filter(e => e.startTime >= from && e.startTime <= to)
    .sort((a, b) => a.startTime - b.startTime);
}

export async function deleteEvent(id: string): Promise<void> {
  setStore('events', getStore<CalendarEvent>('events').filter(e => e.id !== id));
  scheduleSyncToCloud();
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export async function createHabit(data: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak' | 'completedDates'>): Promise<Habit> {
  const habits = getStore<Habit>('habits');
  const habit: Habit = { id: uid(), createdAt: Date.now(), streak: 0, bestStreak: 0, completedDates: [], ...data };
  habits.push(habit);
  setStore('habits', habits);
  scheduleSyncToCloud();
  return habit;
}

export async function getHabits(): Promise<Habit[]> {
  return getStore<Habit>('habits');
}

export async function updateHabit(id: string, data: Partial<Habit>): Promise<void> {
  setStore('habits', getStore<Habit>('habits').map(h => h.id === id ? { ...h, ...data } : h));
  scheduleSyncToCloud();
}

export async function deleteHabit(id: string): Promise<void> {
  setStore('habits', getStore<Habit>('habits').filter(h => h.id !== id));
  scheduleSyncToCloud();
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export async function createFinanceEntry(data: Omit<FinanceEntry, 'id' | 'createdAt'>): Promise<FinanceEntry> {
  const entries = getStore<FinanceEntry>('finance');
  const entry: FinanceEntry = { id: uid(), createdAt: Date.now(), ...data };
  entries.push(entry);
  setStore('finance', entries);
  scheduleSyncToCloud();
  return entry;
}

export async function getFinanceEntries(limit = 50): Promise<FinanceEntry[]> {
  return getStore<FinanceEntry>('finance')
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);
}

export async function deleteFinanceEntry(id: string): Promise<void> {
  setStore('finance', getStore<FinanceEntry>('finance').filter(e => e.id !== id));
  scheduleSyncToCloud();
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function createGoal(data: Omit<Goal, 'id' | 'createdAt' | 'progress' | 'milestones' | 'status'>): Promise<Goal> {
  const goals = getStore<Goal>('goals');
  const goal: Goal = { id: uid(), createdAt: Date.now(), progress: 0, milestones: [], status: 'active', ...data };
  goals.push(goal);
  setStore('goals', goals);
  scheduleSyncToCloud();
  return goal;
}

export async function getGoals(): Promise<Goal[]> {
  return getStore<Goal>('goals').sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateGoal(id: string, data: Partial<Goal>): Promise<void> {
  setStore('goals', getStore<Goal>('goals').map(g => g.id === id ? { ...g, ...data } : g));
  scheduleSyncToCloud();
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function createNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
  const notes = getStore<Note>('notes');
  const now = Date.now();
  const note: Note = { id: uid(), createdAt: now, updatedAt: now, ...data };
  notes.push(note);
  setStore('notes', notes);
  scheduleSyncToCloud();
  return note;
}

export async function getNotes(): Promise<Note[]> {
  return getStore<Note>('notes')
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
}

export async function updateNote(id: string, data: Partial<Note>): Promise<void> {
  setStore('notes', getStore<Note>('notes').map(n => n.id === id ? { ...n, ...data, updatedAt: Date.now() } : n));
  scheduleSyncToCloud();
}

export async function deleteNote(id: string): Promise<void> {
  setStore('notes', getStore<Note>('notes').filter(n => n.id !== id));
  scheduleSyncToCloud();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AthenaSettings = {
  userName: '',
  anthropicApiKey: '',
  openAiApiKey: '',
  googleClientId: '',
  spotifyClientId: '',
  youtubeApiKey: '',
  voice: { speed: 1.0, pitch: 1.0, language: 'en-US' },
  currency: 'USD',
  notifications: { dailyBriefing: true, briefingTime: '08:00', taskReminders: true, habitReminders: true },
  wakeWord: false,
};

export async function getSettings(): Promise<AthenaSettings> {
  try {
    const raw = localStorage.getItem('settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as AthenaSettings } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export async function saveSettings(settings: AthenaSettings): Promise<void> {
  localStorage.setItem('settings', JSON.stringify(settings));
  scheduleSyncToCloud();
}

// ─── Context for AI ───────────────────────────────────────────────────────────

export async function getAthenaContext(): Promise<string> {
  const [tasks, habits, goals, notes, entries] = await Promise.all([
    getTasks(), getHabits(), getGoals(), getNotes(), getFinanceEntries(10),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const upcomingTasks = tasks.slice(0, 5)
    .map(t => `- ${t.title}${t.dueDate ? ` (due ${new Date(t.dueDate).toDateString()})` : ''}`)
    .join('\n');

  const todaysHabits = habits
    .map(h => `- ${h.icon} ${h.name}: ${h.completedDates.includes(today) ? '✓ done' : 'pending'} (streak: ${h.streak})`)
    .join('\n');

  const activeGoals = goals.filter(g => g.status === 'active')
    .map(g => `- ${g.icon} ${g.title} (${g.progress}% complete)`)
    .join('\n');

  const recentNotes = notes.slice(0, 3).map(n => `- "${n.title}"`).join('\n');

  return `
UPCOMING TASKS:\n${upcomingTasks || 'None'}
TODAY'S HABITS:\n${todaysHabits || 'No habits set up'}
ACTIVE GOALS:\n${activeGoals || 'No goals yet'}
RECENT NOTES:\n${recentNotes || 'No notes'}
`.trim();
}
