import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Store, KINDS, isEntry, exists } from './store.mjs';
import { Publisher } from './publisher.mjs';
import { parseData } from '../shared/validation.mjs';
import { previewHtml } from './preview.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.woff2': 'font/woff2' };
export async function createStudio({ root = projectRoot, port = 4322, publisherOptions = {} } = {}) {
  const store = new Store(root); await store.init();
  const publisher = new Publisher(store, publisherOptions);
  const token = randomBytes(32).toString('hex');
  let mutationBusy = false;
  const json = (response, data, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data)); };
  async function readJson(request) {
    if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON content.');
    let size = 0; const chunks = [];
    for await (const chunk of request) { size += chunk.length; if (size > 18 * 1024 * 1024) throw new Error('The upload is too large.'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async function serve(response, file) { const data = await fs.readFile(file); response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); response.end(data); }
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const address = server.address();
    const host = `127.0.0.1:${address.port}`;
    const origin = `http://${host}`;
    if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin) || ['cross-site', 'same-site'].includes(request.headers['sec-fetch-site'])) return json(response, { error: 'This editor accepts requests only from its own loopback address.' }, 403);
    const pathname = new URL(request.url, origin).pathname;
    const mutates = request.method !== 'GET' && request.method !== 'HEAD';
    let ownsMutation = false;
    try {
      if (mutates) {
        const supplied = Buffer.from(String(request.headers['x-studio-token'] || ''));
        const expected = Buffer.from(token);
        if (request.headers.origin !== origin || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json(response, { error: 'The studio session expired. Reload this tab.' }, 403);
        if (pathname !== '/api/preview') {
          if (mutationBusy) return json(response, { error: 'An operation is still running. Wait for it to finish.' }, 409);
          mutationBusy = true; ownsMutation = true;
        }
      }
      if (request.method === 'GET' && pathname === '/api/bootstrap') {
        const content = {};
        for (const kind of KINDS) content[kind] = await store.list(kind);
        return json(response, { token, content, media: await store.media(), git: await publisher.status() });
      }
      if (request.method === 'GET' && pathname === '/api/status') return json(response, await publisher.status());
      if (request.method === 'GET' && pathname === '/api/deployment') return json(response, await publisher.deployment());
      if (request.method === 'POST' && pathname.startsWith('/api/')) {
        const input = await readJson(request);
        if (pathname === '/api/upload') return json(response, await store.upload(Buffer.from(input.data || '', 'base64'), input.filename));
        if (pathname === '/api/retry-push') return json(response, await publisher.retry());
        if (pathname === '/api/preview') return json(response, { html: previewHtml(input.kind, parseData(input.kind, input.data)) });
        const { kind, id } = input; store.validate(kind, id);
        if (pathname === '/api/save') return json(response, await store.save(kind, id, input.data, input.version, input.baseHash));
        if (pathname === '/api/publish' || pathname === '/api/unpublish') return json(response, await publisher.publish(kind, id, input.version, pathname.endsWith('unpublish')));
        if (pathname === '/api/discard') {
          const item = await store.load(kind, id);
          if (item.version !== input.version) throw new Error('This draft changed in another tab. Reload before deleting it.');
          if (input.confirm !== id) throw new Error('Draft deletion requires confirmation.');
          await fs.rm(store.draftFile(kind, id), { force: true });
          return json(response, { deleted: true });
        }
        if (pathname === '/api/new') {
          if (!isEntry(kind)) throw new Error('Only articles and projects can be created.');
          const item = await store.load(kind, randomUUID());
          return json(response, await store.save(kind, item.id, item.data, 0, item.baseHash));
        }
      }
      if (request.method === 'GET') {
        if (pathname === '/') return serve(response, path.join(projectRoot, 'studio/ui/index.html'));
        if (['/app.js', '/studio.css'].includes(pathname)) return serve(response, path.join(projectRoot, 'studio/ui', pathname.slice(1)));
        if (pathname === '/site-style.css') return serve(response, path.join(projectRoot, 'src/styles/global.css'));
        if (pathname === '/preview-fonts.css') { response.writeHead(200, { 'Content-Type': 'text/css' }); return response.end("@font-face{font-family:'Instrument Serif';font-weight:400;src:url('/fonts/serif.woff2')}@font-face{font-family:'DM Sans Variable';font-weight:100 1000;src:url('/fonts/sans.woff2')}"); }
        if (pathname === '/fonts/serif.woff2') return serve(response, path.join(projectRoot, 'node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2'));
        if (pathname === '/fonts/sans.woff2') return serve(response, path.join(projectRoot, 'node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2'));
        const asset = pathname.match(/^\/(studio-media|images)\/([a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:webp|png|jpg|jpeg|avif))$/);
        if (asset) {
          const file = path.join(asset[1] === 'studio-media' ? path.join(store.local, 'media') : path.join(root, 'public/images'), asset[2]);
          if (await exists(file)) { if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('Symlinks are not served.'); return serve(response, file); }
        }
      }
      json(response, { error: 'Not found.' }, 404);
    } catch (error) { json(response, { error: error.message }, error.code === 'ENOENT' ? 404 : 400); }
    finally { if (ownsMutation) mutationBusy = false; }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, store, publisher, url: `http://127.0.0.1:${server.address().port}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const studio = await createStudio({ port: Number(process.env.STUDIO_PORT || 4322) });
    console.log(`\n  Daelen Wall · Local studio\n  ${studio.url}\n\n  Drafts stay on this Mac. Keep this window open while editing.\n  Press Control-C to close the studio.\n`);
    if (process.platform === 'darwin' && !process.env.STUDIO_NO_OPEN) spawn('open', [studio.url], { stdio: 'ignore' });
    const close = () => studio.server.close(() => process.exit(0));
    process.on('SIGINT', close); process.on('SIGTERM', close);
  } catch (error) { console.error(error.code === 'EADDRINUSE' ? 'The studio is already open on this port. Open http://127.0.0.1:4322 or set STUDIO_PORT to another free port.' : error.message); process.exitCode = 1; }
}
