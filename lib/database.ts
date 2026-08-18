import * as SQLite from 'expo-sqlite';
import type {
  Task, CalendarEvent, Habit, FinanceEntry, Goal, Note,
  AthenaSettings, Message,
} from '@/types';

const DB_NAME = 'athena.db';
let db: SQLite.SQLiteDatabase | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      dueDate INTEGER,
      dueTime TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'personal',
      completed INTEGER NOT NULL DEFAULT 0,
      notificationId TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      location TEXT,
      color TEXT,
      recurring TEXT DEFAULT 'none',
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      frequency TEXT NOT NULL DEFAULT 'daily',
      targetDays TEXT,
      icon TEXT NOT NULL DEFAULT '✅',
      color TEXT NOT NULL DEFAULT '#00d4ff',
      streak INTEGER NOT NULL DEFAULT 0,
      bestStreak INTEGER NOT NULL DEFAULT 0,
      completedDates TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      category TEXT NOT NULL DEFAULT 'other',
      description TEXT NOT NULL,
      date INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      timeframe TEXT NOT NULL DEFAULT 'month',
      targetDate INTEGER,
      progress INTEGER NOT NULL DEFAULT 0,
      milestones TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      icon TEXT NOT NULL DEFAULT '🎯',
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(msg: Omit<Message, 'id'>): Promise<Message> {
  const id = uid();
  await getDb().runAsync(
    'INSERT INTO messages (id, role, content, timestamp) VALUES (?, ?, ?, ?)',
    id, msg.role, msg.content, msg.timestamp,
  );
  return { id, ...msg };
}

export async function getRecentMessages(limit = 20): Promise<Message[]> {
  const rows = await getDb().getAllAsync<Message>(
    'SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?', limit,
  );
  return rows.reverse();
}

