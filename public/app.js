'use strict';

/* ── DOM refs ─────────────────────────────────────────────────────────────── */
const formCard     = document.getElementById('form-card');
const progressCard = document.getElementById('progress-card');
const resultsCard  = document.getElementById('results-card');
const form         = document.getElementById('extract-form');
const btnLaunch    = document.getElementById('btn-launch');
const btnLast      = document.getElementById('btn-last');
const btnNew       = document.getElementById('btn-new');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportJson= document.getElementById('btn-export-json');
const logBox       = document.getElementById('log-box');
const progressFill = document.getElementById('progress-fill');
const summaryRow   = document.getElementById('summary-row');
const genDate      = document.getElementById('gen-date');

genDate.textContent = new Date().toLocaleDateString('fr-FR');

/* ── State ────────────────────────────────────────────────────────────────── */
let currentJobId = null;
let pollTimer    = null;
let lastData     = null;

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
    tab.classList.add('active');
    const target = document.getElementById('tab-' + tab.dataset.tab);
    if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
  });
});

/* ── Form submit ──────────────────────────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    appAUrl:  document.getElementById('appAUrl').value.trim(),
    appAUser: document.getElementById('appAUser').value.trim(),
    appAPass: document.getElementById('appAPass').value,
    appBUrl:  document.getElementById('appBUrl').value.trim(),
    appBUser: document.getElementById('appBUser').value.trim(),
    appBPass: document.getElementById('appBPass').value,
  };

  btnLaunch.disabled = true;
  btnLaunch.textContent = '⏳ Lancement…';

  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { alert('Erreur: ' + (data.error || 'inconnue')); resetBtn(); return; }
    currentJobId = data.jobId;
    showProgress();
    startPolling();
  } catch (err) {
    alert('Erreur réseau: ' + err.message);
    resetBtn();
  }
});

/* ── Last result ──────────────────────────────────────────────────────────── */
btnLast.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/last-result');
    if (!res.ok) { alert('Aucun résultat précédent disponible.'); return; }
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    alert('Erreur: ' + err.message);
  }
});

/* ── New extraction ───────────────────────────────────────────────────────── */
btnNew.addEventListener('click', () => {
  clearInterval(pollTimer);
  resultsCard.classList.add('hidden');
  progressCard.classList.add('hidden');
  formCard.classList.remove('hidden');
  resetBtn();
});

/* ── Export ───────────────────────────────────────────────────────────────── */
btnExportJson.addEventListener('click', () => {
  if (!lastData) return;
  download('comparaison-rh.json', 'application/json', JSON.stringify(lastData, null, 2));
});

btnExportCsv.addEventListener('click', () => {
  if (!lastData) return;
  download('comparaison-rh.csv', 'text/csv', buildCsv(lastData));
});

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function validateForm() {
  let ok = true;
  form.querySelectorAll('input[required]').forEach(inp => {
    inp.classList.remove('invalid');
    if (!inp.value.trim()) { inp.classList.add('invalid'); ok = false; }
  });
  ['appAUrl','appBUrl'].forEach(id => {
    const el = document.getElementById(id);
    try { new URL(el.value.trim()); el.classList.remove('invalid'); }
    catch { el.classList.add('invalid'); ok = false; }
  });
  if (!ok) alert('Veuillez remplir tous les champs correctement.');
  return ok;
}

function resetBtn() {
  btnLaunch.disabled = false;
  btnLaunch.innerHTML = '<span class="btn-icon">🚀</span> Lancer l\'extraction';
}

function showProgress() {
  formCard.classList.add('hidden');
  resultsCard.classList.add('hidden');
  progressCard.classList.remove('hidden');
  logBox.textContent = '';
}

function startPolling() {
  pollTimer = setInterval(pollJob, 2500);
}

async function pollJob() {
  if (!currentJobId) return;
  try {
    const res = await fetch('/api/status/' + currentJobId);
    const data = await res.json();

    // Update logs
    logBox.textContent = data.logs.join('\n');
    logBox.scrollTop = logBox.scrollHeight;

    if (data.status === 'done') {
      clearInterval(pollTimer);
      renderResults(data.result);
    } else if (data.status === 'error') {
      clearInterval(pollTimer);
      logBox.textContent += '\n\n❌ ERREUR: ' + (data.error || '');
      progressFill.style.animation = 'none';
      progressFill.style.width = '100%';
      progressFill.style.background = '#dc2626';
    }
  } catch (err) {
    console.error('Poll error:', err);
  }
}

