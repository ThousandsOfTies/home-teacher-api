import { createHash, timingSafeEqual } from 'node:crypto'
import express from 'express'

export interface TokenQuota { take(deviceId: string, now: number): Promise<boolean> }
type TokenIssuer = { authTokens: { create(parameters: any): Promise<{ name?: string }> } }

/** Atomic counters are shared by Cloud Run instances and survive cold starts. */
export function firestoreTokenQuota(database: any): TokenQuota {
  return { async take(deviceId, now) {
    const ref = database.collection('liveTokenUsage').doc(deviceId)
    return database.runTransaction(async (transaction: any) => {
      const snapshot = await transaction.get(ref), saved = snapshot.data() || {}
      const minute = Math.floor(now / 60_000), hour = Math.floor(now / 3_600_000)
      const minuteCount = saved.minute === minute ? saved.minuteCount : 0
      const hourCount = saved.hour === hour ? saved.hourCount : 0
      if (![minuteCount, hourCount].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid quota')
      if (minuteCount >= 4 || hourCount >= 30) return false
      transaction.set(ref, { minute, hour, minuteCount: minuteCount + 1, hourCount: hourCount + 1 })
      return true
    })
  } }
}

/** A generic Live token endpoint; it contains no robot behavior or grading data. */
export function registerLiveTokenRoute(app: express.Express, issuer: TokenIssuer, options: {
  registry?: () => string, quota: () => TokenQuota, clock?: () => number, model?: () => string,
}): void {
  const registry = options.registry || (() => process.env.LIVE_DEVICE_REGISTRY || '{}')
  const clock = options.clock || Date.now
  app.post('/api/live/token', (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' })
    const match = /^Bearer ([a-z0-9][a-z0-9_-]{0,63})\.([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '')
    if (!match) { res.status(401).json({ error: 'unauthorized_device' }); return }
    try {
      const devices = JSON.parse(registry()), entry = Object.hasOwn(devices, match[1]) ? devices[match[1]] : undefined
      if (!entry || entry.enabled !== true || !/^[a-f0-9]{64}$/.test(entry.sha256 || '') ||
          !timingSafeEqual(createHash('sha256').update(match[2]).digest(), Buffer.from(entry.sha256, 'hex'))) {
        res.status(401).json({ error: 'unauthorized_device' }); return
      }
      res.locals.liveDeviceId = match[1]
      next()
    } catch { res.status(503).json({ error: 'device_registry_unavailable' }) }
  }, express.json({ limit: '1kb', strict: true }), async (req, res) => {
    if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).length) {
      res.status(400).json({ error: 'expected_empty_object' }); return
    }
    const model = options.model?.() || process.env.LIVE_MODEL || 'gemini-3.8-live'
    if (!/^gemini-[\w.-]{1,90}$/.test(model)) { res.status(503).json({ error: 'live_model_unavailable' }); return }
    const now = clock()
    try {
      if (!await options.quota().take(res.locals.liveDeviceId, now)) {
        res.set('Retry-After', '60').status(429).json({ error: 'device_rate_limited' }); return
      }
    } catch { res.status(503).json({ error: 'device_quota_unavailable' }); return }
    const expiresAt = new Date(now + 30 * 60_000).toISOString()
    const newSessionExpiresAt = new Date(now + 60_000).toISOString()
    try {
      // Match the pinned Google SDK's constrained Live endpoint (v1alpha).
      const token = await issuer.authTokens.create({ config: {
        httpOptions: { apiVersion: 'v1alpha', timeout: 15_000 }, uses: 1,
        expireTime: expiresAt, newSessionExpireTime: newSessionExpiresAt,
        liveConnectConstraints: { model, config: { responseModalities: ['AUDIO'] } },
      } })
      if (!token.name?.startsWith('auth_tokens/') || token.name.length > 8192) throw new Error('Invalid token')
      res.json({ token: token.name, model, apiVersion: 'v1alpha', expiresAt, newSessionExpiresAt })
    } catch {
      // SDK errors can include credential-bearing URLs; never return or log them.
      res.status(502).json({ error: 'live_token_unavailable' })
    }
  }, (error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: 'invalid_token_request' })
  })
}
