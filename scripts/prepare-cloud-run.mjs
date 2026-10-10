import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.resolve(apiRoot, '.cloud-run')
const files = [
  'Dockerfile', 'package.json', 'package-lock.json', 'tsconfig.json',
  'src/index.ts', 'src/bookKnowledgeRoutes.ts', 'src/bookAgent.ts',
  'src/bookReferenceMedia.ts', 'src/runtimePaths.ts', 'src/gradingAnswers.ts',
  'contracts/bookAgentProtocol.ts',
  'repos/home-teacher-common/src/constants/grading.ts',
  'repos/home-teacher-common/src/i18n/locales/ja.json',
  'repos/home-teacher-common/src/i18n/locales/en.json',
]
// Read all inputs before replacing a generated bundle. Secrets and frontend assets
// have no entry in this allowlist, regardless of local Git or ignore settings.
const inputs = files.map(file => [file, readFileSync(path.join(apiRoot, file))])
if (path.dirname(output) !== apiRoot || path.basename(output) !== '.cloud-run') {
  throw new Error('Invalid deployment output directory')
}
rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
for (const [file, contents] of inputs) {
  const destination = path.resolve(output, file)
  if (!destination.startsWith(output + path.sep)) throw new Error('Invalid deployment file')
  mkdirSync(path.dirname(destination), { recursive: true })
  writeFileSync(destination, contents)
}
writeFileSync(path.join(output, '.gcloudignore'), '.git\nnode_modules\ndist\n.env\n.env.*\ncredentials\n')
console.log('Cloud Run sources prepared in home-teacher-api/.cloud-run')