/* ── Render results ───────────────────────────────────────────────────────── */
function renderResults(data) {
  lastData = data;
  progressCard.classList.add('hidden');
  formCard.classList.add('hidden');
  resultsCard.classList.remove('hidden');

  // Update gen date
  if (data.generatedAt) {
    genDate.textContent = new Date(data.generatedAt).toLocaleString('fr-FR');
  }

  const app4 = data.app4you || {};
  const appS7 = data.appS7  || {};
  const hier4 = app4.hierarchy  || {};
  const hierS7 = appS7.hierarchy || {};

  // ── Summary badges ──
  const domains4 = Object.keys(hier4).length;
  const domainsS7 = Object.keys(hierS7).length;
  const allDomains = new Set([...Object.keys(hier4), ...Object.keys(hierS7)]);
  const common  = [...allDomains].filter(d => hier4[d] && hierS7[d]).length;
  const only4   = [...allDomains].filter(d => hier4[d] && !hierS7[d]).length;
  const onlyS7  = [...allDomains].filter(d => !hier4[d] && hierS7[d]).length;

  summaryRow.innerHTML = `
    <span class="badge badge-blue">📘 4YOU : ${domains4} domaine(s)</span>
    <span class="badge badge-purple">📗 S7 : ${domainsS7} domaine(s)</span>
    <span class="badge badge-green">✅ Commun : ${common}</span>
    <span class="badge badge-red">❌ 4YOU seulement : ${only4}</span>
    <span class="badge badge-orange">⚠️ S7 seulement : ${onlyS7}</span>
  `;

  // ── Tab: Comparison ──
  document.getElementById('tab-comparison').innerHTML = buildComparisonTab(hier4, hierS7, allDomains);

  // ── Tab: 4YOU only ──
  document.getElementById('tab-4you').innerHTML = buildHierarchyTree(hier4, 'a');

  // ── Tab: S7 only ──
  document.getElementById('tab-s7').innerHTML = buildHierarchyTree(hierS7, 'b');

  // ── Tab: Common ──
  const commonHier = {};
  for (const d of allDomains) {
    if (hier4[d] && hierS7[d]) commonHier[d] = hier4[d];
  }
  document.getElementById('tab-common').innerHTML = buildHierarchyTree(commonHier, 'both');

  // Wire accordion toggles
  document.querySelectorAll('.tree-domain-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.tree-domain').classList.toggle('open'));
  });
}

/* ── Comparison tab ───────────────────────────────────────────────────────── */
function buildComparisonTab(hier4, hierS7, allDomains) {
  const rows = [];
  rows.push(`
    <div class="table-wrap">
    <table class="comp-table">
      <thead><tr>
        <th>Domaine</th>
        <th>Thème</th>
        <th>Actions fonctionnelles</th>
        <th>4YOU</th>
        <th>S7</th>
      </tr></thead>
      <tbody>
  `);

  for (const domain of [...allDomains].sort()) {
    const d4 = hier4[domain];
    const d7 = hierS7[domain];
    const inA = !!d4 && d4.__status !== 'not-clickable';
    const inB = !!d7 && d7.__status !== 'not-clickable';
    const themes4 = (d4 && d4.themes) ? d4.themes : {};
    const themes7 = (d7 && d7.themes) ? d7.themes : {};
    const allThemes = new Set([...Object.keys(themes4), ...Object.keys(themes7)]);

    const domainClass = inA && inB ? 'has-both' : inA ? 'has-a' : 'has-b';
    const pill = inA && inB
      ? '<span class="pill pill-both">Commun</span>'
      : inA
        ? '<span class="pill pill-a">4YOU</span>'
        : '<span class="pill pill-b">S7</span>';

    if (allThemes.size === 0) {
      rows.push(`<tr>
        <td class="domain ${domainClass}">${esc(domain)}${pill}</td>
        <td colspan="3" class="missing">—</td>
        <td>${inA ? '✅' : '—'}</td>
        <td>${inB ? '✅' : '—'}</td>
      </tr>`);
      continue;
    }

    let first = true;
    for (const theme of [...allThemes].sort()) {
      const actions4 = themes4[theme] || [];
      const actions7 = themes7[theme] || [];
      const allActions = new Set([...actions4, ...actions7]);
      const tInA = !!themes4[theme];
      const tInB = !!themes7[theme];

      if (allActions.size === 0) {
        rows.push(`<tr>
          <td class="domain ${domainClass}">${first ? esc(domain) + pill : ''}</td>
          <td class="theme">${esc(theme)}</td>
          <td class="missing">—</td>
          <td>${tInA ? '✅' : '—'}</td>
          <td>${tInB ? '✅' : '—'}</td>
        </tr>`);
        first = false;
        continue;
      }

      for (const action of [...allActions].sort()) {
        const aInA = actions4.includes(action);
        const aInB = actions7.includes(action);
        rows.push(`<tr>
          <td class="domain ${domainClass}">${first ? esc(domain) + pill : ''}</td>
          <td class="theme">${first ? esc(theme) : ''}</td>
          <td class="action">${esc(action)}</td>
          <td>${aInA ? '✅' : '—'}</td>
          <td>${aInB ? '✅' : '—'}</td>
        </tr>`);
        first = false;
      }
    }
  }

  rows.push('</tbody></table></div>');
  return rows.join('');
}

