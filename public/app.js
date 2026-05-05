
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
const summaryRow   = document.getElementById('summary-row');
const genDate      = document.getElementById('gen-date');

genDate.textContent = new Date().toLocaleDateString('fr-FR');

/* ── State ────────────────────────────────────────────────────────────────── */
let currentJobId = null;
let pollTimer    = null;
let lastData     = null;

/* ── Auto-load last result on startup ────────────────────────────────────── */
window.addEventListener('load', async () => {
	try {
		const res = await fetch('/api/last-result');
		if (res.ok) renderResults(await res.json());
	} catch { /* pas de résultat précédent */ }
});

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
		appAUrl: document.getElementById('appAUrl').value.trim(),
		appAUser: document.getElementById('appAUser').value.trim(),
		appAPass: document.getElementById('appAPass').value,
		appBUrl: document.getElementById('appBUrl').value.trim(),
		appBUser: document.getElementById('appBUser').value.trim(),
		appBPass: document.getElementById('appBPass').value,
	};
	btnLaunch.disabled = true;
	btnLaunch.innerHTML = '⏳ Lancement…';
	try {
		const res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
		const data = await res.json();
		if (!res.ok) { alert('Erreur: ' + (data.error || 'inconnue')); resetBtn(); return; }
		currentJobId = data.jobId;
		showProgress();
		startPolling();
	} catch (err) { alert('Erreur réseau: ' + err.message); resetBtn(); }
});

btnLast.addEventListener('click', async () => {
	try {
		const res = await fetch('/api/last-result');
		if (!res.ok) { alert('Aucun résultat précédent disponible.'); return; }
		renderResults(await res.json());
	} catch (err) { alert('Erreur: ' + err.message); }
});

btnNew.addEventListener('click', () => {
	clearInterval(pollTimer);
	resultsCard.classList.add('hidden');
	progressCard.classList.add('hidden');
	formCard.classList.remove('hidden');
	resetBtn();
});

btnExportJson.addEventListener('click', () => { if (lastData) download('comparaison-rh.json', 'application/json', JSON.stringify(lastData, null, 2)); });
btnExportCsv.addEventListener('click',  () => { if (lastData) download('comparaison-rh.csv',  'text/csv', buildCsv(lastData)); });

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function validateForm() {
	let ok = true;
	form.querySelectorAll('input[required]').forEach(inp => { inp.classList.remove('invalid'); if (!inp.value.trim()) { inp.classList.add('invalid'); ok = false; } });
	['appAUrl','appBUrl'].forEach(id => { const el = document.getElementById(id); try { new URL(el.value.trim()); el.classList.remove('invalid'); } catch { el.classList.add('invalid'); ok = false; } });
	if (!ok) alert('Veuillez remplir tous les champs correctement.');
	return ok;
}
function resetBtn() { btnLaunch.disabled = false; btnLaunch.innerHTML = '<span class="btn-icon">🚀</span> Lancer l\'extraction'; }
function showProgress() { formCard.classList.add('hidden'); resultsCard.classList.add('hidden'); progressCard.classList.remove('hidden'); logBox.textContent = ''; }
function startPolling() { pollTimer = setInterval(pollJob, 2500); }

