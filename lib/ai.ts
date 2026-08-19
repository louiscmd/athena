import Anthropic from '@anthropic-ai/sdk';
import { getSettings, getAthenaContext, getRecentMessages } from './database';
import type { AthenaResponse } from '@/types';

// Dynamic import of OpenAI helper (web only — no-op on native)
let _queryChatGPT: ((q: string, key: string) => Promise<string>) | null = null;
let _needsResearch: ((msg: string) => boolean) | null = null;
if (typeof window !== 'undefined') {
  import('./openai.web').then(m => {
    _queryChatGPT  = m.queryChatGPT;
    _needsResearch = m.needsResearch;
  }).catch(() => {});
}

const MODEL = 'claude-sonnet-5-20251101';

function buildSystemPrompt(userName: string, context: string, shouldGreet = false): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  return `You are Athena, an advanced personal AI assistant — think JARVIS from Iron Man, but warmer and more personal. You are precise, calm, helpful, and speak in a concise, confident way suited for voice interaction.

CURRENT DATE: ${dateStr}
CURRENT TIME: ${timeStr}
USER'S NAME: ${userName || 'there'}

${context}

GREETING RULE:
${shouldGreet
  ? `Start your reply with "Hello ${userName || 'there'}." — this is the first interaction in over an hour.`
  : `Do NOT start with any greeting ("Hello", "Hi", "Hey", etc.) — the user already said hi recently. Jump straight to the answer.`
}

BEHAVIORAL RULES:
1. Keep responses SHORT (2-4 sentences max) — this is a voice interface. Never use bullet points or markdown.
2. Speak naturally and conversationally, as if talking to a real person.
3. When scheduling or creating items, ALWAYS respond with a JSON action block so the app can execute it.
4. If you don't have enough info to complete a request, ask one clarifying question.
5. For financial questions, always specify currency.
6. Be encouraging about goals and habits without being patronizing.
7. You remember everything in the context above — reference it naturally.

RESPONSE FORMAT:
Always respond in this JSON format (the "reply" is what you speak aloud):

{
  "reply": "Your spoken response here.",
  "actions": [
    // Optional — include only when creating/updating/deleting data
    {
      "type": "create_task",
      "data": {
        "title": "Task title",
        "priority": "medium",
        "category": "personal",
        "dueDate": 1700000000000,
        "dueTime": "09:00"
      }
    }
  ]
}

AVAILABLE ACTION TYPES:
- create_task: { title, description?, priority, category, dueDate?, dueTime? }
- create_event: { title, description?, startTime, endTime, location?, color? }
- create_habit: { name, frequency, icon, color, description? }
- create_goal: { title, description?, timeframe, targetDate?, icon }
- add_finance: { type, amount, currency, category, description, date }
- create_note: { title, content, tags?, pinned? }
- open_screen: { screen: "schedule"|"tasks"|"habits"|"finance"|"goals"|"notes" }
- schedule_post: { text, platform: "instagram"|"twitter"|"linkedin"|"facebook", scheduledAt? (ISO timestamp, omit = queue) }

CHATGPT RESEARCH:
If CHATGPT RESEARCH data is provided in the context, use it as a factual source to answer the user's question. Synthesize it naturally into your reply — don't say "according to ChatGPT".

EXAMPLES:
User: "Schedule a team meeting for tomorrow at 2 PM"
→ { "reply": "Done — I've added your team meeting for tomorrow at 2 PM.", "actions": [{ "type": "create_event", "data": { "title": "Team Meeting", "startTime": ..., "endTime": ... } }] }

User: "I spent $45 on groceries today"
→ { "reply": "Logged — $45 for groceries.", "actions": [{ "type": "add_finance", "data": { "type": "expense", "amount": 45, "category": "food", "description": "Groceries", "date": ... } }] }

User: "Schedule a post on Instagram saying we're launching next week"
→ { "reply": "Got it — queued that post for Instagram.", "actions": [{ "type": "schedule_post", "data": { "text": "We're launching next week! Stay tuned.", "platform": "instagram" } }] }

User: "What's on my plate today?"
→ { "reply": "You have 3 tasks due today..." }`;
}

// ─── Daily Brief ──────────────────────────────────────────────────────────────

