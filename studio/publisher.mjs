import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWrite, digest, exists, isEntry } from './store.mjs';
import { parseData } from '../shared/validation.mjs';
import { checkPublic, walk } from '../scripts/check-public.mjs';
import { deploymentConfig, repositoryInfo } from '../shared/paths.mjs';

const exec = promisify(execFile);
export class Publisher {
  constructor(store, options = {}) { this.store = store; this.root = store.root; this.build = options.build || (() => this.command(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], 180000)); this.recordFile = path.join(store.local, 'publication.json'); this.busy = false; }
  async command(command, args, timeout = 30000) {
    try { return (await exec(command, args, { cwd: this.root, timeout, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } })).stdout.trim(); }
    catch (error) { throw new Error(`${command === 'git' ? 'Git' : 'Build'} failed: ${(error.stderr || error.stdout || error.message).slice(-5000)}\n${error.killed ? 'The command timed out. Check connectivity and try again.' : ''}`); }
  }
  git(...args) { return this.command('git', args); }
  async record() { return await exists(this.recordFile) ? JSON.parse(await fs.readFile(this.recordFile, 'utf8')) : null; }
  async setRecord(record) { await atomicWrite(this.recordFile, JSON.stringify(record, null, 2), 0o600); }
  async branch() {
    const config = path.join(this.store.local, 'config.json');
    const branch = await exists(config) ? JSON.parse(await fs.readFile(config, 'utf8')).publishBranch || 'main' : 'main';
    await this.git('check-ref-format', '--branch', branch); return branch;
  }
  async status() {
    let branch = '', remote = '', head = '', warning = '';
    try { branch = await this.git('symbolic-ref', '--short', 'HEAD'); remote = await this.git('remote', 'get-url', 'origin'); head = await this.git('rev-parse', 'HEAD'); } catch { warning = 'One-time setup is incomplete. Make the initial source commit, connect origin, and push the publishing branch. See README.md.'; }
    const config = deploymentConfig();
    const info = repositoryInfo(remote);
    return { branch, remote: info ? `https://github.com/${info.owner}/${info.repo}` : (remote ? 'Configured origin' : ''), head, warning, publishingBranch: await this.branch().catch(() => 'main'), siteUrl: `${config.site}${config.base === '/' ? '' : config.base}/`, previewUrl: `http://127.0.0.1:4321${config.base === '/' ? '' : config.base}/`, actionsUrl: info ? `https://github.com/${info.owner}/${info.repo}/actions` : '', record: await this.record(), busy: this.busy };
  }
  async preflight() {
    if ((await this.record())?.state === 'committed') throw new Error('A previous publication is committed locally but has not been pushed. Use Retry push first.');
    const branch = await this.branch();
    try { await this.git('rev-parse', '--is-inside-work-tree'); } catch { throw new Error('This folder is not a Git repository. Complete the one-time repository setup in README.md.'); }
    const currentBranch = await this.git('symbolic-ref', '--short', 'HEAD').catch(() => '');
    if (currentBranch !== branch) throw new Error(`Switch to the publishing branch (${branch}) before publishing. The studio does not change branches.`);
    try { await this.git('rev-parse', '--verify', 'HEAD'); } catch { throw new Error('The repository has no initial commit. Complete the one-time setup in README.md first.'); }
    const tracked = (await this.git('ls-files', '-z')).split('\0');
    if (tracked.some(file => file.startsWith('.studio-local/') || file === '.env' || file.startsWith('.env.'))) throw new Error('Private files are tracked by Git. Stop and remove them from tracking before publication. See README.md.');
    if (await this.git('status', '--porcelain=v1', '--untracked-files=all')) throw new Error('There are other uncommitted files in the repository. Review and commit or move them before publishing. Your private drafts are safe; the studio will not include or discard these files.');
    if (!(await this.git('check-ignore', '.studio-local/privacy-check.json')).startsWith('.studio-local/')) throw new Error('Draft privacy protection is missing from .gitignore. Restore it before publishing.');
    try { await this.git('config', 'user.name'); await this.git('config', 'user.email'); } catch { throw new Error('Set your Git name and email once, as described in README.md.'); }
    try { await this.git('remote', 'get-url', 'origin'); await this.git('fetch', '--no-tags', 'origin', `refs/heads/${branch}`); }
    catch (error) { throw new Error(`Could not read the publishing branch on origin. Complete the initial push or check Git credentials and network access.\n${error.message}`); }
    const difference = await this.git('rev-list', '--left-right', '--count', 'HEAD...FETCH_HEAD');
    if (difference.split(/\s+/).some(number => Number(number) !== 0)) throw new Error('Local and remote history differ. Review local commits or pull the remote changes before publishing. The studio will not merge, reset, or push unrelated commits.');
    for (const directory of ['src/content', 'src/data', 'public']) await walk(path.join(this.root, directory));
    return branch;
  }
  async publish(kind, id, version, remove = false) {
    if (this.busy) throw new Error('Another publication is in progress.');
    this.busy = true;
    const backups = new Map();
    let committed = false;
    let staged = false;
    let changes = [];
    try {
      const branch = await this.preflight();
      const item = await this.store.load(kind, id);
      if (version !== item.version) throw new Error('This draft changed. Reload it before publishing.');
      if (!remove && !item.hasDraft) throw new Error('Save your changes as a draft before publishing.');
      if (remove && (!isEntry(kind) || !item.published)) throw new Error('Only published articles and projects can be unpublished.');
      const raw = await this.store.raw(kind, id);
      if (item.hasDraft && item.baseHash !== digest(raw)) throw new Error('The public source changed since this draft was opened. Copy your draft text, discard this private revision, and reopen the current public version before publishing.');
      let promoted;
      if (!remove) {
        const data = parseData(kind, item.data, true);
        if (isEntry(kind)) {
          if (item.publishedData && item.publishedData.slug !== data.slug) throw new Error('An existing public URL is permanent in the studio. Keep its current slug to preserve links.');
          const entries = await this.store.list(kind);
          if (entries.some(entry => entry.id !== id && entry.publishedData?.slug === data.slug)) throw new Error('That URL slug is already published. Choose another.');
        }
        if (kind === 'home') {
          for (const [key, collection] of [['featuredWriting', 'writing'], ['featuredProjects', 'projects']]) {
            const available = (await this.store.list(collection)).filter(entry => entry.published).map(entry => entry.id);
            if (data[key].some(value => !available.includes(value)) || new Set(data[key]).size !== data[key].length) throw new Error('Featured selections must contain unique, published items.');
          }
          // Preserve inactive writing only in the private local memory, never in public JSON.
          if (data.mode !== 'introduction') data.intro = '';
          if (data.mode !== 'quote') { data.quote = ''; data.attribution = ''; }
        }
        promoted = await this.store.promote(data);
        changes = [...promoted.changes, { file: this.store.relative(kind, id), content: this.store.encode(kind, promoted.data) }];
      } else changes = [{ file: this.store.relative(kind, id), content: null }];
      for (const change of changes) {
        const absolute = path.join(this.root, change.file);
        backups.set(change.file, await exists(absolute) ? await fs.readFile(absolute) : null);
        if (change.content === null) await fs.unlink(absolute); else await atomicWrite(absolute, change.content);
      }
      await checkPublic(this.root);
      await this.build();
      await checkPublic(this.root, true);
      const files = changes.map(change => change.file);
      const unexpected = (await this.git('ls-files', '--modified', '--others', '--exclude-standard', '-z')).split('\0').filter(Boolean).filter(file => !files.includes(file));
      if (unexpected.length) throw new Error(`Files changed during the build: ${unexpected.join(', ')}. Publication stopped.`);
      staged = true;
      await this.git('add', '--', ...files);
      const stagedFiles = (await this.git('diff', '--cached', '--name-only', '-z')).split('\0').filter(Boolean);
      if (stagedFiles.some(file => !files.includes(file))) throw new Error('The Git index contains an unrelated file. Publication stopped.');
      if (!stagedFiles.length) {
        if (kind === 'home') await atomicWrite(path.join(this.store.local, 'hero-memory.json'), JSON.stringify({ intro: item.data.intro, quote: item.data.quote, attribution: item.data.attribution }), 0o600);
        await fs.rm(this.store.draftFile(kind, id), { force: true });
        return { state: 'unchanged', message: 'This draft matches the published source. No commit or push was needed.' };
      }
      await this.git('commit', '-m', `${remove ? 'Unpublish' : 'Publish'} ${kind}: ${isEntry(kind) ? item.data.title.replace(/[\r\n]/g, ' ').slice(0, 100) : kind}`, '--', ...files);
      committed = true;
      const commit = await this.git('rev-parse', 'HEAD');
      const record = { state: 'committed', commit, branch, kind, id, action: remove ? 'unpublish' : 'publish', at: new Date().toISOString() };
      await this.setRecord(record);
      if (remove) {
        await atomicWrite(this.store.draftFile(kind, id), JSON.stringify({ data: item.data, version: item.version + 1, baseHash: digest(null), updatedAt: new Date().toISOString() }, null, 2), 0o600);
      } else {
        if (kind === 'home') await atomicWrite(path.join(this.store.local, 'hero-memory.json'), JSON.stringify({ intro: item.data.intro, quote: item.data.quote, attribution: item.data.attribution }), 0o600);
        await fs.rm(this.store.draftFile(kind, id), { force: true });
      }
      return await this.push(record);
    } catch (error) {
      if (!committed) {
        if (staged && changes.length) await this.git('restore', '--staged', '--', ...changes.map(change => change.file)).catch(() => {});
        for (const [file, backup] of backups) {
          if (backup === null) await fs.rm(path.join(this.root, file), { force: true }); else await atomicWrite(path.join(this.root, file), backup);
        }
      }
      throw error;
    } finally { this.busy = false; }
  }
  async push(record) {
    try { await this.git('push', 'origin', `HEAD:refs/heads/${record.branch}`); }
    catch (error) { return { ...record, state: 'committed', message: `The public source is committed locally. Push failed; the live site is not confirmed. Use Retry push after resolving this error.\n${error.message}` }; }
    const pushed = { ...record, state: 'pushed', message: 'Pushed to GitHub. Pages deployment is pending; this does not yet confirm the site is live.' };
    await this.setRecord(pushed); return pushed;
  }
  async retry() {
    if (this.busy) throw new Error('Another publication is in progress.');
    this.busy = true;
    try {
      const record = await this.record();
      if (record?.state !== 'committed') throw new Error('There is no pending push.');
      if (await this.git('rev-parse', 'HEAD') !== record.commit || await this.git('symbolic-ref', '--short', 'HEAD') !== record.branch || await this.git('status', '--porcelain=v1')) throw new Error('The repository changed since this publication. Review it before retrying the push.');
      return await this.push(record);
    } finally { this.busy = false; }
  }
  async deployment() {
    const record = await this.record();
    if (!record || record.state !== 'pushed') return { state: 'unknown', message: 'No pushed publication is available to check.' };
    const info = repositoryInfo(await this.git('remote', 'get-url', 'origin'));
    if (!info) return { state: 'unknown', message: 'Deployment checks are available for a GitHub origin.' };
    const api = async suffix => { const response = await fetch(`https://api.github.com/repos/${info.owner}/${info.repo}/${suffix}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Daelen-Wall-Local-Studio' }, signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error(`GitHub returned ${response.status}. Open Actions to check deployment; the studio cannot confirm it yet.`); return response.json(); };
    const result = await api(`actions/runs?head_sha=${record.commit}&per_page=30`);
    const run = result.workflow_runs?.find(run => run.path === '.github/workflows/deploy.yml' && run.head_sha === record.commit);
    if (!run) return { state: 'pending', message: 'No Pages workflow run is visible for this commit yet.' };
    if (run.status !== 'completed') return { state: 'pending', message: `GitHub Actions: ${run.status.replaceAll('_', ' ')}.`, url: run.html_url };
    if (run.conclusion !== 'success') return { state: 'failed', message: `GitHub Actions finished with: ${run.conclusion}. Open the run to resolve the failure.`, url: run.html_url };
    const jobs = await api(`actions/runs/${run.id}/jobs`);
    const deployed = jobs.jobs?.some(job => job.name === 'deploy' && job.conclusion === 'success');
    return { state: deployed ? 'confirmed' : 'unknown', message: deployed ? 'GitHub confirmed the Pages deployment for this exact commit.' : 'The workflow completed, but a successful Pages deployment could not be verified.', url: run.html_url, commit: record.commit };
  }
}
