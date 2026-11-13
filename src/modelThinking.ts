import { ThinkingLevel, type ThinkingConfig } from '@google/genai'

// Keep Flash and Hydrogen at LOW for comparable latency and reasoning spend.
// Older models retain their existing budget behavior.
export function getThinkingConfig(model: string): ThinkingConfig {
  if (/^gemini-(3[.-]|4[.-])/.test(model)) return { thinkingLevel: ThinkingLevel.LOW }
  return { thinkingBudget: model.startsWith('gemini-2.5-pro') ? 128 : 0 }
}

export function getOptionalThinkingConfig(model: string) {
  return /^gemini-(3[.-]|4[.-])/.test(model)
    ? { thinkingConfig: getThinkingConfig(model) }
    : {}
}
