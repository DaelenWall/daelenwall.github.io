const $ = selector => document.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const labels = { dashboard: 'Dashboard', writing: 'Articles', projects: 'Projects', home: 'Homepage', about: 'About', contact: 'Contact', site: 'Site settings' };
let state, current = null, section = 'dashboard', dirty = false, counter = 0, saveTimer, previewTimer, saveRunning, previewRequest = 0, working = false, chooseImage, deploymentTimer;
async function api(route, data) {
  const response = await fetch(`/api/${route}`, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': state.token }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The local operation failed.');
  return result;
}
function notice(message, kind = '') { const node = $('#notice'); node.hidden = !message; node.className = `notice ${kind}`; node.textContent = message; }
function showError(error) { notice(error.message, 'error'); }
function setSaveStatus(text) { const node = $('#save-status'); if (node) node.textContent = text; $('#footer-status').textContent = text; }
function statusBadge(item) { return item.published ? `<span class="badge ${item.hasDraft ? 'revision' : 'published'}">${item.hasDraft ? 'Published + private edits' : 'Published source'}</span>` : '<span class="badge">Private draft</span>'; }
function heading(title, subtitle = '', action = '') { return `<div class="workspace-heading"><div><div class="eyebrow">Your publishing desk</div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${action}</div>`; }
function itemRow(item) { return `<tr><td><button class="title-button" data-open="${item.kind}:${item.id}">${esc(item.data.title || 'Untitled draft')}</button><small>${esc(item.data.category || (item.kind === 'projects' ? 'Project' : 'No category'))}${item.data.displayDate ? ` · ${esc(item.data.displayDate)}` : ''}</small></td><td>${statusBadge(item)}</td><td>${item.updatedAt ? esc(new Date(item.updatedAt).toLocaleString()) : 'Published source'}</td></tr>`; }
function listTable(items, empty = 'No items yet. Create your first private draft when you are ready.') { return items.length ? `<table class="content-list"><thead><tr><th>Title</th><th>Local status</th><th>Last saved on this Mac</th></tr></thead><tbody>${items.map(itemRow).join('')}</tbody></table>` : `<div class="list-empty"><span>✳</span>${esc(empty)}</div>`; }
async function bootstrap() {
  state = await api('bootstrap');
  $('#live-link').href = state.git.siteUrl;
  $('#preview-link').href = state.git.previewUrl;
}
function renderDashboard() {
  const entries = [...state.content.writing, ...state.content.projects];
  const drafts = entries.filter(item => item.hasDraft).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const settingsDrafts = ['home', 'about', 'contact', 'site'].filter(kind => state.content[kind][0].hasDraft);
  $('#workspace').innerHTML = heading('Your words, at home.', 'Write privately. Publish deliberately.', '<button class="button primary" data-new="writing">+ New article</button>') + `<div class="summary-grid"><div class="summary-card"><span>Articles</span><strong>${state.content.writing.filter(item => item.published).length}</strong><small>in published source</small></div><div class="summary-card"><span>Private work</span><strong>${drafts.length + settingsDrafts.length}</strong><small>drafts and unpublished revisions</small></div><div class="summary-card"><span>Projects</span><strong>${state.content.projects.filter(item => item.published).length}</strong><small>in published source</small></div></div><section class="panel"><div class="panel-head"><h2>Continue writing</h2><button class="button small" data-section="writing">All articles ↗</button></div>${listTable(drafts.slice(0, 8), 'Your private drafts will appear here. Start with New article, or choose a page in the sidebar.')}${settingsDrafts.length ? `<div class="panel-body actions">${settingsDrafts.map(kind => `<button class="button small" data-section="${kind}">${labels[kind]} · private edits ↗</button>`).join('')}</div>` : ''}</section><section class="panel"><div class="panel-head"><h2>Publishing connection</h2><span class="badge ${state.git.head ? 'published' : ''}">${state.git.head ? esc(state.git.branch) : 'Setup needed'}</span></div><div class="panel-body"><div class="setup-note">${state.git.warning ? esc(state.git.warning) : `Connected to ${esc(state.git.remote)}.\nPublic source is built and checked before each publication. GitHub confirms deployment separately.`}</div><div class="actions" style="margin-top:18px">${state.git.actionsUrl ? `<a class="button small" href="${esc(state.git.actionsUrl)}" target="_blank" rel="noopener">Open GitHub Actions ↗</a>` : ''}${state.git.record?.state === 'committed' ? '<button class="button small accent" data-retry>Retry pending push</button>' : ''}${state.git.record?.state === 'pushed' ? '<button class="button small" data-deployment>Check deployment</button>' : ''}</div><p class="help">Published source, pushed changes, and a confirmed live deployment are different states. The studio reports each separately.</p></div></section>`;
}
function renderList(kind) { const article = kind === 'writing'; $('#workspace').innerHTML = heading(labels[kind], article ? 'Private drafts and your published archive.' : 'A place for your own work, when you are ready.', `<button class="button primary" data-new="${kind}">+ New ${article ? 'article' : 'project'}</button>`) + `<section class="panel">${listTable([...state.content[kind]].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')))}</section>`; }
function field(label, key, value, { type = 'text', hint = '', placeholder = '', rows, css = '', readonly = false } = {}) {
  return `<label class="field ${css}"><span>${esc(label)}</span>${rows ? `<textarea data-key="${key}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input data-key="${key}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${readonly ? 'readonly' : ''}>`}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}
function select(label, key, value, choices, hint = '') { return `<label class="field"><span>${esc(label)}</span><select data-key="${key}">${choices.map(([id, text]) => `<option value="${esc(id)}" ${value === id ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`; }
function imageField(label, key, value) { return `<div class="image-field"><span class="eyebrow">${esc(label)}</span>${value ? `<img class="image-preview" src="${esc(value)}" alt="Selected ${esc(label.toLowerCase())}"><div class="image-path">${esc(value)}</div>` : '<div class="image-placeholder">No image selected</div>'}<div class="actions" style="margin-top:9px"><button class="button small" type="button" data-image="${key}">Choose image</button>${value ? `<button class="button small" type="button" data-remove-image="${key}">Remove</button>` : ''}</div></div>`; }
function markdownField(data) { return `<div class="field markdown-field"><label class="writing-label" for="writing-body">Your writing <small class="muted">Markdown</small></label><div class="markdown-toolbar" role="toolbar" aria-label="Markdown formatting"><button type="button" data-format="heading" aria-label="Heading">H2</button><button type="button" data-format="bold" aria-label="Bold"><b>B</b></button><button type="button" data-format="italic" aria-label="Italic"><i>I</i></button><button type="button" data-format="link" aria-label="Insert link">↗</button><button type="button" data-format="list" aria-label="Bullet list">≡</button><button type="button" data-format="quote" aria-label="Blockquote">❝</button><button type="button" data-image="inline">+ Image</button></div><textarea id="writing-body" data-key="body" rows="20" spellcheck="true" placeholder="Write or paste your own text here…">${esc(data.body)}</textarea><small>Private autosave is on. Use Publish when you are ready to share this revision.</small></div>`; }
function featuredField(label, key, kind, selected) {
  const published = state.content[kind].filter(item => item.published);
  const ordered = [...selected.map(id => state.content[kind].find(item => item.id === id) || { id, published: false, data: { title: 'Unavailable item' } }), ...published.filter(item => !selected.includes(item.id))];
  return `<h2 style="margin-top:26px">${esc(label)}</h2><p class="help">Choose published items, then use the arrows to set their order.</p><div class="selection-list">${ordered.length ? ordered.map(item => `<div class="selection-row"><label><input type="checkbox" data-feature="${key}" value="${item.id}" ${selected.includes(item.id) ? 'checked' : ''}>${esc(item.publishedData?.title || item.data.title)}${item.published ? '' : ' · unpublished (remove to publish)'}</label>${selected.includes(item.id) ? `<button type="button" data-move="${key}:${item.id}:-1" aria-label="Move ${esc(item.publishedData?.title || item.data.title)} earlier">↑</button><button type="button" data-move="${key}:${item.id}:1" aria-label="Move ${esc(item.publishedData?.title || item.data.title)} later">↓</button>` : ''}</div>`).join('') : '<p class="help">Publish an item first. Your featured selection is always manual.</p>'}</div>`;
}
function entryFields(data) {
  const categories = state.content.site[0].publishedData.categories;
  return `<div class="form-section">${field('Title', 'title', data.title, { css: 'title-field', placeholder: 'Your title' })}${markdownField(data)}</div><details class="form-section" open><summary>Article details</summary>${field('URL slug', 'slug', data.slug, { hint: current.published ? 'This public URL stays fixed when you edit the title.' : 'Lowercase words and hyphens. Choose deliberately; this URL stays stable after publication.', readonly: current.published })}${section === 'writing' ? select('Category', 'category', data.category, [['', 'Choose a category'], ...categories.map(value => [value, value])]) : field('Category (optional)', 'category', data.category)}${field('Description (optional)', 'description', data.description, { rows: 3, hint: 'Your own summary for cards and sharing previews.' })}${field(section === 'projects' ? 'Technologies / tags (optional)' : 'Tags (optional)', 'tags', data.tags.join(', '), { hint: 'Separate tags with commas.' })}${section === 'projects' ? field('Project link (optional)', 'externalUrl', data.externalUrl, { type: 'url' }) : ''}${imageField('Cover image', 'coverImage', data.coverImage)}${field('Cover image description', 'coverAlt', data.coverAlt, { hint: 'Alt text helps readers who cannot see the image.' })}</details><details class="form-section"><summary>Dates</summary>${field('Display / archive date (optional)', 'displayDate', data.displayDate, { type: 'date', hint: 'Used for display and sorting. Historical dates are welcome.' })}${field('Originally written (optional)', 'writtenAt', data.writtenAt, { type: 'date' })}${field('First actually published (optional)', 'firstPublishedAt', data.firstPublishedAt, { type: 'date', hint: 'Used as the RSS publication date. Leave blank if unknown. No date is filled automatically.' })}</details><div class="form-section"><h2>Featured on homepage</h2><p class="help">Choose and order featured articles and projects in Homepage after publishing. Publishing an article never changes another draft.</p><button class="button small" type="button" data-section="home" style="margin-top:13px">Edit featured selections ↗</button></div>`;
}
function homeFields(data) { return `<div class="form-section"><h2>Hero presentation</h2>${select('Format', 'mode', data.mode, [['minimal', 'Minimal'], ['introduction', 'Introduction'], ['quote', 'Quote']], 'Switching format preserves all text below.')}${field('Introduction', 'intro', data.intro, { rows: 5, hint: data.mode === 'introduction' ? 'Visible in the current format.' : 'Kept privately in this revision; hidden in the current format.' })}${field('Quote', 'quote', data.quote, { rows: 4, hint: data.mode === 'quote' ? 'Visible in the current format.' : 'Hidden in the current format.' })}${field('Quote attribution (optional)', 'attribution', data.attribution)}</div><div class="form-section"><h2>Your portrait</h2>${imageField('Portrait', 'portrait', data.portrait)}${field('Portrait description', 'portraitAlt', data.portraitAlt)}${select('Treatment', 'portraitStyle', data.portraitStyle, [['natural', 'Natural color'], ['monochrome', 'Monochrome']])}<p class="help">No portrait is required. The geometric artwork remains when the image is removed.</p></div><div class="form-section"><h2>Featured selections</h2>${featuredField('Writing', 'featuredWriting', 'writing', data.featuredWriting)}${featuredField('Projects', 'featuredProjects', 'projects', data.featuredProjects)}</div>`; }
function contactFields(data) { return `<div class="form-section"><h2>Contact details</h2>${field('Email (optional)', 'email', data.email, { type: 'email' })}<h2 style="margin-top:28px">Links</h2><p class="help">Add only links you want to share publicly.</p><div id="contact-rows">${data.links.map((link, i) => `<div class="link-row">${field('Label', `links.${i}.label`, link.label)}${field('URL', `links.${i}.url`, link.url, { type: 'url' })}<button type="button" class="icon-button" data-delete-link="${i}" aria-label="Remove link ${i + 1}">×</button></div>`).join('')}</div><button class="button small" data-add-link type="button" style="margin-top:15px">+ Add link</button></div>`; }
function siteFields(data) { return `<div class="form-section"><h2>Site metadata</h2>${field('Displayed name', 'name', data.name, { readonly: true })}${field('Site description (optional)', 'description', data.description, { rows: 4, hint: 'Your own words for search engines and sharing previews.' })}${imageField('Social sharing image', 'socialImage', data.socialImage)}${field('Sharing image description', 'socialImageAlt', data.socialImageAlt)}</div><div class="form-section"><h2>Writing categories</h2>${field('One category per line', 'categories', data.categories.join('\n'), { rows: 5, hint: 'Existing articles must keep a valid category. Publish new categories before assigning them to articles.' })}</div><div class="form-section"><h2>Navigation labels</h2>${Object.entries(data.navigation).map(([key, value]) => field(key, `navigation.${key}`, value)).join('')}<p class="help">The five approved routes stay available; you can edit their labels.</p></div>`; }
function renderEditor() {
  const data = current.data;
  const isEntry = ['writing', 'projects'].includes(section);
  const title = isEntry ? (current.published ? 'Edit' : 'New') + (section === 'writing' ? ' article' : ' project') : labels[section];
  $('#workspace').innerHTML = `<div class="workspace-heading editor-heading"><div><div class="eyebrow">${esc(labels[section])} / ${current.published ? 'Private revision' : 'Private draft'}</div><h1>${esc(title)}</h1><div class="save-indicator" id="save-status">${dirty ? 'Unsaved changes' : current.hasDraft ? 'Draft saved privately on this Mac' : current.published ? 'Viewing published source. Edits create a private revision.' : 'New private draft. Start writing to save it on this Mac.'}</div></div><div class="actions"><button class="button" data-save>Save draft</button><button class="button accent" data-publish>Publish ${isEntry ? (section === 'writing' ? 'article' : 'project') : 'changes'} ↗</button></div></div><div class="editor-grid"><form id="editor-form" class="editor-form">${isEntry ? entryFields(data) : section === 'home' ? homeFields(data) : section === 'about' ? `<div class="form-section"><h2>Your About page</h2>${markdownField(data)}<p class="help">Use headings to add sections. Insert your own photos through the image library.</p></div>` : section === 'contact' ? contactFields(data) : siteFields(data)}<div class="editor-bottom">${current.published && isEntry ? '<button class="button danger small" data-unpublish type="button">Unpublish / archive</button>' : '<span></span>'}<button class="button small danger" data-discard type="button">${current.published ? 'Discard private revision' : 'Delete private draft'}</button></div></form><aside class="preview-pane"><div class="preview-top"><span>Live preview · Private</span><button type="button" data-preview-size>Phone ↔</button></div><iframe id="live-preview" title="Private content preview" sandbox="allow-same-origin"></iframe><div class="preview-caption">This preview is on your Mac. Save draft never changes the live site.</div></aside></div>`;
  $('#editor-form').addEventListener('submit', event => event.preventDefault());
  $('#editor-form').addEventListener('input', onEdit);
  $('#editor-form').addEventListener('change', event => { if (event.target.matches('select')) onEdit(event); });
  updatePreview();
}
function readForm() {
  if (!current) return;
  document.querySelectorAll('#editor-form [data-key]').forEach(input => {
    const keys = input.dataset.key.split('.');
    let target = current.data;
    for (const key of keys.slice(0, -1)) target = target[key];
    const key = keys.at(-1);
    target[key] = key === 'tags' ? input.value.split(',').map(item => item.trim()).filter(Boolean) : key === 'categories' ? input.value.split('\n').map(item => item.trim()).filter(Boolean) : input.value;
  });
}
function changed() {
  dirty = true; counter++; setSaveStatus('Unsaved changes · saving privately…');
  clearTimeout(saveTimer); saveTimer = setTimeout(() => saveDraft().catch(showError), 1000);
  clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 250);
}
function onEdit(event) {
  readForm();
  if (event.target.dataset.feature) { const key = event.target.dataset.feature, id = event.target.value; if (event.target.checked && !current.data[key].includes(id)) current.data[key].push(id); else if (!event.target.checked) current.data[key] = current.data[key].filter(value => value !== id); changed(); renderEditor(); return; }
  changed();
}
async function saveDraft() {
  clearTimeout(saveTimer);
  if (saveRunning) { await saveRunning; if (dirty) return saveDraft(); return; }
  if (!current || !dirty) return;
  readForm();
  const item = current, snapshot = structuredClone(item.data), revision = counter;
  setSaveStatus('Saving private draft…');
  saveRunning = (async () => {
    const saved = await api('save', { kind: item.kind, id: item.id, data: snapshot, version: item.version, baseHash: item.baseHash });
    item.version = saved.version; item.baseHash = saved.baseHash; item.hasDraft = true; item.updatedAt = saved.updatedAt;
    if (current === item && revision === counter) dirty = false;
    setSaveStatus(dirty ? 'New changes waiting to save…' : 'Draft saved privately on this Mac');
    const items = state.content[item.kind]; const index = items.findIndex(value => value.id === item.id); if (index < 0) items.push(saved); else items[index] = saved;
  })();
  try { await saveRunning; } catch (error) { setSaveStatus('Not saved · your edits are still in this tab'); throw error; } finally { saveRunning = null; }
  if (dirty) return saveDraft();
}
async function updatePreview() {
  if (!current || !$('#live-preview')) return;
  const request = ++previewRequest;
  try { const result = await api('preview', { kind: current.kind, data: current.data }); if (request === previewRequest && $('#live-preview')) $('#live-preview').srcdoc = result.html; } catch { /* Keep the last valid preview while a field is incomplete. */ }
}
async function go(kind, id) {
  if (working) return;
  try { await saveDraft(); } catch (error) { showError(error); return; }
  clearTimeout(previewTimer); current = null; dirty = false; section = kind;
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === kind));
  history.replaceState({}, '', `#${kind}${id ? `/${id}` : ''}`);
  if (kind === 'dashboard') renderDashboard();
  else if (['writing', 'projects'].includes(kind) && !id) renderList(kind);
  else { current = structuredClone(state.content[kind]?.find(item => item.id === (id || kind))); if (!current) { notice('This item is no longer available. Reload the studio.', 'error'); return; } renderEditor(); }
}
function confirmAction(title, text, action) {
  return new Promise(resolve => { const dialog = $('#confirm-dialog'); $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; $('#confirm-action').textContent = action; dialog.returnValue = ''; dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }); dialog.showModal(); });
}
async function publish(remove = false) {
  if (working || !current) return;
  if (remove && !await confirmAction('Unpublish this item?', 'This removes the item from the next public build and keeps a private local draft. Previously published text and images may remain in Git history, public caches, and copies. Unpublishing cannot guarantee erasure.', 'Unpublish')) return;
  working = true;
  document.querySelectorAll('button,input,textarea,select').forEach(control => control.disabled = true);
  notice('Saving this revision privately before publication…', 'progress');
  try {
    await saveDraft();
    if (!current.hasDraft && !remove) { notice('Make and save a change before publishing.'); return; }
    notice('Checking Git, validating this revision, building the public site, and publishing… Keep the studio open.', 'progress');
    const { kind, id } = current;
    const result = await api(remove ? 'unpublish' : 'publish', { kind, id, version: current.version });
    await bootstrap();
    current = structuredClone(state.content[kind].find(item => item.id === id)); dirty = false;
    notice(result.message, result.state === 'committed' ? 'error' : '');
    if (result.state === 'pushed') startDeploymentChecks();
    if (current) renderEditor(); else { section = kind; renderList(kind); }
  } catch (error) { showError(error); } finally { working = false; document.querySelectorAll('button,input,textarea,select').forEach(control => control.disabled = false); }
}
async function checkDeployment() {
  try { const result = await api('deployment'); notice(result.message, result.state === 'failed' ? 'error' : result.state === 'pending' ? 'progress' : ''); if (['confirmed', 'failed', 'unknown'].includes(result.state)) clearInterval(deploymentTimer); }
  catch (error) { clearInterval(deploymentTimer); showError(error); }
}
function startDeploymentChecks() { clearInterval(deploymentTimer); let checks = 0; deploymentTimer = setInterval(() => { if (++checks > 40) { clearInterval(deploymentTimer); notice('Deployment has not been confirmed. Open GitHub Actions for the current status.'); } else checkDeployment(); }, 15000); }
async function discard() {
  if (!current || working) return;
  clearTimeout(saveTimer); await saveRunning;
  const title = current.published ? 'Discard this private revision?' : 'Delete this private draft?';
  if (!await confirmAction(title, current.published ? 'Your published source stays in place. Unsaved and privately saved edits in this revision will be deleted from this Mac.' : 'This removes the draft from this Mac. It has not been published. This cannot be undone.', 'Delete private edits')) { if (dirty) changed(); return; }
  await api('discard', { kind: current.kind, id: current.id, version: current.version, confirm: current.id });
  const kind = current.kind; current = null; dirty = false; await bootstrap(); await go(kind); notice('Private draft deleted.');
}
function openMedia(callback) { chooseImage = callback; renderMedia(); $('#media-dialog').showModal(); }
function renderMedia() {
  $('#media-grid').innerHTML = state.media.length ? state.media.map(item => `<button type="button" data-choose-media="${esc(item.url)}"><img src="${esc(item.url)}" alt="${esc(item.url.split('/').at(-1))}"><span>${item.private ? 'Private upload' : 'Public asset'}</span><span>${esc(item.url.split('/').at(-1))}</span></button>`).join('') : '<p>No images yet. Upload your own image above.</p>';
}
async function chooseFor(key) {
  await saveDraft();
  openMedia(async url => {
    if (key === 'inline') {
      const description = window.prompt('Describe this image for readers who cannot see it:');
      if (!description?.trim()) return;
      const textarea = document.querySelector('[data-key="body"]');
      const start = textarea.selectionStart, end = textarea.selectionEnd;
      textarea.setRangeText(`\n![${description.replace(/[\[\]\\]/g, '')}](${url})\n`, start, end, 'end');
      readForm(); changed(); textarea.focus();
    } else { current.data[key] = url; changed(); renderEditor(); }
  });
}
$('#close-media').addEventListener('click', () => $('#media-dialog').close());
$('#media-grid').addEventListener('click', event => { const button = event.target.closest('[data-choose-media]'); if (button) { $('#media-dialog').close(); chooseImage?.(button.dataset.chooseMedia); } });
$('#media-upload').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    await saveDraft();
    $('#upload-status').textContent = 'Optimizing and saving privately…';
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await api('upload', { filename: file.name, data: base64 });
    if (!state.media.some(item => item.url === result.url)) state.media.unshift({ url: result.url, private: true });
    renderMedia(); $('#upload-status').textContent = 'Saved privately. Choose the image below.';
  } catch (error) { $('#upload-status').textContent = error.message; } finally { event.target.value = ''; }
});
function formatMarkdown(type) {
  const textarea = document.querySelector('[data-key="body"]'); if (!textarea) return;
  const start = textarea.selectionStart, end = textarea.selectionEnd, selected = textarea.value.slice(start, end);
  const formats = { heading: [`\n## ${selected || 'Heading'}\n`], bold: [`**${selected || 'text'}**`], italic: [`*${selected || 'text'}*`], link: [`[${selected || 'link text'}](https://)`], list: [`\n${(selected || 'List item').split('\n').map(line => `- ${line}`).join('\n')}\n`], quote: [`\n${(selected || 'Quote').split('\n').map(line => `> ${line}`).join('\n')}\n`] };
  textarea.setRangeText(formats[type][0], start, end, 'end'); readForm(); changed(); textarea.focus();
}
document.addEventListener('click', async event => {
  const target = event.target.closest('button, a[data-nav]'); if (!target) return;
  if (target.matches('[data-nav]')) { event.preventDefault(); return go(target.dataset.nav); }
  try {
    if (target.dataset.section) return go(target.dataset.section);
    if (target.dataset.open) { const [kind, id] = target.dataset.open.split(':'); return go(kind, id); }
    if (target.dataset.new) { await saveDraft(); const kind = target.dataset.new; const item = await api('new', { kind, id: 'new' }); state.content[kind].push(item); await go(kind, item.id); return; }
    if (target.hasAttribute('data-save')) { await saveDraft(); notice('Saved privately on this Mac. The public source has not changed.'); }
    if (target.hasAttribute('data-publish')) return publish();
    if (target.hasAttribute('data-unpublish')) return publish(true);
    if (target.hasAttribute('data-discard')) return await discard();
    if (target.hasAttribute('data-deployment')) return checkDeployment();
    if (target.hasAttribute('data-retry')) { notice('Retrying the pending push…', 'progress'); const result = await api('retry-push', {}); notice(result.message, result.state === 'committed' ? 'error' : ''); await bootstrap(); renderDashboard(); if (result.state === 'pushed') startDeploymentChecks(); }
    if (target.hasAttribute('data-preview-size')) { $('.preview-pane').classList.toggle('phone'); target.textContent = $('.preview-pane').classList.contains('phone') ? 'Desktop ↔' : 'Phone ↔'; }
    if (target.dataset.image) return await chooseFor(target.dataset.image);
    if (target.dataset.removeImage) { current.data[target.dataset.removeImage] = ''; changed(); renderEditor(); }
    if (target.dataset.format) formatMarkdown(target.dataset.format);
    if (target.dataset.move) { const [key, id, direction] = target.dataset.move.split(':'); const items = current.data[key], index = items.indexOf(id), destination = index + Number(direction); if (destination >= 0 && destination < items.length) { [items[index], items[destination]] = [items[destination], items[index]]; changed(); renderEditor(); } }
    if (target.hasAttribute('data-add-link')) { readForm(); current.data.links.push({ label: '', url: '' }); changed(); renderEditor(); }
    if (target.hasAttribute('data-delete-link')) { readForm(); current.data.links.splice(Number(target.dataset.deleteLink), 1); changed(); renderEditor(); }
  } catch (error) { showError(error); }
});
window.addEventListener('beforeunload', event => { if (dirty || saveRunning || working) { event.preventDefault(); event.returnValue = ''; } });
try { await bootstrap(); const [kind, id] = location.hash.slice(1).split('/'); await go(labels[kind] ? kind : 'dashboard', id); } catch (error) { showError(error); $('#workspace').innerHTML = '<p>Could not open the local studio. Keep the launcher running and reload this tab.</p>'; }
