/**
 * Finishes the Next.js standalone bundle for the Electron desktop app.
 *
 * `next build` with output: "standalone" writes .next/standalone/server.js and
 * a traced node_modules folder, but deliberately leaves out static assets.
 * Electron packages that folder, so copy .next/static and public into it.
 */
import { cp, mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');
const serverEntry = path.join(standalone, 'server.js');

const exists = async (target) =>
  access(target).then(
    () => true,
    () => false,
  );

if (!(await exists(serverEntry))) {
  console.error('Missing .next/standalone/server.js — run MELO_DESKTOP_BUILD=1 npm run build first.');
  process.exit(1);
}

await mkdir(path.join(standalone, '.next'), { recursive: true });

await rm(path.join(standalone, '.next', 'static'), { recursive: true, force: true });
await cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });

await rm(path.join(standalone, 'public'), { recursive: true, force: true });
if (await exists(path.join(root, 'public'))) {
  await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
}

console.log('Desktop bundle ready: .next/standalone (server + static + public)');
