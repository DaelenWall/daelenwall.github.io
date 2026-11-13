import { execFileSync } from 'node:child_process';

export function repositoryInfo(remote = '') {
  const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export function deploymentConfig(env = process.env) {
  let remote = '';
  try { remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  const info = env.GITHUB_REPOSITORY ? repositoryInfo(`https://github.com/${env.GITHUB_REPOSITORY}`) : repositoryInfo(remote);
  const site = env.SITE_URL || (info ? `https://${info.owner.toLowerCase()}.github.io` : 'http://localhost:4321');
  const base = env.BASE_PATH ?? (info && info.repo.toLowerCase() !== `${info.owner.toLowerCase()}.github.io` ? `/${info.repo}` : '/');
  return { site: new URL(site).origin, base: `/${base.split('/').filter(Boolean).join('/')}` };
}

export function withBase(path = '', base = '/') {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) return path;
  const prefix = base === '/' ? '' : base.replace(/\/$/, '');
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return path;
  return `${prefix}/${path.replace(/^\//, '')}`;
}
