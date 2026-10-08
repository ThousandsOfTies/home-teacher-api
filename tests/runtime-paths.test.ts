import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { getServerPaths, loadServerEnvironment, resolveConfigFile } from '../src/runtimePaths.ts'

function fixture(t: test.TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), 'hometeacher-paths-'))
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()))
    assert.ok(path.basename(root).startsWith('hometeacher-paths-'))
    rmSync(root, { recursive: true, force: true })
  })
  const serverRoot = path.join(root, 'api')
  const appRoot = path.join(root, 'app')
  mkdirSync(path.join(serverRoot, 'src'), { recursive: true })
  mkdirSync(path.join(appRoot, 'server'), { recursive: true })
  return { root, serverRoot, appRoot, moduleUrl: pathToFileURL(path.join(serverRoot, 'src/index.ts')).href }
}

test('source and compiled entries resolve the same standalone API root', t => {
  const item = fixture(t)
  for (const entry of ['src/index.ts', 'dist/index.js']) {
    assert.deepEqual(getServerPaths(pathToFileURL(path.join(item.serverRoot, entry)).href),
      { serverRoot: item.serverRoot, legacyAppRoot: undefined })
  }
})

test('standalone API ignores unrelated parent and sibling environment files', t => {
  const item = fixture(t)
  writeFileSync(path.join(item.root, '.env'), 'UNRELATED=parent\n')
  writeFileSync(path.join(item.appRoot, '.env'), 'UNRELATED=app\n')
  writeFileSync(path.join(item.serverRoot, '.env'), 'KEY=api\n')
  const env: NodeJS.ProcessEnv = {}
  loadServerEnvironment(item.moduleUrl, env)
  assert.deepEqual(env, { KEY: 'api' })
})

test('deployed variables win, then API, then explicitly selected legacy server and app', t => {
  const item = fixture(t)
  writeFileSync(path.join(item.serverRoot, '.env'), 'EXISTING=api\nSHARED=api\n')
  writeFileSync(path.join(item.appRoot, 'server/.env'), 'EXISTING=server\nSHARED=server\nSERVER=kept\n')
  writeFileSync(path.join(item.appRoot, '.env'), 'EXISTING=app\nSERVER=app\nAPP=kept\n')
  const env: NodeJS.ProcessEnv = { EXISTING: 'deployed', HOME_TEACHER_LEGACY_APP_ROOT: item.appRoot }
  loadServerEnvironment(item.moduleUrl, env)
  assert.deepEqual(env, { EXISTING: 'deployed', HOME_TEACHER_LEGACY_APP_ROOT: item.appRoot,
    SHARED: 'api', SERVER: 'kept', APP: 'kept' })
})

test('existing app configuration still works without a new API environment file', t => {
  const item = fixture(t)
  writeFileSync(path.join(item.appRoot, 'server/.env'), 'KEY=legacy-server\n')
  writeFileSync(path.join(item.appRoot, '.env'), 'KEY=app\nAPP=kept\n')
  const env: NodeJS.ProcessEnv = { HOME_TEACHER_LEGACY_APP_ROOT: item.appRoot }
  loadServerEnvironment(item.moduleUrl, env)
  assert.equal(env.KEY, 'legacy-server')
  assert.equal(env.APP, 'kept')
})

test('Cloud Run starts without local files and retains injected settings', t => {
  const item = fixture(t)
  const env: NodeJS.ProcessEnv = { GEMINI_API_KEY: 'injected' }
  loadServerEnvironment(item.moduleUrl, env)
  assert.deepEqual(env, { GEMINI_API_KEY: 'injected' })
})

test('credential paths prefer the API, then selected legacy server, then app', t => {
  const item = fixture(t)
  const paths = getServerPaths(item.moduleUrl, item.appRoot)
  const legacy = path.join(item.appRoot, 'credentials.json')
  const legacyServer = path.join(item.appRoot, 'server/credentials.json')
  const current = path.join(item.serverRoot, 'credentials.json')
  writeFileSync(legacy, '{}')
  assert.equal(resolveConfigFile('credentials.json', paths), legacy)
  writeFileSync(legacyServer, '{}')
  assert.equal(resolveConfigFile('credentials.json', paths), legacyServer)
  writeFileSync(current, '{}')
  assert.equal(resolveConfigFile('credentials.json', paths), current)
  assert.equal(resolveConfigFile(legacy, paths), legacy)
  assert.equal(resolveConfigFile('missing.json', getServerPaths(item.moduleUrl)), path.join(item.serverRoot, 'missing.json'))
})
