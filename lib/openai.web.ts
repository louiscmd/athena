// OpenAI / ChatGPT integration — web only
// Used by Athena to fetch current info, facts, and knowledge that Claude may not have.

const API = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o';

/**
 * Query ChatGPT with a question and get a concise factual answer.
 * Athena uses this when she needs current info, factual research,
 * or a second knowledge source.
 */
export async function queryChatGPT(
  question: string,
  apiKey: string,
  systemHint = 'You are a helpful research assistant. Answer concisely in 2-4 sentences. Focus on facts and current information.',
): Promise<string> {
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemHint },
        { role: 'user',   content: question },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Detect whether a message explicitly requests external research.
 * CONSERVATIVE — only fires on clear lookup/research intent.
 * Routine commands ("add a task", "what do I have today", "schedule a meeting") do NOT trigger this.
 */
export function needsResearch(message: string): boolean {
  const m = message.toLowerCase();
  // Only trigger on explicit research / lookup intent:
  const triggers = [
    'search for ', 'look up ', 'find out ', 'look up ',
    'ask chatgpt', 'ask gpt', 'google ',
    'research ', 'search the web', 'browse ',
    'latest news', 'current news', 'news about ',
    'stock price', 'price of bitcoin', 'crypto price',
    'what\'s the weather', 'weather in ', 'weather forecast',
  ];
  return triggers.some(t => m.includes(t));
}