export interface DailyBriefData {
  userName: string;
  todaysEvents: Array<{ title: string; startTime: number; endTime: number; location?: string }>;
  todaysTasks: Array<{ title: string; priority: string; completed: boolean }>;
  habits: Array<{ name: string; streak: number; completedToday: boolean }>;
  activeGoals: Array<{ title: string; progress: number; timeframe: string }>;
  financeThisWeek: { income: number; expenses: number; currency: string };
  recentNoteCount: number;
}

export async function generateDailyBrief(data: DailyBriefData, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const contextLines: string[] = [
    `TODAY'S EVENTS (${data.todaysEvents.length}):`,
    ...data.todaysEvents.map(e => {
      const t = new Date(e.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `  - ${e.title} at ${t}${e.location ? ` (${e.location})` : ''}`;
    }),
    data.todaysEvents.length === 0 ? '  No events scheduled.' : '',
    '',
    `TASKS DUE TODAY (${data.todaysTasks.filter(t => !t.completed).length} pending):`,
    ...data.todaysTasks.map(t => `  - [${t.completed ? 'done' : t.priority}] ${t.title}`),
    data.todaysTasks.length === 0 ? '  No tasks due today.' : '',
    '',
    `HABITS:`,
    ...data.habits.map(h => `  - ${h.name}: ${h.streak} day streak${h.completedToday ? ' (done today)' : ' (not done yet)'}`),
    data.habits.length === 0 ? '  No habits tracked yet.' : '',
    '',
    `ACTIVE GOALS (${data.activeGoals.length}):`,
    ...data.activeGoals.map(g => `  - ${g.title} — ${g.progress}% complete (${g.timeframe})`),
    '',
    `FINANCE THIS WEEK: +${data.financeThisWeek.income} income / -${data.financeThisWeek.expenses} expenses (${data.financeThisWeek.currency})`,
    '',
    `NOTES: ${data.recentNoteCount} notes in your library`,
  ].filter(l => l !== undefined);

  const prompt = `You are Athena, a personal AI assistant. Generate a natural, engaging morning briefing for ${data.userName || 'the user'}.

Current date and time: ${dateStr} at ${timeStr}

DATA:
${contextLines.join('\n')}

RULES:
- Speak in first person as Athena ("I see you have...", "Your habit streak is...")
- Be warm, concise, and energizing — like a smart assistant starting your day
- Mention the most important items first (high priority tasks, time-sensitive events)
- Comment on habit streaks if any are impressive (7+ days)
- Keep it between 120-180 words — natural spoken pace
- Do NOT use bullet points or markdown — write as flowing natural speech
- End with one short motivating sentence`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (err) {
    console.error('Daily brief generation error:', err);
    return `Good ${now.getHours() < 12 ? 'morning' : 'afternoon'}, ${data.userName || 'there'}. Here is your daily brief. You have ${data.todaysTasks.filter(t => !t.completed).length} tasks and ${data.todaysEvents.length} events today.`;
  }
}

export async function askAthena(
  userMessage: string,
  shouldGreet = false,
): Promise<AthenaResponse> {
  const settings = await getSettings();

  if (!settings.anthropicApiKey) {
    return {
      reply: "I need an API key to function. Please go to Settings and add your Anthropic API key.",
    };
  }

  const client = new Anthropic({
    apiKey: settings.anthropicApiKey,
    dangerouslyAllowBrowser: true, // required — this is a browser SPA
  });
  const context = await getAthenaContext();
  const history = await getRecentMessages(10);

  // ── ChatGPT research boost ─────────────────────────────────────────────────
  let researchContext = '';
  if (
    settings.openAiApiKey &&
    _queryChatGPT &&
    _needsResearch &&
    _needsResearch(userMessage)
  ) {
    try {
      const gptAnswer = await _queryChatGPT(userMessage, settings.openAiApiKey);
      if (gptAnswer) {
        researchContext = `\n\nCHATGPT RESEARCH (use this to answer factual questions):\n${gptAnswer}`;
      }
    } catch (e) {
      console.warn('ChatGPT research failed:', e);
    }
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: buildSystemPrompt(settings.userName, context + researchContext, shouldGreet),
      messages,
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AthenaResponse;
      return parsed;
    }

    // Fallback: treat as plain text reply
    return { reply: raw };
  } catch (err) {
    console.error('Athena AI error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { reply: `I encountered an error: ${msg}` };
  }
}
