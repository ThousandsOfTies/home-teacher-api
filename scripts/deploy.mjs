import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const environment = process.argv[2]
const services = { staging: 'hometeacher-api-staging', production: 'hometeacher-api' }
if (!Object.hasOwn(services, environment)) throw new Error('Use staging or production')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release commit')
if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) {
  throw new Error('Commit the API changes and pin its submodule before deploying')
}
execFileSync(process.execPath, ['scripts/prepare-cloud-run.mjs'], { cwd: root, stdio: 'inherit' })
// Preserve the existing Cloud Run configuration and label each deployed commit.
const result = spawnSync('gcloud', [
  'run', 'deploy', services[environment], '--project', 'hometeacher-api',
  '--source', '.cloud-run', '--platform', 'managed', '--region', 'asia-northeast1',
  '--update-labels', `source-repository=home-teacher-api,git-sha=${commit}`, '--quiet',
], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true })
if (result.error) throw result.error
process.exit(result.status ?? 1)
