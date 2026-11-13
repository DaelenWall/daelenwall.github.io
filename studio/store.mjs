import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import matter from 'gray-matter';
import sharp from 'sharp';
import { defaults, parseData } from '../shared/validation.mjs';

export const KINDS = ['writing', 'projects', 'home', 'about', 'contact', 'site'];
export const isEntry = kind => ['writing', 'projects'].includes(kind);
export const digest = value => createHash('sha256').update(value ?? '').digest('hex');
export const exists = async file => fs.access(file).then(() => true, () => false);
export async function atomicWrite(file, data, mode) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, data, { mode });
  await fs.rename(temp, file);
}
export class Store {
  constructor(root) { this.root = root; this.local = path.join(root, '.studio-local'); }
  async init() { await fs.mkdir(path.join(this.local, 'drafts'), { recursive: true, mode: 0o700 }); await fs.mkdir(path.join(this.local, 'media'), { recursive: true, mode: 0o700 }); }
  validate(kind, id) {
    if (!KINDS.includes(kind) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,120}$/.test(id)) throw new Error('Invalid content identifier.');
    if (!isEntry(kind) && id !== kind) throw new Error('Invalid settings identifier.');
  }
  relative(kind, id) { this.validate(kind, id); return isEntry(kind) ? `src/content/${kind}/${id}.md` : `src/data/${kind}.${kind === 'about' ? 'md' : 'json'}`; }
  draftFile(kind, id) { this.validate(kind, id); return path.join(this.local, 'drafts', `${kind}--${id}.json`); }
  async raw(kind, id) { try { return await fs.readFile(path.join(this.root, this.relative(kind, id)), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
  decode(kind, raw) {
    if (raw === null) return structuredClone(defaults[kind] || {});
    if (isEntry(kind)) { const parsed = matter(raw); return parseData(kind, { ...parsed.data, body: parsed.content.trim() }); }
    return kind === 'about' ? { body: raw.trim() } : JSON.parse(raw);
  }
  encode(kind, data) {
    if (isEntry(kind)) { const { body, ...metadata } = data; for (const date of ['displayDate', 'writtenAt', 'firstPublishedAt']) if (!metadata[date]) delete metadata[date]; return matter.stringify(`\n${body.trim()}\n`, metadata); }
    return kind === 'about' ? `${data.body.trim()}\n` : `${JSON.stringify(data, null, 2)}\n`;
  }
  async load(kind, id) {
    const raw = await this.raw(kind, id);
    const file = this.draftFile(kind, id);
    const draft = await exists(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : null;
    const data = draft?.data || this.decode(kind, raw);
    const memoryFile = path.join(this.local, 'hero-memory.json');
    if (kind === 'home' && !draft && await exists(memoryFile)) {
      const memory = JSON.parse(await fs.readFile(memoryFile, 'utf8'));
      for (const key of ['intro', 'quote', 'attribution']) if (!data[key]) data[key] = memory[key] || '';
    }
    return { kind, id, data, version: draft?.version || 0, baseHash: draft?.baseHash || digest(raw), published: raw !== null, hasDraft: !!draft, updatedAt: draft?.updatedAt || null, publishedData: raw === null ? null : this.decode(kind, raw) };
  }
  async save(kind, id, input, version, baseHash) {
    const current = await this.load(kind, id);
    if (version !== current.version) throw new Error('This draft changed in another tab. Reload before saving to protect both versions.');
    const data = parseData(kind, input);
    const record = { data, version: version + 1, baseHash: current.hasDraft ? current.baseHash : (baseHash || current.baseHash), updatedAt: new Date().toISOString() };
    await atomicWrite(this.draftFile(kind, id), JSON.stringify(record, null, 2), 0o600);
    return this.load(kind, id);
  }
  async list(kind) {
    if (!isEntry(kind)) return [await this.load(kind, kind)];
    const directory = path.join(this.root, 'src/content', kind);
    const ids = new Set((await fs.readdir(directory)).filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)));
    for (const file of await fs.readdir(path.join(this.local, 'drafts'))) if (file.startsWith(`${kind}--`) && file.endsWith('.json')) ids.add(file.slice(kind.length + 2, -5));
    return Promise.all([...ids].map(id => this.load(kind, id)));
  }
  async media() {
    const privateNames = await fs.readdir(path.join(this.local, 'media'));
    const publicNames = await fs.readdir(path.join(this.root, 'public/images'));
    return [...privateNames.map(name => ({ url: `/studio-media/${name}`, private: true })), ...publicNames.filter(name => /\.(webp|png|jpe?g|avif)$/i.test(name)).map(name => ({ url: `/images/${name}`, private: false }))];
  }
  async upload(buffer, filename = 'image') {
    if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
    const processor = sharp(buffer, { limitInputPixels: 40000000, failOn: 'error' });
    const metadata = await processor.metadata();
    if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(metadata.format)) throw new Error('Choose a JPEG, PNG, WebP, AVIF, or supported HEIC image. SVG and animated images are not accepted.');
    if ((metadata.pages || 1) > 1) throw new Error('Choose a still image.');
    const data = await processor.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const name = `${path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 45).replace(/^-|-$/g, '') || 'image'}-${digest(data).slice(0, 16)}.webp`;
    await atomicWrite(path.join(this.local, 'media', name), data, 0o600);
    return { url: `/studio-media/${name}`, bytes: data.length };
  }
  async promote(data) {
    let serialized = JSON.stringify(data);
    const changes = [];
    const names = [...new Set([...serialized.matchAll(/\/studio-media\/([a-zA-Z0-9][a-zA-Z0-9._-]*\.webp)/g)].map(match => match[1]))];
    for (const name of names) {
      const source = path.join(this.local, 'media', name);
      if (!await exists(source)) throw new Error(`A draft image is missing: ${name}`);
      const destination = `public/images/${name}`;
      if (!await exists(path.join(this.root, destination))) changes.push({ file: destination, content: await fs.readFile(source) });
      serialized = serialized.replaceAll(`/studio-media/${name}`, `/images/${name}`);
    }
    if (serialized.includes('/studio-media/') || serialized.includes('.studio-local')) throw new Error('The document contains an invalid private asset reference.');
    return { data: JSON.parse(serialized), changes };
  }
}
