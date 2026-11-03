# Headless devices and Gemini Live

`POST /api/live/token` reuses this API's Cloud Run deployment, Gemini client,
Secret Manager key and Firebase Admin/Firestore connection. It has no grading,
payment or robot-motion behavior. Existing frontend routes retain their contracts.

Register each device once. The device holds an independent random credential,
not the Gemini API key. Keep the JSON profile private and out of Git. The
`LIVE_DEVICE_REGISTRY` secret contains only device IDs, enabled flags and SHA-256
hashes of the device credentials. The API compares them in constant time.

```sh
node scripts/register-live-device.mjs --id penguin-orangepi-zero2w \
  --url https://SERVICE_URL/api/live/token \
  --output /private/device.json --registry-output /private/registry.json
```

When adding devices, pass an existing registry with `--registry-input`; the tool
retains its entries and rejects replacement of an existing ID. It never prints
device credentials. Set device profiles to owner-only access (Linux mode 0600;
use an equivalent private ACL on Windows). Provisioning output is never uploaded
with application source.

Create a Secret Manager version from the hash registry, grant the existing Cloud
Run service identity access to it, and add the `LIVE_DEVICE_REGISTRY` secret
reference to staging. Use the normal API CI/deployment sequence and verify staging
before production. The existing `GEMINI_API_KEY` secret is reused without exporting
its value. `LIVE_MODEL` optionally selects one server-controlled Live model;
the default is `gemini-3.8-live`.

The device sends `Authorization: Bearer DEVICE_ID.DEVICE_SECRET` with an empty JSON
object. Unauthorized callers cannot reach Gemini or Firestore. Requests are
bounded to 1 KB after authentication. Clients cannot select a different model,
session lifetime or use count. Responses have `Cache-Control: no-store`.

The response has `token`, `model`, `apiVersion`, `expiresAt` and
`newSessionExpiresAt`. The token is single-use, model-restricted, AUDIO-only,
valid for at most 30 minutes, with 60 seconds to begin the session. The pinned
Google SDK's `v1alpha` constrained Live endpoint is used. This experimental API
must be checked against the actual Google service when updating the SDK/model.

Firestore collection `liveTokenUsage` implements atomic per-device limits of
4 token requests per minute and 30 per hour across Cloud Run instances. This is
a session issuance limit, not a hard currency-spending cap. Firebase/ADC failures
fail closed. Disabled credentials require deploying the updated registry version;
already-issued tokens remain valid until their expiration.

Response codes: 400 malformed request, 401 unknown/disabled device, 413 oversized
body, 429 issuance limit (Retry-After: 60), 502 Gemini unavailable, 503 registry or
quota unavailable. API/provider error text and tokens are never logged.

The device obtains a fresh token after disconnection or expiry, then streams
audio directly to Gemini. Audio and robot commands do not pass through this API.
