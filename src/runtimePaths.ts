import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

export function getServerPaths(moduleUrl: string, legacyAppRoot?: string) {
  // Both src/index.ts and dist/index.js live one directory below the server root.
  const serverRoot = path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..')
  return { serverRoot, legacyAppRoot: legacyAppRoot ? path.resolve(legacyAppRoot) : undefined }
}

export function loadServerEnvironment(moduleUrl: string, processEnv = process.env) {
  const paths = getServerPaths(moduleUrl, processEnv.HOME_TEACHER_LEGACY_APP_ROOT)
  const files = [path.join(paths.serverRoot, '.env'), ...(paths.legacyAppRoot
    ? [path.join(paths.legacyAppRoot, 'server/.env'), path.join(paths.legacyAppRoot, '.env')]
    : [])]
    .filter(file => existsSync(file))
  // Deployed variables win. Legacy app files are read only through the app launcher.
  if (files.length) dotenv.config({ path: files, processEnv })
  return paths
}

export function resolveConfigFile(file: string, paths: ReturnType<typeof getServerPaths>) {
  if (path.isAbsolute(file)) return path.resolve(file)
  const serverFile = path.resolve(paths.serverRoot, file)
  if (existsSync(serverFile)) return serverFile
  if (paths.legacyAppRoot) {
    for (const root of [path.join(paths.legacyAppRoot, 'server'), paths.legacyAppRoot]) {
      const legacyFile = path.resolve(root, file)
      if (existsSync(legacyFile)) return legacyFile
    }
  }
  return serverFile
}
