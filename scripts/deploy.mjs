import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const environment = process.argv[2]
const services = { staging: 'hometeacher-api-staging', production: 'hometeacher-api' }
if (!Object.hasOwn(services, environment)) throw new Error('Use staging or production')
const buildOnly = process.argv[3] === '--build-only'
if (process.argv.length > 4 || (process.argv[3] && !buildOnly)) throw new Error('Unknown deployment option')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release commit')
if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) {
  throw new Error('Commit the API changes and pin its submodule before deploying')
}
execFileSync(process.execPath, ['scripts/prepare-cloud-run.mjs'], { cwd: root, stdio: 'inherit' })
const imageBase = `asia-northeast1-docker.pkg.dev/hometeacher-api/cloud-run-source-deploy/${services[environment]}`
const image = `${imageBase}:git-${commit}`
// Build explicitly: the source-deploy Docker network is incompatible with BuildKit.
const built = spawnSync('gcloud', [
  'builds', 'submit', '.cloud-run', '--config', 'cloudbuild.yaml',
  '--project', 'hometeacher-api', '--region', 'asia-northeast1',
  '--service-account', 'projects/hometeacher-api/serviceAccounts/736494768812-compute@developer.gserviceaccount.com',
  '--gcs-source-staging-dir', 'gs://run-sources-hometeacher-api-asia-northeast1/sources',
  '--substitutions', `_IMAGE=${image}`, '--suppress-logs', '--format=json', '--quiet',
], { cwd: root, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'],
  shell: process.platform === 'win32', windowsHide: true })
if (built.error) throw built.error
if (built.status !== 0) process.exit(built.status ?? 1)
const build = JSON.parse(built.stdout)
const digest = build.results?.images?.find(item => item.name === image)?.digest
if (build.status !== 'SUCCESS' || build.options?.workerRelease !== 'regular' || !/^sha256:[a-f0-9]{64}$/.test(digest ?? '')) {
  throw new Error('Cloud Build did not return a successful regular build and image digest')
}
console.log(`Built ${imageBase}@${digest} with regular workers (build ${build.id})`)
if (buildOnly) process.exit(0)
// Preserve the existing Cloud Run configuration and label each deployed commit.
const result = spawnSync('gcloud', [
  'run', 'deploy', services[environment], '--project', 'hometeacher-api',
  '--image', `${imageBase}@${digest}`, '--platform', 'managed', '--region', 'asia-northeast1',
  '--update-labels', `source-repository=home-teacher-api,git-sha=${commit}`, '--quiet',
], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true })
if (result.error) throw result.error
process.exit(result.status ?? 1)
