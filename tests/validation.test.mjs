import test from 'node:test';
import assert from 'node:assert/strict';
import { parseData } from '../shared/validation.mjs';
import { renderMarkdown, formatDate, readingTime } from '../shared/markdown.mjs';
import { repositoryInfo, withBase, deploymentConfig } from '../shared/paths.mjs';
import { entry } from './helpers.mjs';

test('dates remain optional, historical and time-zone independent', () => {
  assert.equal(parseData('writing', entry(), true).displayDate, '');
  assert.equal(parseData('writing', entry({ displayDate: '1902-01-01' }), true).displayDate, '1902-01-01');
  assert.equal(formatDate('1902-01-01'), 'January 1, 1902');
  assert.throws(() => parseData('writing', entry({ displayDate: '2024-02-30' }), true), /calendar/);
  assert.throws(() => parseData('writing', entry({ body: '' }), true), /body/);
  assert.throws(() => parseData('writing', entry({ body: '![](/images/test.webp)' }), true), /description/);
});
test('raw HTML and unsafe URL schemes cannot execute in Markdown', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n![a](/images/a.webp)\n\n[About](/about/)', '/project');
  assert.doesNotMatch(html, /<script|href="javascript:|onerror=/);
  assert.match(html, /src="\/project\/images\/a.webp"/); assert.match(html, /href="\/project\/about\/"/);
  assert.equal(readingTime('word '.repeat(441)), 3);
});
test('GitHub personal and project repository paths are derived without guessing', () => {
  assert.deepEqual(repositoryInfo('https://github.com/DaelenWall/daelenwall.github.io.git'), { owner: 'DaelenWall', repo: 'daelenwall.github.io' });
  assert.deepEqual(repositoryInfo('git@github.com:owner/project.git'), { owner: 'owner', repo: 'project' });
  assert.equal(deploymentConfig({ GITHUB_REPOSITORY: 'owner/owner.github.io' }).base, '/');
  assert.equal(deploymentConfig({ GITHUB_REPOSITORY: 'owner/project' }).base, '/project');
  assert.equal(withBase('/images/a.webp', '/project'), '/project/images/a.webp');
  assert.equal(withBase('/project/about/', '/project'), '/project/about/');
  assert.equal(withBase('https://example.invalid', '/project'), 'https://example.invalid');
});
