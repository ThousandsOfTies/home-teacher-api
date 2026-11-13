import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getThinkingConfig, getOptionalThinkingConfig } from '../src/modelThinking.ts'

test('Flash and Hydrogen use LOW without legacy thinking budgets', () => {
  for (const model of ['gemini-3.8-flash', 'gemini-4-hydrogen']) {
    assert.deepEqual(getThinkingConfig(model), { thinkingLevel: 'LOW' })
    assert.deepEqual(getOptionalThinkingConfig(model), { thinkingConfig: { thinkingLevel: 'LOW' } })
  }
})
test('legacy model budgets and optional configuration remain compatible', () => {
  assert.deepEqual(getThinkingConfig('gemini-2.5-pro'), { thinkingBudget: 128 })
  assert.deepEqual(getThinkingConfig('gemini-2.5-flash'), { thinkingBudget: 0 })
  assert.deepEqual(getOptionalThinkingConfig('gemini-2.5-pro'), {})
})
