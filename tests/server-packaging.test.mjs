import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
const files = [
  'Dockerfile', 'package.json', 'package-lock.json', 'tsconfig.json',
  'src/index.ts', 'src/bookKnowledgeRoutes.ts', 'src/bookAgent.ts',
  'src/bookReferenceMedia.ts', 'src/runtimePaths.ts', 'contracts/bookAgentProtocol.ts',
  'repos/home-teacher-common/src/constants/grading.ts',
  'repos/home-teacher-common/src/i18n/locales/ja.json', 'repos/home-teacher-common/src/i18n/locales/en.json',
]
function listFiles(root, relative = '') {
  return readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const name = relative ? `${relative}/${entry.name}` : entry.name
    return entry.isDirectory() ? listFiles(root, name) : [name]
  }).sort()
}

test('deployment sources exclude secrets, tests and frontend files and build in isolation', { timeout: 30_000 }, t => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'hometeacher-package-'))
  t.after(() => {
    assert.equal(path.dirname(fixture), path.resolve(tmpdir()))
    assert.ok(path.basename(fixture).startsWith('hometeacher-package-'))
    rmSync(fixture, { recursive: true, force: true })
  })
  mkdirSync(path.join(fixture, 'scripts'))
  copyFileSync(path.join(apiRoot, 'scripts/prepare-cloud-run.mjs'), path.join(fixture, 'scripts/prepare-cloud-run.mjs'))
  for (const file of files) {
    mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true })
    copyFileSync(path.join(apiRoot, file), path.join(fixture, file))
  }
  for (const file of ['.env', '.env.production', 'credentials/secret.json', 'tests/private.ts', 'public/index.html']) {
    mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true })
    writeFileSync(path.join(fixture, file), 'must not be uploaded')
  }
  const prepare = () => spawnSync(process.execPath, ['scripts/prepare-cloud-run.mjs'],
    { cwd: fixture, encoding: 'utf8', timeout: 10_000 })
  const prepared = prepare()
  assert.ifError(prepared.error)
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr)
  const output = path.join(fixture, '.cloud-run')
  assert.deepEqual(listFiles(output), ['.gcloudignore', ...files].sort())
  symlinkSync(path.join(apiRoot, 'node_modules'), path.join(output, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir')
  const built = spawnSync(process.execPath, [npmCli, 'run', 'build'],
    { cwd: output, encoding: 'utf8', timeout: 20_000 })
  assert.ifError(built.error)
  assert.equal(built.status, 0, built.stdout + built.stderr)
  assert.match(readFileSync(path.join(output, 'dist/index.js'), 'utf8'), /gemini-3\.8-flash/)
  writeFileSync(path.join(output, 'sentinel'), 'existing bundle')
  rmSync(path.join(fixture, 'contracts/bookAgentProtocol.ts'))
  const incomplete = prepare()
  assert.notEqual(incomplete.status, 0)
  assert.equal(readFileSync(path.join(output, 'sentinel'), 'utf8'), 'existing bundle')
})
