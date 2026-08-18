// ─── Athena State ────────────────────────────────────────────────────────────

export type AthenaMode = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface Message {
  id: string;
  role: 'user' | 'athena';
  content: string;
  timestamp: number;
}

export interface AthenaAction {
  type:
    | 'create_task'
    | 'create_event'
    | 'create_habit'
    | 'create_goal'
    | 'add_finance'
    | 'create_note'
    | 'schedule_notification'
    | 'delete_item'
    | 'update_item'
    | 'open_screen';
  data: Record<string, unknown>;
}

export interface AthenaResponse {
  reply: string;
  actions?: AthenaAction[];
}

// ─── Schedule / Tasks ────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'personal' | 'work' | 'health' | 'finance' | 'other';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: number;       // Unix timestamp
  dueTime?: string;       // "HH:MM" format
  priority: TaskPriority;
  category: TaskCategory;
  completed: boolean;
  notificationId?: string;
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  location?: string;
  color?: string;
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: number;
}

// ─── Habits ──────────────────────────────────────────────────────────────────

export type HabitFrequency = 'daily' | 'weekly' | 'weekdays' | 'weekends';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  targetDays?: number[];   // For weekly: [1,3,5] = Mon, Wed, Fri
  icon: string;            // Emoji
  color: string;           // Hex
  streak: number;
  bestStreak: number;
  completedDates: string[]; // ISO date strings "YYYY-MM-DD"
  createdAt: number;
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export type FinanceType = 'income' | 'expense';
export type FinanceCategory =
  | 'food'
  | 'transport'
  | 'housing'
  | 'entertainment'
  | 'health'
  | 'shopping'
  | 'work'
  | 'savings'
  | 'other';

export interface FinanceEntry {
  id: string;
  type: FinanceType;
  amount: number;
  currency: string;
  category: FinanceCategory;
  description: string;
  date: number;
  createdAt: number;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export type GoalStatus = 'active' | 'completed' | 'paused';
export type GoalTimeframe = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  timeframe: GoalTimeframe;
  targetDate?: number;
  progress: number;          // 0–100
  milestones: Milestone[];
  status: GoalStatus;
  icon: string;              // Emoji
  createdAt: number;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AthenaSettings {
  userName: string;
  anthropicApiKey: string;
  openAiApiKey: string;     // Optional, for Whisper STT
  googleClientId: string;   // Google OAuth client ID
  spotifyClientId: string;  // Spotify app client ID (unused)
  youtubeApiKey: string;    // YouTube Data API v3 key
  voice: {
    speed: number;          // 0.5–2.0
    pitch: number;          // 0.5–2.0
    language: string;       // e.g. "en-US"
  };
  currency: string;         // e.g. "USD"
  notifications: {
    dailyBriefing: boolean;
    briefingTime: string;   // "HH:MM"
    taskReminders: boolean;
    habitReminders: boolean;
  };
  wakeWord: boolean;        // Not implemented in v1
}
