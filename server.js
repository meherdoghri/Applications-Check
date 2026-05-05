'use strict';

const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active extraction jobs: jobId → { status, logs, result, error }
const jobs = new Map();

// ─── POST /api/extract ────────────────────────────────────────────────────────
app.post('/api/extract', (req, res) => {
  const { appAUrl, appAUser, appAPass, appBUrl, appBUser, appBPass } = req.body;

  if (!appAUrl || !appAUser || !appAPass || !appBUrl || !appBUser || !appBPass) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  // Basic URL validation
  try {
    new URL(appAUrl);
    new URL(appBUrl);
  } catch {
    return res.status(400).json({ error: 'URL invalide.' });
  }

  const jobId = crypto.randomUUID();
  jobs.set(jobId, { status: 'running', logs: [], result: null, error: null });

  // Build env for child process
  const env = {
    ...process.env,
    APP_A_BASE_URL: appAUrl,
    APP_A_USERNAME: appAUser,
    APP_A_PASSWORD: appAPass,
    APP_B_BASE_URL: appBUrl,
    APP_B_USERNAME: appBUser,
    APP_B_PASSWORD: appBPass,
    HEADLESS: 'true',
    BROWSER_CHANNEL: 'chrome',
    JOB_ID: jobId,
  };

  const child = spawn(
    process.execPath, // node
    [path.join(__dirname, 'src', 'extract-hierarchy-live.js')],
    {
      env,
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const job = jobs.get(jobId);

  child.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) job.logs.push(line);
  });

  child.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) job.logs.push('[ERR] ' + line);
  });

  child.on('close', (code) => {
    const outPath = path.join(__dirname, 'test-results', '4you-s7-hierarchy-live.json');
    if (code === 0 && fs.existsSync(outPath)) {
      try {
        job.result = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        job.status = 'done';
      } catch {
        job.status = 'error';
        job.error = 'Impossible de lire le fichier résultat.';
      }
    } else {
      job.status = 'error';
      job.error = `Le processus s'est terminé avec le code ${code}.`;
    }
  });

  res.json({ jobId });
});

// ─── GET /api/status/:jobId ───────────────────────────────────────────────────
app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job introuvable.' });

  res.json({
    status: job.status,
    logs: job.logs,
    result: job.result,
    error: job.error,
  });
});

// ─── GET /api/last-result ─────────────────────────────────────────────────────
app.get('/api/last-result', (req, res) => {
  const outPath = path.join(__dirname, 'test-results', '4you-s7-hierarchy-live.json');
  if (!fs.existsSync(outPath)) {
    return res.status(404).json({ error: 'Aucun résultat disponible.' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Erreur de lecture du résultat.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅  Serveur démarré sur http://localhost:${PORT}`);
  // Ouvrir automatiquement le navigateur
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn('Impossible d\'ouvrir le navigateur automatiquement:', err.message);
  });
});