async function pollJob() {
	if (!currentJobId) return;
	try {
		const res = await fetch('/api/status/' + currentJobId);
		const data = await res.json();
		logBox.textContent = data.logs.join('\n');
		logBox.scrollTop = logBox.scrollHeight;
		if (data.status === 'done') { clearInterval(pollTimer); renderResults(data.result); }
		else if (data.status === 'error') { clearInterval(pollTimer); logBox.textContent += '\n\n❌ ERREUR: ' + (data.error || ''); }
	} catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════
	 RENDER RESULTS
══════════════════════════════════════════════════════════════════════════════ */
function renderResults(data) {
	lastData = data;
	progressCard.classList.add('hidden');
	formCard.classList.add('hidden');
	resultsCard.classList.remove('hidden');
	if (data.generatedAt) genDate.textContent = new Date(data.generatedAt).toLocaleString('fr-FR');

	const hier4  = (data.app4you && data.app4you.hierarchy) || {};
	const hierS7 = (data.appS7  && data.appS7.hierarchy)   || {};
	const allDomains = [...new Set([...Object.keys(hier4), ...Object.keys(hierS7)])].sort();

	const common = allDomains.filter(d => hier4[d] && hierS7[d]).length;
	const only4  = allDomains.filter(d => hier4[d] && !hierS7[d]).length;
	const onlyS7 = allDomains.filter(d => !hier4[d] && hierS7[d]).length;

	summaryRow.innerHTML = `
		<span class="badge badge-blue">📘 4YOU : ${Object.keys(hier4).length} domaine(s)</span>
		<span class="badge badge-purple">📗 S7 : ${Object.keys(hierS7).length} domaine(s)</span>
		<span class="badge badge-green">✅ Commun : ${common}</span>
		<span class="badge badge-red">❌ 4YOU uniquement : ${only4}</span>
		<span class="badge badge-orange">⚠️ S7 uniquement : ${onlyS7}</span>`;

	document.getElementById('tab-sidebyside').innerHTML = buildSideBySide(hier4, hierS7, allDomains);
	document.getElementById('tab-comparison').innerHTML = buildComparisonTable(hier4, hierS7, allDomains);
	document.getElementById('tab-4you').innerHTML       = buildAppMenu(hier4,  'a', '4YOU');
	document.getElementById('tab-s7').innerHTML         = buildAppMenu(hierS7, 'b', 'S7 / HRa');

	document.querySelectorAll('.acc-header').forEach(h => {
		h.addEventListener('click', () => h.closest('.acc-item').classList.toggle('open'));
	});
}

/* ── Side-by-side (onglet principal) ─────────────────────────────────────── */
function buildSideBySide(hier4, hierS7, allDomains) {
	const rows = allDomains.map(domain => {
		const d4 = hier4[domain]; const d7 = hierS7[domain];
		const inA = !!d4 && d4.__status !== 'not-clickable';
		const inB = !!d7 && d7.__status !== 'not-clickable';
		const themes4 = (d4 && d4.themes) ? d4.themes : null;
		const themes7 = (d7 && d7.themes) ? d7.themes : null;
		let cls = 'domain-both';
		if (inA && !inB) cls = 'domain-a-only';
		else if (!inA && inB) cls = 'domain-b-only';
		const colA = themes4 ? buildMenuCol(themes4, 'a') : '<span class="not-in">— Absent dans 4YOU —</span>';
		const colB = themes7 ? buildMenuCol(themes7, 'b') : '<span class="not-in">— Absent dans S7 —</span>';
		return `
			<div class="acc-item domain-block ${cls}">
				<div class="acc-header">
					<span class="domain-name">${esc(domain)}</span>
					<div class="domain-pills">
						${inA ? '<span class="pill pill-a">4YOU ✓</span>' : '<span class="pill pill-miss">4YOU ✗</span>'}
						${inB ? '<span class="pill pill-b">S7 ✓</span>'   : '<span class="pill pill-miss">S7 ✗</span>'}
					</div>
					<span class="chevron">▶</span>
				</div>
				<div class="acc-body">
					<div class="side-grid">
						<div class="side-col">
							<div class="col-header col-header-a">📘 4YOU</div>
							${colA}
						</div>
						<div class="side-col">
							<div class="col-header col-header-b">📗 S7 / HRa</div>
							${colB}
						</div>
					</div>
				</div>
			</div>`;
	}).join('');
	return `<div class="acc-list">${rows}</div>`;
}

function buildMenuCol(themes, variant) {
	if (!themes || !Object.keys(themes).length) return '<span class="not-in">Aucun thème détecté</span>';
	return Object.entries(themes).map(([theme, actions]) => {
		const chips = (actions || []).map(a => `<span class="action-chip chip-${variant}">${esc(a)}</span>`).join('');
		return `<div class="theme-block">
			<div class="theme-name theme-${variant}">▸ ${esc(theme)}</div>
			<div class="actions-wrap">${chips || '<span class="no-action">Aucune action</span>'}</div>
		</div>`;
	}).join('');
}

/* ── Menu complet par app ─────────────────────────────────────────────────── */
function buildAppMenu(hierarchy, variant, label) {
	if (!Object.keys(hierarchy).length) return '<p class="empty-msg">Aucune donnée disponible.</p>';
	const items = Object.entries(hierarchy).map(([domain, payload]) => {
		const themes = (payload && payload.themes) ? payload.themes : {};
		const themesHtml = Object.entries(themes).map(([theme, actions]) => {
			const chips = (actions || []).map(a => `<span class="action-chip chip-${variant}">${esc(a)}</span>`).join('');
			return `<div class="theme-block">
				<div class="theme-name theme-${variant}">▸ ${esc(theme)}</div>
				<div class="actions-wrap">${chips || '<span class="no-action">Aucune action détectée</span>'}</div>
			</div>`;
		}).join('');
		const count = Object.keys(themes).length;
		const notClick = (payload && payload.__status === 'not-clickable') ? '<span class="pill pill-miss">non cliquable</span>' : '';
		return `
			<div class="acc-item domain-block domain-${variant}">
				<div class="acc-header">
					<span class="domain-name">${esc(domain)} ${notClick}</span>
					<span class="badge badge-${variant === 'a' ? 'blue' : 'purple'}">${count} thème(s)</span>
					<span class="chevron">▶</span>
				</div>
				<div class="acc-body">${themesHtml || '<span class="not-in">Aucun thème détecté</span>'}</div>
			</div>`;
	}).join('');
	return `<div class="acc-list">${items}</div>`;
}

/* ── Tableau de comparaison ───────────────────────────────────────────────── */
function buildComparisonTable(hier4, hierS7, allDomains) {
	const rows = [];
	rows.push(`<div class="table-wrap"><table class="comp-table"><thead><tr>
		<th>Domaine</th><th>Thème</th><th>Action fonctionnelle</th><th>📘 4YOU</th><th>📗 S7</th>
	</tr></thead><tbody>`);
	for (const domain of allDomains) {
		const themes4 = (hier4[domain] && hier4[domain].themes) || {};
		const themes7 = (hierS7[domain] && hierS7[domain].themes) || {};
		const allThemes = [...new Set([...Object.keys(themes4), ...Object.keys(themes7)])].sort();
		const inA = !!hier4[domain]; const inB = !!hierS7[domain];
		const rc = inA && inB ? '' : inA ? 'row-a-only' : 'row-b-only';
		if (!allThemes.length) { rows.push(`<tr class="${rc}"><td class="td-domain">${esc(domain)}</td><td colspan="3" class="td-empty">—</td><td>${inA?'✅':'—'}</td><td>${inB?'✅':'—'}</td></tr>`); continue; }
		let fd = true;
		for (const theme of allThemes) {
			const a4 = themes4[theme]||[]; const a7 = themes7[theme]||[];
			const allActs = [...new Set([...a4,...a7])].sort();
			const tInA = !!themes4[theme]; const tInB = !!themes7[theme];
			if (!allActs.length) { rows.push(`<tr class="${rc}"><td class="td-domain">${fd?esc(domain):''}</td><td class="td-theme">${esc(theme)}</td><td class="td-empty">—</td><td>${tInA?'✅':'—'}</td><td>${tInB?'✅':'—'}</td></tr>`); fd=false; continue; }
			let ft = true;
			for (const action of allActs) {
				rows.push(`<tr class="${rc}"><td class="td-domain">${fd?esc(domain):''}</td><td class="td-theme">${ft?esc(theme):''}</td><td class="td-action">${esc(action)}</td><td>${a4.includes(action)?'✅':'—'}</td><td>${a7.includes(action)?'✅':'—'}</td></tr>`);
				fd=false; ft=false;
			}
		}
	}
	rows.push('</tbody></table></div>');
	return rows.join('');
}

/* ── CSV ──────────────────────────────────────────────────────────────────── */
function buildCsv(data) {
	const rows = [['Domaine','Thème','Action fonctionnelle','4YOU','S7']];
	const hier4 = (data.app4you && data.app4you.hierarchy)||{};
	const hierS7 = (data.appS7  && data.appS7.hierarchy) ||{};
	const all = [...new Set([...Object.keys(hier4),...Object.keys(hierS7)])].sort();
	for (const d of all) {
		const t4=(hier4[d]&&hier4[d].themes)||{}; const t7=(hierS7[d]&&hierS7[d].themes)||{};
		const themes=[...new Set([...Object.keys(t4),...Object.keys(t7)])].sort();
		if (!themes.length){rows.push([d,'','',hier4[d]?'oui':'',hierS7[d]?'oui':'']);continue;}
		for (const t of themes) {
			const a4=t4[t]||[]; const a7=t7[t]||[];
			const acts=[...new Set([...a4,...a7])].sort();
			if (!acts.length){rows.push([d,t,'',a4.length?'oui':'',a7.length?'oui':'']);continue;}
			for (const a of acts) rows.push([d,t,a,a4.includes(a)?'oui':'',a7.includes(a)?'oui':'']);
		}
	}
	return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
}

/* ── Utils ────────────────────────────────────────────────────────────────── */
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function download(filename, mime, content) {
	const blob = new Blob([content],{type:mime}); const a=document.createElement('a');
	a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}

