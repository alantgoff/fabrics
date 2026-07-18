/* Fabric Stash — main app logic (vanilla JS, no dependencies). */
(() => {
  const APP_VERSION = 'v9';

  /* ---------- custom field options ----------
   * User-created values for the dropdown fields, shared across fabrics.
   * color pool is shared by the primary and secondary selects. */
  const CUSTOMS_KEY = 'fabric-stash-customs';
  let customs = { type: [], weight: [], color: [], pattern: [] };
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOMS_KEY) || '{}');
    for (const k of Object.keys(customs)) {
      if (Array.isArray(stored[k])) customs[k] = stored[k].filter(v => typeof v === 'string');
    }
  } catch {}
  function saveCustoms() {
    try { localStorage.setItem(CUSTOMS_KEY, JSON.stringify(customs)); } catch {}
  }
  function addCustom(pool, value) {
    if (!customs[pool].some(v => v.toLowerCase() === value.toLowerCase())) {
      customs[pool].push(value);
      customs[pool].sort((a, b) => a.localeCompare(b));
      saveCustoms();
    }
  }

  const CUSTOM_SELECTS = [
    ['f-type', 'type'], ['f-weight', 'weight'],
    ['f-color', 'color'], ['f-color2', 'color'], ['f-pattern', 'pattern'],
  ];

  function refreshCustomOptions() {
    for (const [selId, pool] of CUSTOM_SELECTS) {
      const sel = $(selId);
      const cur = sel.value;
      sel.querySelectorAll('option[data-custom]').forEach(o => o.remove());
      for (const v of customs[pool]) {
        if ([...sel.options].some(o => o.value === v)) continue;
        const o = document.createElement('option');
        o.value = o.textContent = v;
        o.dataset.custom = '1';
        sel.appendChild(o);
      }
      const add = document.createElement('option');
      add.value = '__new__';
      add.textContent = '＋ Add new…';
      add.dataset.custom = '1';
      sel.appendChild(add);
      if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    }
  }

  function wireCustomSelects() {
    for (const [selId, pool] of CUSTOM_SELECTS) {
      const sel = $(selId);
      sel.addEventListener('change', () => {
        if (sel.value !== '__new__') return;
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Name the new ' + pool + '…';
        input.autocomplete = 'off';
        sel.classList.add('hidden');
        sel.insertAdjacentElement('afterend', input);
        let done = false;
        const commit = () => {
          if (done) return;
          done = true;
          const v = input.value.trim();
          input.remove();
          sel.classList.remove('hidden');
          if (!v) { sel.value = ''; return; }
          addCustom(pool, v);
          refreshCustomOptions();
          sel.value = v;
        };
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
        });
        input.addEventListener('blur', commit);
        input.focus();
      });
    }
  }
  const COLORS = [
    '', 'White', 'Cream / ivory', 'Black', 'Gray', 'Brown / tan', 'Red',
    'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Navy', 'Purple',
    'Teal', 'Multicolor / print',
  ];
  const LOW_YARDS = 1;

  const $ = id => document.getElementById(id);
  const views = ['stash', 'form', 'detail', 'ideas', 'settings'];

  let fabrics = [];
  let currentDetailId = null;
  let photoData = null;
  let detectedColors = null; // hexes from the last photo analysis
  let ownedThreads = []; // the thread drawer

  const threadId = (brand, code) => brand + '|' + code;
  const brandShort = b => b.startsWith('Gütermann') ? 'Gütermann' : 'Coats & Clark';

  // representative hex for each named color, used when the color is picked
  // from the dropdown rather than detected from a photo
  const NAMED_HEX = {
    'White': '#f5f4f0', 'Cream / ivory': '#f1e8d2', 'Black': '#1e1e1e',
    'Gray': '#8b8b8b', 'Brown / tan': '#8b5f3d', 'Red': '#c11f2f',
    'Pink': '#e26a8d', 'Orange': '#e97d24', 'Yellow': '#f0c419',
    'Green': '#3f8f45', 'Blue': '#2f579c', 'Navy': '#1e2a50',
    'Purple': '#5f3d85', 'Teal': '#1f7d84',
  };

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
    $('main-content').scrollTo(0, 0);
    if (name === 'ideas') renderIdeas();
  }

  function renderStats() {
    const total = fabrics.reduce((s, f) => s + (Number(f.yards) || 0), 0);
    $('header-stats').textContent = fabrics.length
      ? `${fabrics.length} fabric${fabrics.length === 1 ? '' : 's'} · ${fmtYards(total)}`
      : '';
  }

  /* ---------- natural-language color search ----------
   * "dusty pink", "light blue floral" — color words match the hex palette
   * detected from each fabric's photo (and the named color fields);
   * remaining words match the text fields. */
  const COLOR_WORDS = {
    red: [0, 0.75, 0.45], crimson: [345, 0.8, 0.4], maroon: [345, 0.6, 0.25],
    burgundy: [345, 0.55, 0.25], pink: [340, 0.65, 0.75], blush: [350, 0.5, 0.82],
    rose: [340, 0.6, 0.6], magenta: [310, 0.8, 0.5], fuchsia: [315, 0.85, 0.55],
    orange: [28, 0.85, 0.55], rust: [18, 0.65, 0.4], coral: [10, 0.8, 0.65],
    peach: [28, 0.7, 0.8], yellow: [52, 0.85, 0.6], gold: [45, 0.7, 0.5],
    mustard: [48, 0.7, 0.45], green: [120, 0.5, 0.4], olive: [75, 0.45, 0.35],
    sage: [110, 0.2, 0.6], mint: [150, 0.45, 0.75], emerald: [145, 0.6, 0.4],
    forest: [130, 0.45, 0.25], teal: [178, 0.55, 0.35], turquoise: [174, 0.6, 0.5],
    aqua: [185, 0.6, 0.6], cyan: [190, 0.7, 0.55], blue: [220, 0.65, 0.5],
    navy: [225, 0.6, 0.2], cobalt: [218, 0.7, 0.4], sky: [205, 0.6, 0.7],
    denim: [218, 0.4, 0.4], purple: [275, 0.55, 0.45], violet: [270, 0.6, 0.55],
    lavender: [265, 0.45, 0.78], lilac: [283, 0.4, 0.75], plum: [300, 0.4, 0.35],
    brown: [25, 0.45, 0.3], tan: [34, 0.4, 0.65], beige: [38, 0.3, 0.8],
    cream: [45, 0.4, 0.9], ivory: [48, 0.3, 0.93], white: [0, 0, 0.95],
    black: [0, 0, 0.08], gray: [0, 0, 0.5], grey: [0, 0, 0.5],
    charcoal: [0, 0, 0.22], silver: [0, 0, 0.75],
  };
  const COLOR_MODIFIERS = {
    light: { dl: +0.18 }, pale: { dl: +0.22, ds: -0.15 }, pastel: { dl: +0.22, ds: -0.2 },
    soft: { dl: +0.1, ds: -0.15 }, dark: { dl: -0.18 }, deep: { dl: -0.15, ds: +0.1 },
    dusty: { ds: -0.3 }, muted: { ds: -0.3 }, bright: { ds: +0.2 }, vivid: { ds: +0.25 },
    hot: { ds: +0.25, dl: +0.05 }, neon: { ds: +0.3, dl: +0.1 },
  };

  function hexToHsl(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const v = parseInt(m[1], 16);
    const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2, d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s, l];
  }

  /* Split a query into color targets and plain text terms. */
  function parseQuery(q) {
    const words = q.split(/\s+/).filter(Boolean);
    const colorTargets = [], textTerms = [];
    let pendingMod = null;
    for (const w of words) {
      if (COLOR_MODIFIERS[w]) { pendingMod = w; continue; }
      if (COLOR_WORDS[w]) {
        let [h, s, l] = COLOR_WORDS[w];
        if (pendingMod) {
          const m = COLOR_MODIFIERS[pendingMod];
          s = Math.max(0, Math.min(1, s + (m.ds || 0)));
          l = Math.max(0, Math.min(1, l + (m.dl || 0)));
        }
        colorTargets.push({ word: w, h, s, l, strict: !!pendingMod });
        pendingMod = null;
      } else {
        if (pendingMod) textTerms.push(pendingMod);
        pendingMod = null;
        textTerms.push(w);
      }
    }
    if (pendingMod) textTerms.push(pendingMod);
    return { colorTargets, textTerms };
  }

  function fabricMatchesColor(f, t) {
    // named-color fallback so hand-entered fabrics still match —
    // but not for modified queries ("dusty blue" must check actual hexes)
    if (!t.strict) {
      const names = [f.color, f.color2].join(' ').toLowerCase();
      if (names.includes(t.word)) return true;
    }
    const hexes = [f.colorHex, f.color2Hex, ...(f.palette || [])].filter(Boolean);
    for (const hx of hexes) {
      const hsl = hexToHsl(hx);
      if (!hsl) continue;
      const [h, s, l] = hsl;
      const neutralTarget = t.s < 0.16;
      if (neutralTarget) {
        if (s < 0.22 && Math.abs(l - t.l) < (t.strict ? 0.16 : 0.24)) return true;
        continue;
      }
      // near-neutrals (including near-white/black) can't match a hued query
      if (s < 0.18 || l > 0.92 || l < 0.08) continue;
      let dh = Math.abs(h - t.h);
      if (dh > 180) dh = 360 - dh;
      const lTol = t.strict ? 0.18 : 0.3;
      const sTol = t.strict ? 0.32 : 0.5;
      if (dh <= 32 && Math.abs(l - t.l) <= lTol && Math.abs(s - t.s) <= sTol) return true;
    }
    return false;
  }

  function getFiltered() {
    const q = $('search-input').value.trim().toLowerCase();
    const type = $('filter-type').value;
    const color = $('filter-color').value;
    const parsed = q ? parseQuery(q) : null;
    let list = fabrics.filter(f => {
      if (type && f.type !== type) return false;
      if (color && f.color !== color) return false;
      if (parsed) {
        const hay = [f.name, f.type, f.color, f.color2, f.pattern, f.fiber,
          f.location, f.notes, ...(f.tags || [])].join(' ').toLowerCase();
        for (const t of parsed.colorTargets) {
          if (!fabricMatchesColor(f, t)) return false;
        }
        for (const term of parsed.textTerms) {
          if (!hay.includes(term)) return false;
        }
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
          : `<div class="fabric-thumb"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 4h10M7 20h10M9 4v16M15 4v16M9 8h6M9 11.5h6M9 15h6"/></svg></div>`}
        <div class="fabric-info">
          <h3>${esc(f.name)}</h3>
          <div class="fabric-meta">${esc([f.type, f.color, f.pattern].filter(Boolean).join(' · '))}
            ${(f.palette || []).length ? `<span class="card-swatches">${f.palette.slice(0, 3).map(hx =>
              `<span class="swatch sm" style="background:${esc(hx)}"></span>`).join('')}</span>` : ''}
          </div>
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

  function openForm(fabric) {
    $('fabric-form').reset();
    photoData = fabric?.photo || null;
    detectedColors = fabric ? {
      colorHex: fabric.colorHex || null,
      color2Hex: fabric.color2Hex || null,
      palette: fabric.palette || [],
    } : null;
    $('f-id').value = fabric?.id || '';
    $('f-name').value = fabric?.name || '';
    $('f-type').value = fabric?.type || '';
    $('f-weight').value = fabric?.weight || '';
    $('f-color').value = fabric?.color || '';
    $('f-color2').value = fabric?.color2 || '';
    $('f-tags').value = (fabric?.tags || []).join(', ');
    $('f-pattern').value = fabric?.pattern || '';
    $('f-yards').value = fabric?.yards ?? '';
    $('f-width').value = fabric?.width ?? '';
    $('f-fiber').value = fabric?.fiber || '';
    $('f-location').value = fabric?.location || '';
    $('f-notes').value = fabric?.notes || '';
    updatePhotoPreview();
    renderPaletteRow();
    renderFormThreadRow(fabric?.colorHex || null);
    $('detect-chip').classList.add('hidden');
    $('delete-fabric').classList.toggle('hidden', !fabric);
    showView('form');
  }

  function updatePhotoPreview() {
    const img = $('f-photo-preview');
    if (photoData) {
      img.src = photoData;
      img.classList.remove('hidden');
      $('photo-label').textContent = '🖼 Change photo';
      $('remove-photo').classList.remove('hidden');
    } else {
      img.removeAttribute('src');
      img.classList.add('hidden');
      $('photo-label').textContent = '🖼 Choose from Photos';
      $('remove-photo').classList.add('hidden');
    }
  }

  /* ---------- photo attribute agent ----------
   * On-device analysis of the uploaded photo: samples the pixels, clusters
   * hues, and measures texture (sheen, edge density, contrast) to suggest
   * the main color, solid-vs-print, and a best-guess material category.
   * Suggestions only fill fields that are still blank, and everything
   * stays editable — material from a photo is always a rough guess. */
  function analyzeFabricPhoto(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        // a fired onload with zero dimensions means the photo never
        // actually decoded — report nothing rather than reading black
        const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
        if (!W || !H) { resolve(null); return; }
        const N = 96;
        const canvas = document.createElement('canvas');
        canvas.width = N; canvas.height = N;
        const ctx = canvas.getContext('2d');
        // sample the center of the photo — the edges are often table,
        // background, or shadow rather than the fabric itself
        const cropX = W * 0.14, cropY = H * 0.14;
        ctx.drawImage(img, cropX, cropY, W - 2 * cropX, H - 2 * cropY, 0, 0, N, N);
        const data = ctx.getImageData(0, 0, N, N).data;

        // blank canvas means the draw silently failed — same deal
        let alphaSum = 0;
        for (let i = 3; i < data.length; i += 4) alphaSum += data[i];
        if (alphaSum / (data.length / 4) < 10) { resolve(null); return; }

        // auto-levels: phone cameras underexpose fabric close-ups badly, and
        // dim pixels read as "black". Stretch the luminance range of any
        // underexposed photo so its shadows-to-highlights span the full scale.
        const lums = [];
        for (let i = 0; i < data.length; i += 4) {
          lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
        }
        lums.sort((a, b) => a - b);
        const pct = q => lums[Math.min(lums.length - 1, Math.floor(lums.length * q))];
        const p50 = pct(0.5);
        // multiplicative gain preserves hue and saturation, unlike a
        // per-channel stretch which turns dim colors neon
        const gain = p50 > 0 && p50 < 96 ? Math.min(4, 100 / p50) : 1;
        const px = i => Math.min(255, data[i] * gain);

        const hueBuckets = {}; // named color -> pixel count
        const bucketRgb = {};  // named color -> [rSum, gSum, bSum]
        const lum = new Float32Array(N * N);
        let lightSum = 0, lightSqSum = 0, satSum = 0, highlightCount = 0;
        let blueCount = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = px(i) / 255, g = px(i + 1) / 255, b = px(i + 2) / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const l = (max + min) / 2;
          const d = max - min;
          const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
          let h = 0;
          if (d > 0) {
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h = (h * 60 + 360) % 360;
          }
          lum[count] = l;
          lightSum += l; lightSqSum += l * l; satSum += s;
          if (l > 0.92) highlightCount++;
          if (h >= 195 && h < 255 && s >= 0.12) blueCount++;
          count++;

          let name;
          // dark pixels lose saturation to camera noise, so require much
          // less of it before trusting the hue instead of calling it neutral
          const sCut = l < 0.3 ? 0.08 : 0.14;
          if (s < sCut) {
            name = l > 0.87 ? 'White' : l < 0.16 ? 'Black' : 'Gray';
          } else if (h < 15 || h >= 345) {
            name = l > 0.62 ? 'Pink' : 'Red';
          } else if (h < 45) {
            name = (s < 0.45 || l < 0.35) ? 'Brown / tan' : 'Orange';
          } else if (h < 68) {
            name = l > 0.82 && s < 0.4 ? 'Cream / ivory' : 'Yellow';
          } else if (h < 160) {
            name = 'Green';
          } else if (h < 195) {
            name = 'Teal';
          } else if (h < 255) {
            name = l < 0.28 ? 'Navy' : 'Blue';
          } else if (h < 300) {
            name = 'Purple';
          } else {
            name = 'Pink';
          }
          hueBuckets[name] = (hueBuckets[name] || 0) + 1;
          const acc = bucketRgb[name] || (bucketRgb[name] = [0, 0, 0]);
          acc[0] += px(i); acc[1] += px(i + 1); acc[2] += px(i + 2);
        }

        // texture: Sobel edge density + edge direction over the luminance field
        let edgeCount = 0, edgeTotal = 0, gxDom = 0, gyDom = 0;
        for (let y = 1; y < N - 1; y++) {
          for (let x = 1; x < N - 1; x++) {
            const i = y * N + x;
            const gx = (lum[i - N + 1] + 2 * lum[i + 1] + lum[i + N + 1])
                     - (lum[i - N - 1] + 2 * lum[i - 1] + lum[i + N - 1]);
            const gy = (lum[i + N - 1] + 2 * lum[i + N] + lum[i + N + 1])
                     - (lum[i - N - 1] + 2 * lum[i - N] + lum[i - N + 1]);
            if (Math.sqrt(gx * gx + gy * gy) > 0.28) {
              edgeCount++;
              const ax = Math.abs(gx), ay = Math.abs(gy);
              if (ax > 2 * ay) gxDom++;
              else if (ay > 2 * ax) gyDom++;
            }
            edgeTotal++;
          }
        }
        const edgeDensity = edgeCount / edgeTotal;
        const axisShare = edgeCount ? (gxDom + gyDom) / edgeCount : 0;
        const sheen = highlightCount / count;
        const meanSat = satSum / count;
        const meanL = lightSum / count;
        const stdL = Math.sqrt(Math.max(0, lightSqSum / count - meanL * meanL));
        const blueShare = blueCount / count;

        const ranked = Object.entries(hueBuckets).sort((a, b) => b[1] - a[1]);
        const topShare = ranked[0][1] / count;
        const strong = ranked.filter(([, n]) => n / count > 0.15);

        const hexOf = name => {
          const [rs, gs, bs] = bucketRgb[name];
          const n = hueBuckets[name];
          return '#' + [rs, gs, bs].map(v =>
            Math.round(v / n).toString(16).padStart(2, '0')).join('');
        };
        const primary = { name: ranked[0][0], hex: hexOf(ranked[0][0]) };
        const secondary = ranked[1] && ranked[1][1] / count > 0.1
          ? { name: ranked[1][0], hex: hexOf(ranked[1][0]) } : null;
        const palette = ranked.slice(0, 3)
          .filter(([, n]) => n / count > 0.08)
          .map(([name]) => hexOf(name));

        const multicolor = strong.length >= 3;
        const color = multicolor ? 'Multicolor / print' : primary.name;

        // pattern: solid → striped/checked (axis-aligned edges) → organic print
        const isSolid = !multicolor && topShare > 0.82 && stdL < 0.09;
        const patterned = multicolor || topShare < 0.7 || stdL >= 0.09;
        let pattern = '';
        if (isSolid) {
          pattern = 'Solid';
        } else if (patterned && edgeDensity > 0.08 && axisShare > 0.55) {
          const oneWay = gxDom > 3 * gyDom || gyDom > 3 * gxDom;
          pattern = oneWay ? 'Stripe' : 'Plaid / check';
        } else if (patterned && multicolor) {
          pattern = 'Floral';
        } else if (patterned && edgeDensity > 0.25) {
          pattern = 'Geometric';
        }

        // material guess, most-distinctive signals first
        let material = '', why = '';
        if (sheen > 0.06 && edgeDensity < 0.15 && !multicolor) {
          material = 'Satin / silky'; why = 'shiny highlights on a smooth surface';
        } else if (blueShare > 0.5 && meanSat > 0.12 && meanSat < 0.62 && meanL < 0.6 && !multicolor) {
          material = 'Denim / twill'; why = 'that classic muted denim blue';
        } else if (edgeDensity > 0.45 && stdL > 0.22) {
          material = 'Lace'; why = 'very open, high-contrast texture';
        } else if (multicolor) {
          material = 'Quilting cotton'; why = 'busy multicolor print, the quilting-cotton signature';
        } else if (edgeDensity < 0.06 && stdL < 0.08 && sheen < 0.03) {
          material = 'Cotton knit / jersey'; why = 'smooth matte surface';
        } else if (edgeDensity > 0.12 && edgeDensity <= 0.45 && meanSat < 0.38) {
          material = 'Linen'; why = 'visible weave texture in a muted color';
        }

        const parts = [color === 'Multicolor / print'
          ? 'multicolor print (' + strong.map(([n]) => n.split(' ')[0].toLowerCase()).join(', ') + ')'
          : ('mainly ' + primary.name.toLowerCase()
             + (secondary ? ' with ' + secondary.name.toLowerCase() : ''))];
        if (pattern) parts.push('looks ' + pattern.toLowerCase());
        if (material) parts.push('maybe ' + material.toLowerCase() + ' (' + why + ')');
        resolve({ color, pattern, material, primary, secondary, palette, summary: parts.join(' · ') });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function applyDetection(det) {
    const chip = $('detect-chip');
    if (!det) { chip.classList.add('hidden'); return; }
    detectedColors = {
      colorHex: det.primary?.hex || null,
      color2Hex: det.secondary?.hex || null,
      palette: det.palette || [],
    };
    const applied = [];
    if (!$('f-color').value && det.color) {
      $('f-color').value = det.color;
      applied.push('color');
    }
    if (!$('f-color2').value && det.secondary) {
      $('f-color2').value = det.secondary.name;
      applied.push('secondary');
    }
    if (!$('f-pattern').value && det.pattern) {
      $('f-pattern').value = det.pattern;
      applied.push('pattern');
    }
    if (!$('f-type').value && det.material) {
      $('f-type').value = det.material;
      applied.push('type');
    }
    renderPaletteRow();
    renderFormThreadRow(detectedColors.colorHex);
    chip.classList.remove('hidden');
    chip.textContent = 'Photo analysis: ' + det.summary
      + (applied.length ? ' — filled in ' + applied.join(' & ') + ' (edit if wrong)' : '');
  }

  /* Editable swatch circles in the form: detected colors can be corrected
   * by tapping, or set by hand on fabrics without a photo. */
  function renderPaletteRow() {
    const row = $('palette-row');
    const dc = detectedColors || {};
    const entries = [
      ['Primary color', dc.colorHex],
      ['Secondary color', dc.color2Hex],
    ];
    if ((dc.palette || []).length > 2 && dc.palette[2]) entries.push(['Accent color', dc.palette[2]]);
    row.classList.remove('hidden');
    row.innerHTML = '<span class="lbl">Colors — tap to edit:</span>'
      + entries.map(([label, hx], i) =>
        `<input type="color" class="swatch-edit${hx ? '' : ' unset'}" data-slot="${i}"
          value="${esc(hx || '#c9c1bb')}" title="${label}" aria-label="${label}">`).join('');
  }

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
    const sv = elId => { const v = $(elId).value; return v === '__new__' ? '' : v; };
    const fabric = {
      id,
      name: $('f-name').value.trim(),
      type: sv('f-type'),
      weight: sv('f-weight'),
      color: sv('f-color'),
      color2: sv('f-color2'),
      colorHex: detectedColors?.colorHex || existing?.colorHex || null,
      color2Hex: detectedColors?.color2Hex || existing?.color2Hex || null,
      palette: (detectedColors?.palette || existing?.palette || []).filter(Boolean),
      tags: $('f-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      pattern: sv('f-pattern'),
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

  function renderDetail(id) {
    const f = fabrics.find(x => x.id === id);
    if (!f) { showView('stash'); return; }
    currentDetailId = id;
    const s = IDEAS.suggestFor(f);
    const sw = hx => hx ? `<span class="swatch sm" style="background:${esc(hx)};display:inline-block;vertical-align:-2px;margin-right:4px"></span>` : '';
    const attrs = [
      ['Type', f.type], ['Weight', f.weight],
      ['Primary color', f.color, f.colorHex], ['Secondary color', f.color2, f.color2Hex],
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
        ${attrs.map(([k, v, hx]) => `<div class="attr"><div class="k">${k}</div><div class="v">${sw(hx)}${esc(v)}</div></div>`).join('')}
      </div>
      ${(f.tags || []).length ? `<div class="tags-row">${f.tags.map(t =>
        `<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      ${renderThreadSection(f)}
      ${f.notes ? `<div class="notes-block">${esc(f.notes)}</div>` : ''}
      ${s.now.length ? `
        <div class="idea-fabric">
          <h3>Enough yardage for</h3>
          <div class="idea-chips">
            ${s.now.map(p => `<span class="idea-chip now">${p.name} <span class="yd">~${p.yards} yd</span></span>`).join('')}
          </div>
        </div>` : ''}
      <button class="btn secondary" id="back-to-stash">← Back to stash</button>
    `;
    $('edit-fabric').onclick = () => openForm(f);
    $('back-to-stash').onclick = () => showView('stash');
    $('yd-minus').onclick = () => adjustYards(f, -0.25);
    $('yd-plus').onclick = () => adjustYards(f, 0.25);
  }

  /* ---------- thread matching ---------- */
  function renderThreadSection(f) {
    const colors = [['Primary', f.colorHex], ['Secondary', f.color2Hex]]
      .filter(([, hx]) => hx);
    if (!colors.length) return '';
    const owned = new Set(ownedThreads.map(t => t.id));
    const groups = colors.map(([label, hx]) => {
      const chips = THREADS.matchThreads(hx, 2).map(b =>
        b.matches.map(m => {
          const has = owned.has(threadId(b.brand, m.code));
          return `<button class="thread-chip ${has ? 'owned' : ''}"
            data-brand="${esc(b.brand)}" data-code="${esc(m.code)}"
            data-name="${esc(m.name)}" data-hex="${esc(m.hex)}">
            <span class="swatch sm" style="background:${esc(m.hex)}"></span>
            ${esc(brandShort(b.brand))} ${esc(m.code)} · ${esc(m.name)} ${has ? '✔' : '+'}
          </button>`;
        }).join('')).join('');
      return `${colors.length > 1 ? `<div class="thread-lbl">${label} color</div>` : ''}
        <div class="thread-color">${chips}</div>`;
    }).join('');
    return `<div class="thread-section">
      <h3>Matching thread</h3>
      ${groups}
      <p class="thread-note">✔ means it's in your thread drawer — tap a shade you own to
        add it. Matches are approximate; a bright-daylight photo matches best.</p>
    </div>`;
  }

  async function toggleThread(brand, code, name, hex) {
    const id = threadId(brand, code);
    const i = ownedThreads.findIndex(t => t.id === id);
    if (i >= 0) {
      ownedThreads.splice(i, 1);
      await DB.deleteThread(id);
    } else {
      const thread = { id, brand, code, name, hex, dateAdded: Date.now() };
      ownedThreads.push(thread);
      await DB.putThread(thread);
    }
    renderThreadDrawer();
  }

  function renderFormThreadRow(hex) {
    const row = $('form-thread-row');
    if (!hex) { row.classList.add('hidden'); return; }
    const best = THREADS.matchThreads(hex, 1)
      .filter(b => b.matches.length)
      .map(b => {
        const m = b.matches[0];
        return `<span class="swatch sm" style="background:${esc(m.hex)}"></span>
          <span style="font-size:0.8rem">${esc(brandShort(b.brand))} <strong>${esc(m.code)}</strong></span>`;
      }).join('');
    row.classList.remove('hidden');
    row.innerHTML = '<span class="lbl">Closest thread:</span>' + best;
  }

  function renderThreadDrawer() {
    const list = $('thread-list');
    if (!ownedThreads.length) {
      list.innerHTML = '<p class="muted">Nothing in the drawer yet.</p>';
      return;
    }
    list.innerHTML = ownedThreads
      .slice()
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.code.localeCompare(b.code))
      .map(t => `
        <div class="thread-row">
          <span class="swatch" style="background:${esc(t.hex || 'transparent')}"></span>
          <span><strong>${esc(t.code)}</strong>${t.name ? ' · ' + esc(t.name) : ''}
            <div class="meta">${esc(brandShort(t.brand))}</div></span>
          <button class="rm" data-id="${esc(t.id)}" aria-label="Remove">✕</button>
        </div>`).join('');
  }

  async function addThreadManually() {
    const brand = $('t-brand').value;
    const code = $('t-code').value.trim();
    if (!code) { $('thread-status').textContent = 'Type the color code first.'; return; }
    const known = THREADS.findShade(brand, code);
    const id = threadId(brand, code);
    if (ownedThreads.some(t => t.id === id)) {
      $('thread-status').textContent = 'Already in the drawer.';
      return;
    }
    const thread = {
      id, brand, code,
      name: known?.name || '',
      hex: known?.hex || null,
      dateAdded: Date.now(),
    };
    ownedThreads.push(thread);
    await DB.putThread(thread);
    renderThreadDrawer();
    $('t-code').value = '';
    $('thread-status').textContent = known
      ? `Added ${known.name} ✔`
      : `Added ${code} — code not in the built-in chart, so no swatch.`;
  }

  async function adjustYards(f, delta) {
    f.yards = Math.max(0, Math.round(((Number(f.yards) || 0) + delta) * 100) / 100);
    await DB.put(f);
    renderDetail(f.id);
    renderList();
  }

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
              ${s.now.map(p => `<span class="idea-chip now">${p.name} <span class="yd">~${p.yards} yd</span></span>`).join('')}
              ${s.almost.map(p => `<span class="idea-chip almost">${p.name} <span class="yd">needs ~${p.yards} yd</span></span>`).join('')}
            </div>
          </div>`;
      }).join('');
    el.innerHTML = `
      <p class="ideas-intro">Matched to each fabric's type and yardage —
      filled chips have enough on hand; dashed chips are within a yard of
      enough (a top-up trip to the fabric store!). Tap a fabric to open it.</p>
      ${sections || '<p class="ideas-intro">No suggestions yet — add fabric types and yardage to get ideas.</p>'}`;
    el.querySelectorAll('.idea-fabric').forEach(div => {
      div.addEventListener('click', () => { renderDetail(div.dataset.id); showView('detail'); });
    });
  }

  function exportStash() {
    const blob = new Blob([JSON.stringify({ version: 2, fabrics, threads: ownedThreads, customs }, null, 2)],
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
      if (data.customs && typeof data.customs === 'object') {
        for (const k of Object.keys(customs)) {
          for (const v of (Array.isArray(data.customs[k]) ? data.customs[k] : [])) {
            if (typeof v === 'string' && v.trim()) addCustom(k, v.trim());
          }
        }
        refreshCustomOptions();
      }
      if (Array.isArray(data.threads)) {
        for (const t of data.threads) {
          if (t && t.id && t.brand && t.code) await DB.putThread(t);
        }
        ownedThreads = await DB.getThreads();
        renderThreadDrawer();
      }
      renderList();
      $('settings-status').textContent = `Imported ${valid.length} fabric${valid.length === 1 ? '' : 's'} ✔`;
    } catch (err) {
      $('settings-status').textContent = 'Import failed: ' + err.message;
    }
  }

  function populateSelects() {
    $('f-type').innerHTML = '<option value="">—</option>' +
      IDEAS.FABRIC_TYPES.map(t => `<option>${t}</option>`).join('');
    const colorOpts = COLORS.map(c =>
      `<option value="${c}">${c || '—'}</option>`).join('');
    $('f-color').innerHTML = colorOpts;
    $('f-color2').innerHTML = colorOpts;
    $('t-brand').innerHTML = THREADS.BRANDS.map(b =>
      `<option value="${esc(b.name)}">${esc(brandShort(b.name))}</option>`).join('');
    refreshCustomOptions();
  }

  async function init() {
    populateSelects();
    wireCustomSelects();
    try {
      fabrics = await DB.getAll();
      ownedThreads = await DB.getThreads();
    } catch {
      fabrics = [];
    }
    renderList();
    renderThreadDrawer();

    // thread interactions: toggle on fabric detail, remove + manual add in drawer
    $('detail-content').addEventListener('click', async e => {
      const chip = e.target.closest('.thread-chip');
      if (!chip) return;
      await toggleThread(chip.dataset.brand, chip.dataset.code, chip.dataset.name, chip.dataset.hex);
      if (currentDetailId) renderDetail(currentDetailId);
    });
    $('thread-list').addEventListener('click', async e => {
      const rm = e.target.closest('.rm');
      if (!rm) return;
      ownedThreads = ownedThreads.filter(t => t.id !== rm.dataset.id);
      await DB.deleteThread(rm.dataset.id);
      renderThreadDrawer();
    });
    $('t-add').addEventListener('click', addThreadManually);

    // picking a named color from the dropdowns updates the stored hex too,
    // so the swatches and thread suggestions follow the manual choice
    const onNamedColor = slot => {
      const sel = slot === 0 ? $('f-color') : $('f-color2');
      const hx = NAMED_HEX[sel.value];
      if (!hx) return; // '—' or Multicolor: keep whatever the photo found
      if (!detectedColors) detectedColors = { colorHex: null, color2Hex: null, palette: [] };
      if (!Array.isArray(detectedColors.palette)) detectedColors.palette = [];
      if (slot === 0) { detectedColors.colorHex = hx; detectedColors.palette[0] = hx; }
      else { detectedColors.color2Hex = hx; detectedColors.palette[1] = hx; }
      renderPaletteRow();
      renderFormThreadRow(detectedColors.colorHex);
    };
    $('f-color').addEventListener('change', () => onNamedColor(0));
    $('f-color2').addEventListener('change', () => onNamedColor(1));

    // manual edits to the color swatch circles
    $('palette-row').addEventListener('input', e => {
      const el = e.target.closest('.swatch-edit');
      if (!el) return;
      if (!detectedColors) detectedColors = { colorHex: null, color2Hex: null, palette: [] };
      if (!Array.isArray(detectedColors.palette)) detectedColors.palette = [];
      const slot = +el.dataset.slot;
      const hex = el.value;
      el.classList.remove('unset');
      if (slot === 0) { detectedColors.colorHex = hex; detectedColors.palette[0] = hex; }
      else if (slot === 1) { detectedColors.color2Hex = hex; detectedColors.palette[1] = hex; }
      else { detectedColors.palette[slot] = hex; }
      renderFormThreadRow(detectedColors.colorHex);
    });

    // manual update check
    $('app-version').textContent = APP_VERSION;
    $('update-btn').addEventListener('click', async () => {
      const status = $('update-status');
      if (!('serviceWorker' in navigator)) {
        status.textContent = 'This copy updates itself — nothing to do here.';
        return;
      }
      status.textContent = 'Checking…';
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          status.textContent = 'This copy updates itself — nothing to do here.';
          return;
        }
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!reloaded) { reloaded = true; location.reload(); }
        });
        await reg.update();
        if (reg.installing || reg.waiting) {
          status.textContent = 'Update found — installing…';
          setTimeout(() => { if (!reloaded) { reloaded = true; location.reload(); } }, 5000);
        } else {
          status.textContent = `You're on the latest version (${APP_VERSION}) ✔`;
        }
      } catch {
        status.textContent = 'Could not check from here — this copy updates itself when online.';
      }
    });

    document.querySelectorAll('.tab[data-view]').forEach(t =>
      t.addEventListener('click', () => showView(t.dataset.view)));
    $('add-btn').addEventListener('click', () => openForm(null));
    $('cancel-form').addEventListener('click', () => showView(currentDetailId ? 'detail' : 'stash'));
    $('fabric-form').addEventListener('submit', saveForm);
    // two-tap delete: modal dialogs are blocked in sandboxed embeds
    let deleteArmed = false;
    const deleteBtn = $('delete-fabric');
    deleteBtn.addEventListener('click', async () => {
      const id = $('f-id').value;
      if (!id) return;
      if (!deleteArmed) {
        deleteArmed = true;
        deleteBtn.textContent = 'Tap again to delete for good';
        setTimeout(() => {
          deleteArmed = false;
          deleteBtn.textContent = 'Delete fabric';
        }, 3000);
        return;
      }
      deleteArmed = false;
      deleteBtn.textContent = 'Delete fabric';
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

    const onPhotoPicked = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const chip = $('detect-chip');
      chip.classList.remove('hidden');
      chip.innerHTML = '<span class="spin"></span> Analyzing photo…';
      try {
        photoData = await processPhoto(file);
        updatePhotoPreview();
        applyDetection(await analyzeFabricPhoto(photoData));
      } catch {
        chip.classList.add('hidden');
        $('photo-label').textContent = '⚠️ Could not read that photo — try another';
      }
      e.target.value = '';
    };
    $('f-photo').addEventListener('change', onPhotoPicked);
    $('f-photo-camera').addEventListener('change', onPhotoPicked);
    $('remove-photo').addEventListener('click', () => {
      photoData = null;
      updatePhotoPreview();
      $('detect-chip').classList.add('hidden');
    });

    // feedback: share via the system share sheet (text it over!) or open
    // a pre-filled GitHub issue; clipboard fallback when neither works
    let fbType = 'Idea';
    document.querySelectorAll('.seg[data-fb-type]').forEach(btn =>
      btn.addEventListener('click', () => {
        fbType = btn.dataset.fbType;
        document.querySelectorAll('.seg[data-fb-type]').forEach(b =>
          b.classList.toggle('active', b === btn));
      }));
    const fbMessage = () => {
      const text = $('fb-text').value.trim();
      if (!text) { $('fb-status').textContent = 'Write a little something first!'; return null; }
      return { text, full: `🧵 Fabric Stash ${fbType.toLowerCase()}:\n${text}` };
    };
    $('fb-share').addEventListener('click', async () => {
      const msg = fbMessage();
      if (!msg) return;
      try {
        if (navigator.share) {
          await navigator.share({ title: `Fabric Stash ${fbType.toLowerCase()}`, text: msg.full });
          $('fb-status').textContent = 'Shared ✔';
        } else {
          throw new Error('no share');
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // she closed the share sheet
        try {
          await navigator.clipboard.writeText(msg.full);
          $('fb-status').textContent = 'Copied to clipboard — paste it into a message ✔';
        } catch {
          $('fb-status').textContent = 'Sharing is blocked here — select the text above and copy it.';
        }
      }
      $('fb-text').value = '';
    });
    $('fb-github').addEventListener('click', () => {
      const msg = fbMessage();
      if (!msg) return;
      const title = encodeURIComponent(`[${fbType}] ` + msg.text.split('\n')[0].slice(0, 60));
      const body = encodeURIComponent(msg.text + '\n\n_Sent from the Fabric Stash app_');
      window.open(`https://github.com/alantgoff/fabrics/issues/new?title=${title}&body=${body}`, '_blank');
      $('fb-status').textContent = 'Opened GitHub — tap "Submit new issue" there to finish.';
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    $('export-btn').addEventListener('click', exportStash);
    $('import-input').addEventListener('change', e => {
      if (e.target.files[0]) importStash(e.target.files[0]);
      e.target.value = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
