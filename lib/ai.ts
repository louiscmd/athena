import Anthropic from '@anthropic-ai/sdk';
import { getSettings, getAthenaContext, getRecentMessages } from './database';
import type { AthenaResponse } from '@/types';

const MODEL = 'claude-sonnet-5-20251101';

function buildSystemPrompt(userName: string, context: string): string {
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

BEHAVIORAL RULES:
1. Keep responses SHORT (2-4 sentences max) — this is a voice interface.
2. Always be proactive — if you notice something in the user's data, mention it naturally.
3. When scheduling or creating items, ALWAYS respond with a JSON action block so the app can execute it.
4. Address the user by name occasionally, but not every time.
5. If you don't have enough info to complete a request, ask one clarifying question.
6. For financial questions, always specify currency.
7. Be encouraging about goals and habits without being patronizing.
8. You remember everything in the context above — reference it naturally.

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

EXAMPLES:
User: "Schedule a team meeting for tomorrow at 2 PM"
→ { "reply": "Done — I've added your team meeting for tomorrow at 2 PM.", "actions": [{ "type": "create_event", "data": { "title": "Team Meeting", "startTime": ..., "endTime": ... } }] }

User: "I spent $45 on groceries today"
→ { "reply": "Logged — $45 for groceries.", "actions": [{ "type": "add_finance", "data": { "type": "expense", "amount": 45, "category": "food", "description": "Groceries", "date": ... } }] }

User: "What's on my plate today?"
→ { "reply": "You have 3 tasks due today..." }`;
}

export async function askAthena(userMessage: string): Promise<AthenaResponse> {
  const settings = await getSettings();

  if (!settings.anthropicApiKey) {
    return {
      reply: "I need an API key to function. Please go to Settings and add your Anthropic API key.",
    };
  }

  const client = new Anthropic({ apiKey: settings.anthropicApiKey });
  const context = await getAthenaContext();
  const history = await getRecentMessages(10);

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
      system: buildSystemPrompt(settings.userName, context),
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
