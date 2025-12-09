const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const defender = require('./defender');
const { ScanManager } = require('./scan_manager');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PORT_TRIES = Number(process.env.PORT_TRIES || 20);
const HEALTH_CACHE_MS = Number(process.env.HEALTH_CACHE_MS || 15000);

let lastHealth = null;
let lastHealthAt = 0;

const scanManager = new ScanManager(defender);

let autoUpdateEnabled = (process.env.SIGNATURE_AUTO_UPDATE || 'true').toString().toLowerCase() === 'true' || (process.env.SIGNATURE_AUTO_UPDATE || '1') === '1';
let autoUpdateIntervalMs = Math.max(10, Number(process.env.SIGNATURE_UPDATE_INTERVAL_MINUTES || 180)) * 60 * 1000;
let sigUpdateTimer = null;
let lastSigUpdate = { at: null, ok: null, error: null };

async function doSignatureUpdate() {
  try {
    const r = await defender.updateSignatures();
    lastSigUpdate = { at: new Date().toISOString(), ok: true, error: null, result: r };
  } catch (e) {
    lastSigUpdate = { at: new Date().toISOString(), ok: false, error: String(e && e.message || e) };
  }
}

function scheduleSignatureUpdates() {
  if (sigUpdateTimer) { clearInterval(sigUpdateTimer); sigUpdateTimer = null; }
  if (autoUpdateEnabled) {
    sigUpdateTimer = setInterval(() => { doSignatureUpdate().catch(() => {}); }, autoUpdateIntervalMs);
  }
}

let AUTH_TOKEN = process.env.AUTH_TOKEN || '';
if (!AUTH_TOKEN) {
  AUTH_TOKEN = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  console.log('AUTH_TOKEN=', AUTH_TOKEN);
}

