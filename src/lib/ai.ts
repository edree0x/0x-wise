export type AiConfig = {
  baseUrl: string
  model: string
  apiKey: string
  provider: string
}

export function aiConfig(): AiConfig {
  return {
    baseUrl: (process.env.OXW_AI_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, ''),
    model: process.env.OXW_AI_MODEL || 'llama3.1:8b',
    apiKey: process.env.OXW_AI_API_KEY || '',
    provider: process.env.OXW_AI_PROVIDER || 'ollama',
  }
}

export async function chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]): Promise<string> {
  const config = aiConfig()
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
      max_tokens: 900,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`AI provider responded ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`)
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('AI provider returned an empty answer')
  return content
}

export function chunkText(text: string, size = 12_000): string {
  return text.length > size ? `${text.slice(0, size)}\n\n[...truncated]` : text
}
