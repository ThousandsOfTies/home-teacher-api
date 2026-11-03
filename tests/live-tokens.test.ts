import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import express from 'express'
import { firestoreTokenQuota, registerLiveTokenRoute } from '../src/liveTokens.ts'

const secret = 'a'.repeat(43), deviceId = 'robot-one'
const registry = JSON.stringify({ [deviceId]: {
  enabled: true, sha256: createHash('sha256').update(secret).digest('hex'),
} })

class AtomicDatabase {
  values = new Map<string, any>()
  pending: Promise<any> = Promise.resolve()
  collection(name: string) { assert.equal(name, 'liveTokenUsage'); return { doc: (id: string) => id } }
  runTransaction(work: any) {
    const result = this.pending.then(() => work({
      get: async (id: string) => ({ data: () => this.values.get(id) }),
      set: (id: string, value: any) => this.values.set(id, value),
    }))
    this.pending = result.catch(() => {})
    return result
  }
}

async function fixture(t: any, settings: any = {}) {
  const app = express(), requests: any[] = [], database = settings.database || new AtomicDatabase()
  const issuer = { authTokens: { create: async (value: any) => {
    requests.push(value)
    if (settings.providerError) throw new Error('SECRET-API-KEY must not escape')
    return { name: 'auth_tokens/fake-live-token' }
  } } }
  registerLiveTokenRoute(app, issuer, { registry: () => settings.registry ?? registry,
    quota: () => { if (settings.quotaError) throw new Error('ADC unavailable'); return firestoreTokenQuota(database) },
    clock: () => 1_800_000_000_000, model: () => 'gemini-3.8-live' })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/live/token`
  const send = (body = '{}', authorization = `Bearer ${deviceId}.${secret}`) => fetch(url, {
    method: 'POST', headers: { authorization, 'Content-Type': 'application/json' }, body,
  })
  return { send, requests, database }
}

test('authenticated devices get one-use, model-restricted short-lived credentials without the API key', async t => {
  const f = await fixture(t), response = await f.send(), result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(result.token, 'auth_tokens/fake-live-token')
  assert.equal(result.model, 'gemini-3.8-live')
  assert.equal(result.apiVersion, 'v1alpha')
  assert.equal(Date.parse(result.expiresAt) - Date.parse(result.newSessionExpiresAt), 29 * 60_000)
  assert.deepEqual(f.requests[0].config.liveConnectConstraints,
    { model: 'gemini-3.8-live', config: { responseModalities: ['AUDIO'] } })
  assert.equal(f.requests[0].config.uses, 1)
  assert.equal(f.requests[0].config.httpOptions.timeout, 15_000)
  assert.ok(!JSON.stringify(result).includes(secret))
})

test('bad, revoked and unconfigured credentials cannot cause a provider or quota call', async t => {
  for (const settings of [{}, { registry: '{}' }, { registry: '{broken' },
    { registry: registry.replace('true', 'false') }]) {
    const f = await fixture(t, settings)
    for (const authorization of ['', 'Bearer invalid', `Bearer unknown.${secret}`,
      `Bearer ${deviceId}.${'b'.repeat(43)}`]) {
      const response = await f.send('x'.repeat(10_000), authorization)
      assert.ok([401, 503].includes(response.status))
    }
    assert.equal(f.requests.length, 0)
    assert.equal(f.database.values.size, 0)
  }
})

test('the complete request is bounded and clients cannot choose models or configuration', async t => {
  const f = await fixture(t)
  for (const body of ['[]', 'null', '{broken', '{"model":"other-model"}', '{"uses":0}']) {
    assert.equal((await f.send(body)).status, 400)
  }
  assert.equal((await f.send(JSON.stringify({ content: 'x'.repeat(2000) }))).status, 413)
  assert.equal(f.requests.length, 0)
})

test('Cloud Run instances share an atomic device limit and return Retry-After', async t => {
  const database = new AtomicDatabase(), first = await fixture(t, { database }), second = await fixture(t, { database })
  const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? first : second).send()))
  assert.equal(responses.filter(response => response.status === 200).length, 4)
  assert.equal(responses.filter(response => response.status === 429).length, 4)
  assert.equal(responses.find(response => response.status === 429)!.headers.get('retry-after'), '60')
  assert.equal(first.requests.length + second.requests.length, 4)
})

test('hourly limits survive recreated quota adapters and are isolated per device', async () => {
  const database = new AtomicDatabase()
  for (let i = 0; i < 30; i++) assert.equal(await firestoreTokenQuota(database).take(deviceId, i * 60_000), true)
  assert.equal(await firestoreTokenQuota(database).take(deviceId, 30 * 60_000), false)
  assert.equal(await firestoreTokenQuota(database).take('robot-two', 30 * 60_000), true)
  assert.equal(await firestoreTokenQuota(database).take(deviceId, 3_600_000), true)
})

test('upstream and quota failures remain closed and do not expose provider errors', async t => {
  for (const settings of [{ providerError: true }, { quotaError: true }]) {
    const f = await fixture(t, settings), response = await f.send(), text = await response.text()
    assert.equal(response.status, settings.quotaError ? 503 : 502)
    assert.ok(!text.includes('SECRET-API-KEY') && !text.includes(secret))
  }
})