/* ── Hierarchy tree ───────────────────────────────────────────────────────── */
function buildHierarchyTree(hierarchy, variant) {
  if (!Object.keys(hierarchy).length) return '<p style="padding:.5rem;color:var(--gray-400)">Aucune donnée.</p>';

  const themeColor = variant === 'a' ? 'var(--a-color)' : variant === 'b' ? 'var(--b-color)' : 'var(--green)';

  const items = Object.entries(hierarchy).map(([domain, payload]) => {
    const themes = (payload && payload.themes) ? payload.themes : {};
    const themesHtml = Object.entries(themes).map(([theme, actions]) => {
      const chips = (actions || []).map(a => `<span class="action-chip">${esc(a)}</span>`).join('');
      return `
        <div class="tree-theme">
          <div class="tree-theme-name" style="border-color:${themeColor}">${esc(theme)}</div>
          <div class="tree-actions">${chips || '<span style="color:var(--gray-400);font-size:.75rem">Aucune action détectée</span>'}</div>
        </div>`;
    }).join('');

    const count = Object.keys(themes).length;
    return `
      <li class="tree-domain">
        <div class="tree-domain-header">
          <span class="tree-domain-name">${esc(domain)}</span>
          <span style="display:flex;align-items:center;gap:.5rem">
            <span class="badge badge-blue">${count} thème(s)</span>
            <span class="chevron">▶</span>
          </span>
        </div>
        <div class="tree-domain-body">${themesHtml || '<p style="color:var(--gray-400);font-size:.82rem;padding:.25rem 0">Non cliquable ou aucun thème détecté</p>'}</div>
      </li>`;
  }).join('');

  return `<ul class="tree">${items}</ul>`;
}

/* ── CSV builder ──────────────────────────────────────────────────────────── */
function buildCsv(data) {
  const rows = [['Domaine', 'Thème', 'Action fonctionnelle', '4YOU', 'S7']];
  const hier4 = (data.app4you && data.app4you.hierarchy) || {};
  const hierS7 = (data.appS7  && data.appS7.hierarchy)  || {};
  const allDomains = new Set([...Object.keys(hier4), ...Object.keys(hierS7)]);

  for (const domain of [...allDomains].sort()) {
    const themes4 = (hier4[domain] && hier4[domain].themes) || {};
    const themes7 = (hierS7[domain] && hierS7[domain].themes) || {};
    const allThemes = new Set([...Object.keys(themes4), ...Object.keys(themes7)]);

    if (!allThemes.size) { rows.push([domain, '', '', hier4[domain] ? 'oui' : '', hierS7[domain] ? 'oui' : '']); continue; }

    for (const theme of [...allThemes].sort()) {
      const a4 = themes4[theme] || [];
      const a7 = themes7[theme] || [];
      const allActions = new Set([...a4, ...a7]);
      if (!allActions.size) { rows.push([domain, theme, '', a4.length ? 'oui' : '', a7.length ? 'oui' : '']); continue; }
      for (const action of [...allActions].sort()) {
        rows.push([domain, theme, action, a4.includes(action) ? 'oui' : '', a7.includes(action) ? 'oui' : '']);
      }
    }
  }

  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/* ── Utility ──────────────────────────────────────────────────────────────── */
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
