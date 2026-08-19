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
 * Detect whether a message likely needs external knowledge / research.
 * Heuristic: questions about current events, prices, people, facts, "what is", etc.
 */
export function needsResearch(message: string): boolean {
  const m = message.toLowerCase();
  const triggers = [
    'what is ', 'what are ', 'who is ', 'who are ',
    'how much ', 'how many ', 'when did ', 'when is ',
    'current ', 'latest ', 'recent ', 'today ',
    'news ', 'price of ', 'cost of ',
    'tell me about ', 'explain ', 'define ',
    'search ', 'look up ', 'find out ',
    'ask chatgpt', 'ask gpt', 'google ',
    'weather', 'stock', 'currency',
  ];
  return triggers.some(t => m.includes(t));
}