export async function clearMessages(): Promise<void> {
  await getDb().runAsync('DELETE FROM messages');
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(data: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const task: Task = { id: uid(), createdAt: Date.now(), ...data };
  await getDb().runAsync(
    `INSERT INTO tasks (id, title, description, dueDate, dueTime, priority, category, completed, notificationId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    task.id, task.title, task.description ?? null, task.dueDate ?? null,
    task.dueTime ?? null, task.priority, task.category,
    task.completed ? 1 : 0, task.notificationId ?? null, task.createdAt,
  );
  return task;
}

export async function getTasks(includeCompleted = false): Promise<Task[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    includeCompleted
      ? 'SELECT * FROM tasks ORDER BY dueDate ASC, createdAt ASC'
      : 'SELECT * FROM tasks WHERE completed = 0 ORDER BY dueDate ASC, createdAt ASC',
  );
  return rows.map(deserializeTask);
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  const fields = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([k]) => `${k} = ?`)
    .join(', ');
  const values = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([, v]) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
  await getDb().runAsync(`UPDATE tasks SET ${fields} WHERE id = ?`, ...values, id);
}

export async function deleteTask(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM tasks WHERE id = ?', id);
}

function deserializeTask(row: Record<string, unknown>): Task {
  return {
    ...row,
    completed: row.completed === 1,
  } as Task;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function createEvent(data: Omit<CalendarEvent, 'id' | 'createdAt'>): Promise<CalendarEvent> {
  const event: CalendarEvent = { id: uid(), createdAt: Date.now(), ...data };
  await getDb().runAsync(
    `INSERT INTO events (id, title, description, startTime, endTime, location, color, recurring, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.id, event.title, event.description ?? null,
    event.startTime, event.endTime, event.location ?? null,
    event.color ?? null, event.recurring ?? 'none', event.createdAt,
  );
  return event;
}

export async function getEvents(from: number, to: number): Promise<CalendarEvent[]> {
  return getDb().getAllAsync<CalendarEvent>(
    'SELECT * FROM events WHERE startTime >= ? AND startTime <= ? ORDER BY startTime ASC', from, to,
  );
}

export async function deleteEvent(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM events WHERE id = ?', id);
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export async function createHabit(data: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak' | 'completedDates'>): Promise<Habit> {
  const habit: Habit = {
    id: uid(), createdAt: Date.now(), streak: 0, bestStreak: 0, completedDates: [], ...data,
  };
  await getDb().runAsync(
    `INSERT INTO habits (id, name, description, frequency, targetDays, icon, color, streak, bestStreak, completedDates, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    habit.id, habit.name, habit.description ?? null, habit.frequency,
    JSON.stringify(habit.targetDays ?? []), habit.icon, habit.color,
    habit.streak, habit.bestStreak, JSON.stringify(habit.completedDates), habit.createdAt,
  );
  return habit;
}

export async function getHabits(): Promise<Habit[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>('SELECT * FROM habits ORDER BY createdAt ASC');
  return rows.map(r => ({
    ...r,
    targetDays: JSON.parse(r.targetDays as string ?? '[]'),
    completedDates: JSON.parse(r.completedDates as string ?? '[]'),
  } as Habit));
}

export async function updateHabit(id: string, data: Partial<Habit>): Promise<void> {
  const serialized: Record<string, unknown> = { ...data };
  if (data.completedDates) serialized.completedDates = JSON.stringify(data.completedDates);
  if (data.targetDays) serialized.targetDays = JSON.stringify(data.targetDays);
  const fields = Object.keys(serialized).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
  const values = Object.entries(serialized).filter(([k]) => k !== 'id').map(([, v]) => v);
  await getDb().runAsync(`UPDATE habits SET ${fields} WHERE id = ?`, ...values, id);
}

export async function deleteHabit(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM habits WHERE id = ?', id);
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export async function createFinanceEntry(data: Omit<FinanceEntry, 'id' | 'createdAt'>): Promise<FinanceEntry> {
  const entry: FinanceEntry = { id: uid(), createdAt: Date.now(), ...data };
  await getDb().runAsync(
    `INSERT INTO finance (id, type, amount, currency, category, description, date, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id, entry.type, entry.amount, entry.currency,
    entry.category, entry.description, entry.date, entry.createdAt,
  );
  return entry;
}

export async function getFinanceEntries(limit = 50): Promise<FinanceEntry[]> {
  return getDb().getAllAsync<FinanceEntry>(
    'SELECT * FROM finance ORDER BY date DESC LIMIT ?', limit,
  );
}

export async function deleteFinanceEntry(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM finance WHERE id = ?', id);
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function createGoal(data: Omit<Goal, 'id' | 'createdAt' | 'progress' | 'milestones' | 'status'>): Promise<Goal> {
  const goal: Goal = {
    id: uid(), createdAt: Date.now(), progress: 0, milestones: [], status: 'active', ...data,
  };
  await getDb().runAsync(
    `INSERT INTO goals (id, title, description, timeframe, targetDate, progress, milestones, status, icon, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    goal.id, goal.title, goal.description ?? null, goal.timeframe,
    goal.targetDate ?? null, goal.progress, JSON.stringify(goal.milestones),
    goal.status, goal.icon, goal.createdAt,
  );
  return goal;
}

export async function getGoals(): Promise<Goal[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>('SELECT * FROM goals ORDER BY createdAt DESC');
  return rows.map(r => ({
    ...r,
    milestones: JSON.parse(r.milestones as string ?? '[]'),
  } as Goal));
}

export async function updateGoal(id: string, data: Partial<Goal>): Promise<void> {
  const serialized: Record<string, unknown> = { ...data };
  if (data.milestones) serialized.milestones = JSON.stringify(data.milestones);
  const fields = Object.keys(serialized).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
  const values = Object.entries(serialized).filter(([k]) => k !== 'id').map(([, v]) => v);
  await getDb().runAsync(`UPDATE goals SET ${fields} WHERE id = ?`, ...values, id);
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function createNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
  const now = Date.now();
  const note: Note = { id: uid(), createdAt: now, updatedAt: now, ...data };
  await getDb().runAsync(
    `INSERT INTO notes (id, title, content, tags, pinned, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    note.id, note.title, note.content, JSON.stringify(note.tags),
    note.pinned ? 1 : 0, note.createdAt, note.updatedAt,
  );
  return note;
}

export async function getNotes(): Promise<Note[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM notes ORDER BY pinned DESC, updatedAt DESC',
  );
  return rows.map(r => ({
    ...r,
    tags: JSON.parse(r.tags as string ?? '[]'),
    pinned: r.pinned === 1,
  } as Note));
}

export async function updateNote(id: string, data: Partial<Note>): Promise<void> {
  const serialized: Record<string, unknown> = { ...data, updatedAt: Date.now() };
  if (data.tags) serialized.tags = JSON.stringify(data.tags);
  if (typeof data.pinned === 'boolean') serialized.pinned = data.pinned ? 1 : 0;
  const fields = Object.keys(serialized).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
  const values = Object.entries(serialized).filter(([k]) => k !== 'id').map(([, v]) => v);
  await getDb().runAsync(`UPDATE notes SET ${fields} WHERE id = ?`, ...values, id);
}

export async function deleteNote(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM notes WHERE id = ?', id);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AthenaSettings = {
  userName: '',
  anthropicApiKey: '',
  openAiApiKey: '',
  googleClientId: '',
  spotifyClientId: '',
  voice: { speed: 1.0, pitch: 1.0, language: 'en-US' },
  currency: 'USD',
  notifications: {
    dailyBriefing: true,
    briefingTime: '08:00',
    taskReminders: true,
    habitReminders: true,
  },
  wakeWord: false,
};

export async function getSettings(): Promise<AthenaSettings> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'config'",
  );
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
}

export async function saveSettings(settings: AthenaSettings): Promise<void> {
  await getDb().runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('config', ?)",
    JSON.stringify(settings),
  );
}

// ─── Context for AI ───────────────────────────────────────────────────────────

export async function getAthenaContext(): Promise<string> {
  const [tasks, habits, goals, notes, entries] = await Promise.all([
    getTasks(),
    getHabits(),
    getGoals(),
    getNotes(),
    getFinanceEntries(10),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const upcomingTasks = tasks
    .filter(t => !t.completed)
    .slice(0, 5)
    .map(t => `- ${t.title}${t.dueDate ? ` (due ${new Date(t.dueDate).toDateString()})` : ''}`)
    .join('\n');

  const todaysHabits = habits
    .map(h => {
      const done = h.completedDates.includes(today);
      return `- ${h.icon} ${h.name}: ${done ? '✓ done' : 'pending'} (streak: ${h.streak})`;
    })
    .join('\n');

  const activeGoals = goals
    .filter(g => g.status === 'active')
    .map(g => `- ${g.icon} ${g.title} (${g.progress}% complete)`)
    .join('\n');

  const recentNotes = notes.slice(0, 3)
    .map(n => `- "${n.title}"`)
    .join('\n');

  return `
UPCOMING TASKS:
${upcomingTasks || 'None'}

TODAY'S HABITS:
${todaysHabits || 'No habits set up'}

ACTIVE GOALS:
${activeGoals || 'No goals yet'}

RECENT NOTES:
${recentNotes || 'No notes'}
`.trim();
}
