/* Fabric Stash — main app logic (vanilla JS, no dependencies). */
(() => {
  const COLORS = [
    '', 'White', 'Cream / ivory', 'Black', 'Gray', 'Brown / tan', 'Red',
    'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Navy', 'Purple',
    'Teal', 'Multicolor / print',
  ];
  const LOW_YARDS = 1; // below this, yardage shows in red

  const $ = id => document.getElementById(id);
  const views = ['stash', 'form', 'detail', 'ideas', 'settings'];

  let fabrics = [];
  let currentDetailId = null;
  let photoData = null; // data URL for the photo being edited

  /* ---------- helpers ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtYards = y => {
    const n = Number(y) || 0;
    return (n % 1 === 0 ? n : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')) + ' yd';
  };
  const uid = () => 'f_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function showView(name) {
    views.forEach(v => $('view-' + v).classList.toggle('active', v === name));
    document.querySelectorAll('.tab[data-view]').forEach(t =>
      t.classList.toggle('active', t.dataset.view === name));
    const titles = { stash: 'Fabric Stash', form: 'Fabric details', detail: 'Fabric', ideas: 'Project ideas', settings: 'More' };
    $('header-title').textContent = titles[name] || 'Fabric Stash';
    window.scrollTo(0, 0);
    if (name === 'ideas') renderIdeas();
  }

  /* ---------- stash list ---------- */
  function renderStats() {
    const total = fabrics.reduce((s, f) => s + (Number(f.yards) || 0), 0);
    $('header-stats').textContent = fabrics.length
      ? `${fabrics.length} fabric${fabrics.length === 1 ? '' : 's'} · ${fmtYards(total)}`
      : '';
  }

  function getFiltered() {
    const q = $('search-input').value.trim().toLowerCase();
    const type = $('filter-type').value;
    const color = $('filter-color').value;
    let list = fabrics.filter(f => {
      if (type && f.type !== type) return false;
      if (color && f.color !== color) return false;
      if (q) {
        const hay = [f.name, f.type, f.color, f.pattern, f.fiber, f.location, f.notes]
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const [key, dir] = $('sort-by').value.split('-');
    list.sort((a, b) => {
      let cmp;
      if (key === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (key === 'yards') cmp = (Number(a.yards) || 0) - (Number(b.yards) || 0);
      else cmp = (a.dateAdded || 0) - (b.dateAdded || 0);
      return dir === 'desc' ? -cmp : cmp;
    });
    return list;
  }

  function renderList() {
    const list = getFiltered();
    const ul = $('fabric-list');
    ul.innerHTML = list.map(f => `
      <li class="fabric-card" data-id="${f.id}">
        ${f.photo
          ? `<img class="fabric-thumb" src="${f.photo}" alt="">`
          : `<div class="fabric-thumb">🧵</div>`}
        <div class="fabric-info">
          <h3>${esc(f.name)}</h3>
          <div class="fabric-meta">${esc([f.type, f.color, f.pattern].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="fabric-yards ${Number(f.yards) < LOW_YARDS ? 'low' : ''}">${fmtYards(f.yards)}</div>
      </li>`).join('');
    $('empty-state').classList.toggle('hidden', fabrics.length > 0);
    renderStats();
    refreshFilterOptions();
  }

  function refreshFilterOptions() {
    const keep = (sel, values, label) => {
      const cur = sel.value;
      sel.innerHTML = `<option value="">${label}</option>` +
        values.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
    };
    keep($('filter-type'), [...new Set(fabrics.map(f => f.type).filter(Boolean))].sort(), 'All types');
    keep($('filter-color'), [...new Set(fabrics.map(f => f.color).filter(Boolean))].sort(), 'All colors');
  }

  /* ---------- form ---------- */
  function openForm(fabric) {
    $('fabric-form').reset();
    photoData = fabric?.photo || null;
    $('f-id').value = fabric?.id || '';
    $('f-name').value = fabric?.name || '';
    $('f-type').value = fabric?.type || '';
    $('f-weight').value = fabric?.weight || '';
    $('f-color').value = fabric?.color || '';
    $('f-pattern').value = fabric?.pattern || '';
    $('f-yards').value = fabric?.yards ?? '';
    $('f-width').value = fabric?.width ?? '';
    $('f-fiber').value = fabric?.fiber || '';
    $('f-location').value = fabric?.location || '';
    $('f-notes').value = fabric?.notes || '';
    updatePhotoPreview();
    $('delete-fabric').classList.toggle('hidden', !fabric);
    showView('form');
  }

  function updatePhotoPreview() {
    const img = $('f-photo-preview');
    if (photoData) {
      img.src = photoData;
      img.classList.remove('hidden');
      $('photo-label').textContent = '📷 Change photo';
      $('remove-photo').classList.remove('hidden');
    } else {
      img.removeAttribute('src');
      img.classList.add('hidden');
      $('photo-label').textContent = '📷 Add photo';
      $('remove-photo').classList.add('hidden');
    }
  }

  /* Downscale photos so IndexedDB stays small and the list stays fast. */
  function processPhoto(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function saveForm(e) {
    e.preventDefault();
    const id = $('f-id').value || uid();
    const existing = fabrics.find(f => f.id === id);
    const fabric = {
      id,
      name: $('f-name').value.trim(),
      type: $('f-type').value,
      weight: $('f-weight').value,
      color: $('f-color').value,
      pattern: $('f-pattern').value,
      yards: Number($('f-yards').value) || 0,
      width: $('f-width').value ? Number($('f-width').value) : null,
      fiber: $('f-fiber').value.trim(),
      location: $('f-location').value.trim(),
      notes: $('f-notes').value.trim(),
      photo: photoData,
      dateAdded: existing?.dateAdded || Date.now(),
    };
    await DB.put(fabric);
    const i = fabrics.findIndex(f => f.id === id);
    if (i >= 0) fabrics[i] = fabric; else fabrics.push(fabric);
    renderList();
    if (currentDetailId === id) { renderDetail(id); showView('detail'); }
    else showView('stash');
  }

  /* ---------- detail ---------- */
  function renderDetail(id) {
    const f = fabrics.find(x => x.id === id);
    if (!f) { showView('stash'); return; }
    currentDetailId = id;
    const s = IDEAS.suggestFor(f);
    const attrs = [
      ['Type', f.type], ['Weight', f.weight], ['Color', f.color],
      ['Pattern', f.pattern], ['Fiber', f.fiber],
      ['Width', f.width ? f.width + '"' : ''], ['Stored in', f.location],
    ].filter(([, v]) => v);
    $('detail-content').innerHTML = `
      ${f.photo ? `<img class="detail-photo" src="${f.photo}" alt="">` : ''}
      <div class="detail-header">
        <h2>${esc(f.name)}</h2>
        <button class="text-btn" id="edit-fabric">Edit</button>
      </div>
      <div class="yardage-adjust">
        <button id="yd-minus" aria-label="Use ¼ yard">−</button>
        <div class="amount">${fmtYards(f.yards)}<small>tap ± for ¼ yd</small></div>
        <button id="yd-plus" aria-label="Add ¼ yard">＋</button>
      </div>
      <div class="attr-grid">
        ${attrs.map(([k, v]) => `<div class="attr"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}
      </div>
      ${f.notes ? `<div class="notes-block">${esc(f.notes)}</div>` : ''}
      ${s.now.length ? `
        <div class="idea-fabric">
          <h3>💡 Enough yardage for:</h3>
          <div class="idea-chips">
            ${s.now.map(p => `<span class="idea-chip">${p.name} <span class="yd">~${p.yards} yd</span></span>`).join('')}
          </div>
        </div>` : ''}
      <button class="btn secondary" id="back-to-stash">← Back to stash</button>
    `;
    $('edit-fabric').onclick = () => openForm(f);
    $('back-to-stash').onclick = () => showView('stash');
    $('yd-minus').onclick = () => adjustYards(f, -0.25);
    $('yd-plus').onclick = () => adjustYards(f, 0.25);
  }

  async function adjustYards(f, delta) {
    f.yards = Math.max(0, Math.round(((Number(f.yards) || 0) + delta) * 100) / 100);
    await DB.put(f);
    renderDetail(f.id);
    renderList();
  }

  /* ---------- ideas ---------- */
  function renderIdeas() {
    const el = $('ideas-content');
    if (!fabrics.length) {
      el.innerHTML = `<p class="ideas-intro">Add some fabrics to the stash and ideas will show up here!</p>`;
      return;
    }
    const sections = fabrics
      .filter(f => Number(f.yards) > 0)
      .sort((a, b) => (Number(b.yards) || 0) - (Number(a.yards) || 0))
      .map(f => {
        const s = IDEAS.suggestFor(f);
        if (!s.now.length && !s.almost.length) return '';
        return `
          <div class="idea-fabric" data-id="${f.id}">
            <h3>${esc(f.name)} <small>· ${fmtYards(f.yards)} of ${esc(f.type || 'fabric')}</small></h3>
            <div class="idea-chips">
              ${s.now.map(p => `<span class="idea-chip">✅ ${p.name} <span class="yd">~${p.yards} yd</span></span>`).join('')}
              ${s.almost.map(p => `<span class="idea-chip">🛍 ${p.name} <span class="yd">needs ~${p.yards} yd</span></span>`).join('')}
            </div>
          </div>`;
      }).join('');
    el.innerHTML = `
      <p class="ideas-intro">Based on each fabric's type and yardage —
      ✅ means there's enough on hand, 🛍 means it's within a yard of enough
      (a top-up trip to the fabric store!). Tap a fabric to open it.</p>
      ${sections || '<p class="ideas-intro">No suggestions yet — add fabric types and yardage to get ideas.</p>'}`;
    el.querySelectorAll('.idea-fabric').forEach(div => {
      div.addEventListener('click', () => { renderDetail(div.dataset.id); showView('detail'); });
    });
  }

  /* ---------- backup ---------- */
  function exportStash() {
    const blob = new Blob([JSON.stringify({ version: 1, fabrics }, null, 2)],
      { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fabric-stash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    $('settings-status').textContent = 'Backup exported ✔';
  }

  async function importStash(file) {
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.fabrics;
      if (!Array.isArray(list)) throw new Error('Unrecognized file');
      const valid = list.filter(f => f && f.id && f.name !== undefined);
      await DB.putMany(valid);
      fabrics = await DB.getAll();
      renderList();
      $('settings-status').textContent = `Imported ${valid.length} fabric${valid.length === 1 ? '' : 's'} ✔`;
    } catch (err) {
      $('settings-status').textContent = 'Import failed: ' + err.message;
    }
  }

  /* ---------- init ---------- */
  function populateSelects() {
    $('f-type').innerHTML = '<option value="">—</option>' +
      IDEAS.FABRIC_TYPES.map(t => `<option>${t}</option>`).join('');
    $('f-color').innerHTML = COLORS.map(c =>
      `<option value="${c}">${c || '—'}</option>`).join('');
  }

  async function init() {
    populateSelects();
    fabrics = await DB.getAll();
    renderList();

    document.querySelectorAll('.tab[data-view]').forEach(t =>
      t.addEventListener('click', () => showView(t.dataset.view)));
    $('add-btn').addEventListener('click', () => openForm(null));
    $('cancel-form').addEventListener('click', () => showView(currentDetailId ? 'detail' : 'stash'));
    $('fabric-form').addEventListener('submit', saveForm);
    $('delete-fabric').addEventListener('click', async () => {
      const id = $('f-id').value;
      if (!id || !confirm('Delete this fabric from the stash?')) return;
      await DB.delete(id);
      fabrics = fabrics.filter(f => f.id !== id);
      currentDetailId = null;
      renderList();
      showView('stash');
    });

    $('search-input').addEventListener('input', renderList);
    $('filter-type').addEventListener('change', renderList);
    $('filter-color').addEventListener('change', renderList);
    $('sort-by').addEventListener('change', renderList);
    $('filter-btn').addEventListener('click', () =>
      $('filter-panel').classList.toggle('hidden'));
    $('clear-filters').addEventListener('click', () => {
      $('filter-type').value = '';
      $('filter-color').value = '';
      $('search-input').value = '';
      renderList();
    });

    $('fabric-list').addEventListener('click', e => {
      const card = e.target.closest('.fabric-card');
      if (card) { renderDetail(card.dataset.id); showView('detail'); }
    });

    $('f-photo').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        photoData = await processPhoto(file);
        updatePhotoPreview();
      } catch { alert('Could not read that photo.'); }
      e.target.value = '';
    });
    $('remove-photo').addEventListener('click', () => {
      photoData = null;
      updatePhotoPreview();
    });

    $('export-btn').addEventListener('click', exportStash);
    $('import-input').addEventListener('change', e => {
      if (e.target.files[0]) importStash(e.target.files[0]);
      e.target.value = '';
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
