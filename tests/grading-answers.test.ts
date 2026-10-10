import assert from 'node:assert/strict'
import test from 'node:test'
import { validateAndOverrideGrading } from '../src/gradingAnswers.ts'

test('grading overrides require the whole answer to agree', () => {
  for (const [student, correct] of [
    ['2m', '2cm'], ['1/2', '1/3'], ['2024年', '2024人'],
    ['12abc', '12'], ['2', '3'], ['Co', 'CO'], ['オランダ', 'オラン'],
    ['1 2', '12'], ['2.00001', '2'], ['-2', '2'], ['2です', '2'],
  ]) assert.equal(validateAndOverrideGrading(student, correct), false, `${student} / ${correct}`)
})

test('typographic normalization preserves equivalent complete answers', () => {
  for (const [student, correct] of [['２ｍ', '2m'], [' Ａ ', 'A'], ['東京', '東京'], ['1/2', '1/2']]) {
    assert.equal(validateAndOverrideGrading(student, correct), true, `${student} / ${correct}`)
  }
})

test('missing or malformed answers never override an AI verdict', () => {
  for (const value of ['', '　', null, undefined, 2, {}, []]) {
    assert.equal(validateAndOverrideGrading(value, value), false)
    assert.equal(validateAndOverrideGrading(value, '2'), false)
  }
})
