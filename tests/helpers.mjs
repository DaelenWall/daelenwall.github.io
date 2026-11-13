import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
export const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function command(root, bin, args, env = {}) { return (await exec(bin, args, { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ...env }, timeout: 180000, maxBuffer: 6 * 1024 * 1024 })).stdout.trim(); }
export const git = (root, ...args) => command(root, 'git', args);
export async function fixture() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'daelen-wall-test-'));
  const root = path.join(temp, 'site'); await fs.mkdir(root);
  for (const file of ['src', 'public', 'shared', 'scripts', 'astro.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json', '.gitignore']) await fs.cp(path.join(sourceRoot, file), path.join(root, file), { recursive: true });
  await fs.appendFile(path.join(root, '.gitignore'), '\nnode_modules\n');
  await fs.symlink(path.join(sourceRoot, 'node_modules'), path.join(root, 'node_modules'));
  await git(root, 'init', '-b', 'main');
  await git(root, 'config', 'user.name', 'Local test'); await git(root, 'config', 'user.email', 'test@example.invalid');
  await git(root, 'add', '--', 'src', 'public', 'shared', 'scripts', 'astro.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json', '.gitignore');
  await git(root, 'commit', '-m', 'Local test fixture');
  const remote = path.join(temp, 'remote.git'); await command(temp, 'git', ['init', '--bare', remote]);
  await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main');
  return { root, temp, cleanup: () => fs.rm(temp, { recursive: true, force: true }) };
}
export const entry = (overrides = {}) => ({ title: 'Temporary test fixture', slug: 'temporary-test-fixture', category: 'Technology', body: 'Temporary test body, used only inside an isolated test directory.', ...overrides });
export async function treeText(directory) {
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) result.push(await treeText(file)); else if (/\.(html|json|xml|txt|js|css|md)$/.test(item.name)) result.push(await fs.readFile(file, 'utf8'));
  }
  return result.join('\n');
}
