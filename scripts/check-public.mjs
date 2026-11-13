import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parseData } from '../shared/validation.mjs';

export async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not permitted in public inputs: ${file}`);
    if (entry.isDirectory()) files.push(...await walk(file)); else files.push(file);
  }
  return files;
}
export async function checkPublic(root, output = false) {
  const settings = JSON.parse(await fs.readFile(path.join(root, 'src/data/site.json'), 'utf8'));
  const sourceFiles = [...await walk(path.join(root, 'src/content')), ...await walk(path.join(root, 'src/data')), ...await walk(path.join(root, 'public'))];
  for (const file of sourceFiles) {
    if (/\.(md|json|html|xml|svg|txt|js|css)$/.test(file) && /\.studio-local|\/studio-media\//.test(await fs.readFile(file, 'utf8'))) throw new Error(`Private draft reference in public input: ${path.relative(root, file)}`);
  }
  for (const kind of ['writing', 'projects']) {
    const slugs = new Set();
    for (const file of await walk(path.join(root, 'src/content', kind))) {
      if (!file.endsWith('.md')) continue;
      const parsed = matter(await fs.readFile(file, 'utf8'));
      const data = parseData(kind, { ...parsed.data, body: parsed.content }, true);
      if (slugs.has(data.slug)) throw new Error(`Duplicate ${kind} slug: ${data.slug}`);
      if (kind === 'writing' && !settings.categories.includes(data.category)) throw new Error(`Unknown category: ${data.category}`);
      slugs.add(data.slug);
    }
  }
  for (const kind of ['site', 'home', 'contact']) parseData(kind, JSON.parse(await fs.readFile(path.join(root, `src/data/${kind}.json`), 'utf8')), true);
  parseData('about', { body: await fs.readFile(path.join(root, 'src/data/about.md'), 'utf8') }, true);
  if (output) {
    for (const file of await walk(path.join(root, 'dist'))) {
      if (/\/(?:studio|studio-local)(?:\/|$)/.test(path.relative(path.join(root, 'dist'), file))) throw new Error(`Studio file in public output: ${file}`);
      if (/\.(html|json|xml|js|css|txt)$/.test(file) && /\.studio-local|\/studio-media\/|Studio private draft|\/api\/bootstrap/.test(await fs.readFile(file, 'utf8'))) throw new Error(`Private content in output: ${file}`);
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await checkPublic(process.cwd(), process.argv.includes('--output')); console.log('Public content validation and privacy checks passed.'); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