app.use(helmet());
app.use(cors({ origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/], methods: ['GET','POST'], allowedHeaders: ['Content-Type','x-auth-token'] }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.redirect('/health');
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use('/ui', express.static(path.join(__dirname, '..', 'public')));
app.get('/ui', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token || token !== AUTH_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.get('/health', async (req, res) => {
  try {
    const now = Date.now();
    if (lastHealth && now - lastHealthAt < HEALTH_CACHE_MS) {
      return res.json(lastHealth);
    }
    const available = await defender.defenderAvailable();
    const admin = await defender.isAdmin();
    const payload = { ok: true, defenderAvailable: available, isAdmin: admin };
    lastHealth = payload;
    lastHealthAt = now;
    res.json(payload);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/status', requireAuth, async (req, res) => {
  try {
    const status = await defender.getStatus();
    res.json({ ok: true, status });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/signatures/update', requireAuth, async (req, res) => {
  try {
    const result = await defender.updateSignatures();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/signatures/status', requireAuth, async (req, res) => {
  try {
    const status = await defender.getStatus();
    const versions = {
      engineVersion: status.AMEngineVersion || status.EngineVersion || null,
      productVersion: status.AMProductVersion || status.ProductVersion || null,
      antivirusSignature: status.AntivirusSignatureVersion || null,
      antispywareSignature: status.AntispywareSignatureVersion || null,
      nisSignature: status.NISSignatureVersion || null,
      lastUpdated: status.SignatureLastUpdated || status.AntivirusSignatureLastUpdated || status.AntispywareSignatureLastUpdated || null,
    };
    res.json({ ok: true, versions, autoUpdate: { enabled: autoUpdateEnabled, intervalMinutes: Math.round(autoUpdateIntervalMs / 60000) }, lastUpdate: lastSigUpdate });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/signatures/auto-update', requireAuth, (req, res) => {
  res.json({ ok: true, enabled: autoUpdateEnabled, intervalMinutes: Math.round(autoUpdateIntervalMs / 60000), lastUpdate: lastSigUpdate });
});

app.post('/signatures/auto-update', requireAuth, (req, res) => {
  try {
    const { enabled, intervalMinutes } = req.body || {};
    if (typeof enabled === 'boolean') autoUpdateEnabled = enabled;
    if (intervalMinutes !== undefined) {
      const m = Math.max(10, Number(intervalMinutes));
      if (Number.isFinite(m)) autoUpdateIntervalMs = m * 60 * 1000;
    }
    scheduleSignatureUpdates();
    res.json({ ok: true, enabled: autoUpdateEnabled, intervalMinutes: Math.round(autoUpdateIntervalMs / 60000) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/scan/quick', requireAuth, async (req, res) => {
  try {
    await doSignatureUpdate().catch(() => {});
    // Use system drive(s) for quick scan (C:\)
    const paths = [process.env.SystemDrive || 'C:'];
    const job = scanManager.create(paths);
    res.json({ ok: true, jobId: job.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/scan/full', requireAuth, async (req, res) => {
  try {
    await doSignatureUpdate().catch(() => {});
    // Use all root drives for full scan (e.g., C:\, D:\, etc.)
    const drives = [process.env.SystemDrive || 'C:'];
    // Optionally add more logic to detect all drives
    const paths = drives;
    const job = scanManager.create(paths);
    res.json({ ok: true, jobId: job.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/scan/custom', requireAuth, async (req, res) => {
  try {
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ ok: false, error: 'paths must be a non-empty array' });
    await doSignatureUpdate().catch(() => {});
    const job = scanManager.create(paths);
    res.json({ ok: true, jobId: job.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/scan/track', requireAuth, async (req, res) => {
  try {
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ ok: false, error: 'paths must be a non-empty array' });
    const job = scanManager.create(paths);
    job._recent = [];
    const limit = 200;
    job.on('file', (ev) => {
      if (!Array.isArray(job._recent)) job._recent = [];
      job._recent.push(ev.path);
      if (job._recent.length > limit) job._recent.splice(0, job._recent.length - limit);
    });
    res.json({ ok: true, jobId: job.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/scan/jobs/:id/status', requireAuth, async (req, res) => {
  try {
    const job = scanManager.get(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'job not found' });
    res.json({
      ok: true,
      id: job.id,
      scanned: job.scanned,
      total: job.total,
      percent: job.total > 0 ? Math.min(100, Math.round((job.scanned / job.total) * 100)) : 0,
      running: job.running,
      cancelled: job.cancelled,
      startedAt: job.startedAt || 0,
      endedAt: job.endedAt || 0,
      recent: Array.isArray(job._recent) ? job._recent.slice(-200) : [],
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/scan/jobs/:id/stream', requireAuth, async (req, res) => {
  const job = scanManager.get(req.params.id);
  if (!job) return res.status(404).end();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const send = (event, data) => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };

  const onStart = (ev) => send('start', ev);
  const onCount = (ev) => send('count', ev);
  const onFile = (ev) => send('file', ev);
  const onProgress = (ev) => send('progress', ev);
  const onWarn = (ev) => send('warn', ev);
  const onEnd = (ev) => { send('end', ev); cleanup(); try { res.end(); } catch {} };
  const onError = (ev) => { send('error', ev); };

  const cleanup = () => {
    job.off('start', onStart);
    job.off('count', onCount);
    job.off('file', onFile);
    job.off('progress', onProgress);
    job.off('warn', onWarn);
    job.off('end', onEnd);
    job.off('error', onError);
    clearInterval(keepAlive);
  };

  job.on('start', onStart);
  job.on('count', onCount);
  job.on('file', onFile);
  job.on('progress', onProgress);
  job.on('warn', onWarn);
  job.on('end', onEnd);
  job.on('error', onError);

  const keepAlive = setInterval(() => { send('ping', { t: Date.now() }); }, 15000);
  req.on('close', cleanup);

  if (job.startedAt && job.total) {
    send('count', { total: job.total });
    send('progress', { scanned: job.scanned, total: job.total, percent: job.total > 0 ? Math.min(100, Math.round((job.scanned / job.total) * 100)) : 0 });
  }
});

app.post('/scan/jobs/:id/cancel', requireAuth, async (req, res) => {
  try {
    const ok = scanManager.cancel(req.params.id);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/threats', requireAuth, async (req, res) => {
  try {
    const threats = await defender.getThreats();
    const detections = await defender.getDetections();
    res.json({ ok: true, threats, detections });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/threats/remove', requireAuth, async (req, res) => {
  try {
    const { threatIds } = req.body || {};
    const [beforeThreats, beforeDetections] = await Promise.all([
      defender.getThreats(),
      defender.getDetections(),
    ]);
    const startedAt = Date.now();
    const result = await defender.removeThreats(threatIds);
    const [afterThreats, afterDetections] = await Promise.all([
      defender.getThreats(),
      defender.getDetections(),
    ]);
    const beforeCount = (beforeThreats?.length || 0) + (beforeDetections?.length || 0);
    const afterCount = (afterThreats?.length || 0) + (afterDetections?.length || 0);
    const summary = {
      removedEstimate: Math.max(0, beforeCount - afterCount),
      before: { threats: beforeThreats?.length || 0, detections: beforeDetections?.length || 0 },
      after: { threats: afterThreats?.length || 0, detections: afterDetections?.length || 0 },
      ms: Date.now() - startedAt,
      at: new Date().toISOString(),
    };
    const totalBefore = summary.before.threats + summary.before.detections;
    const totalAfter = summary.after.threats + summary.after.detections;
    const message = `Removal completed: ~${summary.removedEstimate} removed | before=${totalBefore} after=${totalAfter} | ${summary.ms}ms at ${summary.at}`;
    res.json({ ok: true, result, summary, message });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

function listenWithFallback(startPort) {
  let currentPort = Number(startPort);
  let attempts = 0;
  const original = Number(process.env.PORT || 3000);
  const tryListen = () => {
    const server = app.listen(currentPort, HOST, () => {
      const suffix = currentPort !== original ? ` (fallback from ${original})` : '';
      console.log(`antivirus_server listening on http://${HOST}:${currentPort}${suffix}`);
    });
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && attempts < MAX_PORT_TRIES) {
        console.warn(`Port ${currentPort} in use, trying ${currentPort + 1}...`);
        attempts += 1;
        currentPort += 1;
        setTimeout(tryListen, 150);
      } else {
        console.error('Failed to start server:', err);
      }
    });
  };
  tryListen();
}

listenWithFallback(PORT);

// After we start listening, kick off an immediate signatures update in the background and start the scheduler
setTimeout(() => {
  doSignatureUpdate().catch(() => {});
  scheduleSignatureUpdates();
}, 1000);
