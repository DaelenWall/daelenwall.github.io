import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStudio } from '../studio/server.mjs';
import { fixture, entry } from './helpers.mjs';

test('studio is loopback-only and rejects cross-origin, rebinding and missing-token writes', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const studio = await createStudio({ root: f.root, port: 0 }); t.after(() => new Promise(resolve => studio.server.close(resolve)));
  assert.equal(studio.server.address().address, '127.0.0.1');
  const bootstrap = await (await fetch(`${studio.url}/api/bootstrap`)).json();
  assert.equal((await fetch(`${studio.url}/api/bootstrap`, { headers: { Origin: 'https://evil.invalid' } })).status, 403);
  const rebound = await new Promise(resolve => { http.get(`${studio.url}/api/bootstrap`, { headers: { Host: 'evil.invalid' } }, response => { response.resume(); resolve(response.statusCode); }); });
  assert.equal(rebound, 403);
  const data = { kind: 'writing', id: 'test', data: entry(), version: 0 };
  const post = headers => fetch(`${studio.url}/api/save`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
  assert.equal((await post({ Origin: studio.url })).status, 403);
  assert.equal((await post({ Origin: 'https://evil.invalid', 'X-Studio-Token': bootstrap.token })).status, 403);
  assert.equal((await post({ Origin: studio.url, 'X-Studio-Token': bootstrap.token })).status, 200);
  assert.equal((await post({ Origin: studio.url, 'X-Studio-Token': bootstrap.token })).status, 400);
  const traversal = await fetch(`${studio.url}/api/save`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: studio.url, 'X-Studio-Token': bootstrap.token }, body: JSON.stringify({ ...data, id: '../escape' }) });
  assert.equal(traversal.status, 400);
  assert.equal((await fetch(`${studio.url}/.studio-local/drafts/writing--test.json`)).status, 404);
});
