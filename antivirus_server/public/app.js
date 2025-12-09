(() => {
  // Debug console logic
  const debugToggle = document.getElementById('debugToggle');
  const debugLog = document.getElementById('debugLog');
  const btnClearDebug = document.getElementById('btnClearDebug');
  function debugEnabled() { return debugToggle && debugToggle.checked && debugLog; }
  function logDebug(msg, data) {
    if (!debugEnabled()) return;
    try {
      const t = new Date().toISOString();
      const suffix = data === undefined ? '' : (' ' + (typeof data === 'string' ? data : JSON.stringify(data)));
      debugLog.textContent += `[${t}] ${msg}${suffix}\n`;
      debugLog.scrollTop = debugLog.scrollHeight;
    } catch {}
  }
  if (debugToggle) {
    debugToggle.addEventListener('change', () => {
      try { localStorage.setItem('debug-enabled', debugToggle.checked ? '1' : '0'); } catch {}
    });
    try { debugToggle.checked = localStorage.getItem('debug-enabled') === '1'; } catch {}
  }
  if (btnClearDebug && debugLog) {
    btnClearDebug.addEventListener('click', () => { debugLog.textContent = ''; });
  }
  // Patch fetch
  if (window.fetch) {
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = (init && init.method) || 'GET';
        logDebug('fetch:req', { url, method });
      } catch {}
      try {
        const res = await origFetch(input, init);
        try { logDebug('fetch:res', { url: res.url, status: res.status }); } catch {}
        return res;
      } catch (e) {
        logDebug('fetch:err', String(e && e.message || e));
        throw e;
      }
    };
  }
  // Patch EventSource
  if (window.EventSource) {
    const proto = window.EventSource.prototype;
    if (!proto.__debugWrapped) {
      const origAdd = proto.addEventListener;
      proto.addEventListener = function(type, listener, options) {
        const wrapped = (e) => {
          try {
            const data = e && e.data ? (JSON.parse(e.data)) : undefined;
            logDebug(`event:${type}`, data !== undefined ? data : (e && e.data));
          } catch {
            logDebug(`event:${type}`, e && e.data);
          }
          return listener.call(this, e);
        };
        return origAdd.call(this, type, wrapped, options);
      };
      proto.__debugWrapped = true;
    }
  }
  // End debug console logic

  const $ = (sel) => document.querySelector(sel);
  const out = $('#output');
  const tokenInput = $('#token');
  const serverPortEl = $('#serverPort');
  const threatListEl = $('#threatList');
  const trackPathsInput = $('#trackPaths');
  const scanBar = $('#scanBar');
  const scanPercent = $('#scanPercent');
  const scanCounts = $('#scanCounts');
  const scannedListEl = $('#scannedList');
  const scanStatus = document.getElementById('scanStatus');

  function setOutput(data) {
    try {
      out.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    } catch (e) {
      out.textContent = String(data);
    }

  }
  // Live scan tracking (SSE)
  let currentJobId = null;
  let currentES = null;
  let scannedFiles = [];

  function resetScanUI() {
    if (scanBar) scanBar.style.width = '0%';
    if (scanPercent) scanPercent.textContent = '0%';
    if (scanCounts) scanCounts.textContent = '0 / 0 files';
    scannedFiles = [];
    if (scannedListEl) scannedListEl.innerHTML = '';
    if (scanStatus) scanStatus.textContent = '';
  }

  function appendScanned(path) {
    scannedFiles.push(path);
    if (!scannedListEl) return;
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<span class="name">${escapeHtml(path)}</span>`;
    scannedListEl.appendChild(row);
    const MAX_DISPLAY = 500;
    while (scannedListEl.children.length > MAX_DISPLAY) {
      scannedListEl.removeChild(scannedListEl.firstChild);
    }
    scannedListEl.scrollTop = scannedListEl.scrollHeight;
  }

  function setScanButtons(running) {
    const start = $('#btnTrackStart');
    const cancel = $('#btnTrackCancel');
    if (start) start.disabled = !!running;
    if (cancel) cancel.disabled = !running;
  }

  function updateProgress(scanned, total) {
    const percent = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
    if (scanBar) scanBar.style.width = `${percent}%`;
    if (scanPercent) scanPercent.textContent = `${percent}%`;
    if (scanCounts) scanCounts.textContent = `${scanned} / ${total} files`;
  }

  async function startLiveScan() {
    const raw = (trackPathsInput && trackPathsInput.value) || '';
    const paths = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!paths.length) { setOutput('Enter one or more paths for live scan'); return; }
    try {
      resetScanUI();
      setScanButtons(true);
      if (scanStatus) scanStatus.textContent = 'Scanning…';
      const resp = await api('/scan/track', { method: 'POST', body: { paths } });
      currentJobId = resp.jobId;
      setOutput(`Live scan started. Job ID: ${currentJobId}`);
      const token = encodeURIComponent(getToken() || '');
      currentES = new EventSource(`/scan/jobs/${currentJobId}/stream?token=${token}`);
      currentES.addEventListener('start', (e) => {
        try { const d = JSON.parse(e.data); setOutput(`Scan started at ${d.at || ''}`); } catch {}
        if (scanStatus) scanStatus.textContent = 'Scanning…';
      });
      currentES.addEventListener('count', (e) => {
        try { const d = JSON.parse(e.data); updateProgress(0, d.total || 0); } catch {}
      });
      currentES.addEventListener('file', (e) => {
        try { const d = JSON.parse(e.data); if (d.path) appendScanned(d.path); } catch {}
      });
      currentES.addEventListener('progress', (e) => {
        try { const d = JSON.parse(e.data); updateProgress(d.scanned || 0, d.total || 0); } catch {}
      });
      currentES.addEventListener('warn', (e) => {
        try { const d = JSON.parse(e.data); setOutput(`Warn: ${d.path || ''} -> ${d.error || ''}`); } catch {}
      });
      currentES.addEventListener('error', (e) => {
        try { const d = JSON.parse(e.data); setOutput(`Error: ${d.error || ''}`); } catch { setOutput('Stream error'); }
      });
      currentES.addEventListener('end', (e) => {
        try { const d = JSON.parse(e.data); setOutput(`Scan finished: ${d.scanned}/${d.total} files in ${d.ms}ms${d.cancelled ? ' (cancelled)' : ''}`); } catch { setOutput('Scan finished'); }
        if (scanStatus) scanStatus.textContent = 'Scan complete';
        stopLiveScan(false);
      });
    } catch (e) {
      setOutput(String(e.message || e));
      setScanButtons(false);
    }
  }

  async function stopLiveScan(requestCancel = true) {
    try {
      if (requestCancel && currentJobId) {
        await api(`/scan/jobs/${currentJobId}/cancel`, { method: 'POST' });
      }
    } catch {}
    if (currentES) { try { currentES.close(); } catch {} currentES = null; }
    currentJobId = null;
    setScanButtons(false);
    if (scanStatus) scanStatus.textContent = '';
  }


  function getToken() {
    return localStorage.getItem('x-auth-token') || '';
  }
  function setToken(t) {
    if (t) localStorage.setItem('x-auth-token', t);
    else localStorage.removeItem('x-auth-token');
  }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Accept': 'application/json' };
    const token = getToken();
    if (token) headers['x-auth-token'] = token;
    let init = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);
    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      throw new Error(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
    return payload;
  }

  function renderThreats(data) {
    threatListEl.innerHTML = '';
    const items = [];
    if (data && Array.isArray(data.threats)) {
      data.threats.forEach(t => items.push({ source: 'Threat', id: t.ThreatID ?? t.ThreatId ?? t.Id ?? t.ID, name: t.ThreatName ?? t.Name ?? 'Unknown', severity: t.SeverityID ?? t.Severity ?? t.SeverityName }));
    }
    if (data && Array.isArray(data.detections)) {
      data.detections.forEach(t => items.push({ source: 'Detection', id: t.ThreatID ?? t.ThreatId ?? t.Id ?? t.ID, name: t.Resources ?? t.Process ?? t.ThreatName ?? 'Unknown', severity: t.SeverityID ?? t.Severity ?? t.SeverityName }));
    }
    if (!items.length) {
      threatListEl.textContent = 'No threats or detections.';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'list-row';
      const id = String(item.id ?? '');
      row.innerHTML = `
        <label class="chk">
          <input type="checkbox" data-id="${id}">
          <span class="name">${escapeHtml(item.name)}</span>
        </label>
        <span class="meta">${item.source}${id ? ` | ID: ${id}` : ''}${item.severity ? ` | Sev: ${item.severity}` : ''}</span>
      `;
      frag.appendChild(row);
    });
    threatListEl.appendChild(frag);
  }

  async function getThreats() {
    return api('/threats');
  }

  function idsFromData(data) {
    const ids = new Set();
    if (data && Array.isArray(data.threats)) {
      data.threats.forEach(t => {
        const id = t.ThreatID ?? t.ThreatId ?? t.Id ?? t.ID;
        if (id !== undefined && id !== null && id !== '') ids.add(String(id));
      });
    }
    if (data && Array.isArray(data.detections)) {
      data.detections.forEach(t => {
        const id = t.ThreatID ?? t.ThreatId ?? t.Id ?? t.ID;
        if (id !== undefined && id !== null && id !== '') ids.add(String(id));
      });
    }
    return ids;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setRemoveBusy(busy) {
    const a = $('#btnRemoveAll');
    const s = $('#btnRemoveSelected');
    if (a) a.disabled = !!busy;
    if (s) s.disabled = !!busy;
  }

  async function removeAllWithRetry({ maxRetries = 3, delayMs = 1200 } = {}) {
    try {
      setRemoveBusy(true);
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        setOutput(`Removing all threats... attempt ${attempt + 1}/${maxRetries + 1}`);
        const resp = await api('/threats/remove', { method: 'POST', body: {} });
        const data = await getThreats();
        renderThreats(data);
        const remaining = idsFromData(data).size;
        if (remaining === 0) { setOutput(resp.message || 'All threats removed.'); return; }
        if (attempt < maxRetries) { await delay(delayMs); continue; }
        setOutput(resp.message || `Removal attempts finished. Remaining: ${remaining}`);
      }
    } catch (e) {
      setOutput(String(e.message || e));
    } finally {
      setRemoveBusy(false);
    }
  }

  async function removeSelectedWithRetry({ maxRetries = 3, delayMs = 1200 } = {}) {
    const initial = selectedThreatIds().map(String);
    if (!initial.length) { setOutput('Select at least one threat'); return; }
    try {
      setRemoveBusy(true);
      let target = initial.slice();
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        setOutput(`Removing selected (${target.length})... attempt ${attempt + 1}/${maxRetries + 1}`);
        const resp = await api('/threats/remove', { method: 'POST', body: { threatIds: target } });
        const data = await getThreats();
        renderThreats(data);
        const present = idsFromData(data);
        const stillThere = target.filter(id => present.has(String(id)));
        if (stillThere.length === 0) { setOutput(resp.message || 'Selected threats removed.'); return; }
        if (attempt < maxRetries) { target = stillThere; await delay(delayMs); continue; }
        setOutput(resp.message || `Removal attempts finished. Remaining selected: ${stillThere.length}`);
      }
    } catch (e) {
      setOutput(String(e.message || e));
    } finally {
      setRemoveBusy(false);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  function selectedThreatIds() {
    return Array.from(threatListEl.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.getAttribute('data-id'))
      .filter(Boolean)
      .map(x => {
        const n = Number(x);
        return Number.isFinite(n) ? n : x;
      });
  }

  function init() {
    serverPortEl.textContent = `Server: http://${location.hostname}:${location.port}`;
    tokenInput.value = getToken();

    $('#saveToken').addEventListener('click', () => {
      setToken(tokenInput.value.trim());
      setOutput('Token saved');
    });
    $('#clearToken').addEventListener('click', () => {
      tokenInput.value = '';
      setToken('');
      setOutput('Token cleared');
    });

    $('#btnHealth').addEventListener('click', async () => {
      try { setOutput(await api('/health')); } catch (e) { setOutput(String(e.message||e)); }
    });
    $('#btnStatus').addEventListener('click', async () => {
      try { setOutput(await api('/status')); } catch (e) { setOutput(String(e.message||e)); }
    });
    $('#btnUpdate').addEventListener('click', async () => {
      try { setOutput(await api('/signatures/update', { method: 'POST' })); } catch (e) { setOutput(String(e.message||e)); }
    });
    $('#btnQuick').addEventListener('click', async () => {
      try {
        resetScanUI();
        setScanButtons(true);
        if (scanStatus) scanStatus.textContent = 'Scanning…';
        const resp = await api('/scan/quick', { method: 'POST' });
        if (!resp.ok || !resp.jobId) throw new Error(resp.error || 'Failed to start quick scan');
        currentJobId = resp.jobId;
        setOutput(`Quick scan started. Job ID: ${currentJobId}`);
        const token = encodeURIComponent(getToken() || '');
        currentES = new EventSource(`/scan/jobs/${currentJobId}/stream?token=${token}`);
        currentES.addEventListener('start', (e) => { try { const d = JSON.parse(e.data); setOutput(`Scan started at ${d.at || ''}`); } catch {} if (scanStatus) scanStatus.textContent = 'Scanning…'; });
        currentES.addEventListener('count', (e) => { try { const d = JSON.parse(e.data); updateProgress(0, d.total || 0); } catch {} });
        currentES.addEventListener('file', (e) => { try { const d = JSON.parse(e.data); if (d.path) appendScanned(d.path); } catch {} });
        currentES.addEventListener('progress', (e) => { try { const d = JSON.parse(e.data); updateProgress(d.scanned || 0, d.total || 0); } catch {} });
        currentES.addEventListener('warn', (e) => { try { const d = JSON.parse(e.data); setOutput(`Warn: ${d.path || ''} -> ${d.error || ''}`); } catch {} });
        currentES.addEventListener('error', (e) => { try { const d = JSON.parse(e.data); setOutput(`Error: ${d.error || ''}`); } catch { setOutput('Stream error'); } });
        currentES.addEventListener('end', (e) => { try { const d = JSON.parse(e.data); setOutput(`Scan finished: ${d.scanned}/${d.total} files in ${d.ms}ms${d.cancelled ? ' (cancelled)' : ''}`); } catch { setOutput('Scan finished'); } if (scanStatus) scanStatus.textContent = 'Scan complete'; stopLiveScan(false); });
      } catch (e) { setOutput(String(e.message||e)); setScanButtons(false); if (scanStatus) scanStatus.textContent = ''; }
    });
    $('#btnFull').addEventListener('click', async () => {
      try {
        resetScanUI();
        setScanButtons(true);
        if (scanStatus) scanStatus.textContent = 'Scanning…';
        const resp = await api('/scan/full', { method: 'POST' });
        if (!resp.ok || !resp.jobId) throw new Error(resp.error || 'Failed to start full scan');
        currentJobId = resp.jobId;
        setOutput(`Full scan started. Job ID: ${currentJobId}`);
        const token = encodeURIComponent(getToken() || '');
        currentES = new EventSource(`/scan/jobs/${currentJobId}/stream?token=${token}`);
        currentES.addEventListener('start', (e) => { try { const d = JSON.parse(e.data); setOutput(`Scan started at ${d.at || ''}`); } catch {} if (scanStatus) scanStatus.textContent = 'Scanning…'; });
        currentES.addEventListener('count', (e) => { try { const d = JSON.parse(e.data); updateProgress(0, d.total || 0); } catch {} });
        currentES.addEventListener('file', (e) => { try { const d = JSON.parse(e.data); if (d.path) appendScanned(d.path); } catch {} });
        currentES.addEventListener('progress', (e) => { try { const d = JSON.parse(e.data); updateProgress(d.scanned || 0, d.total || 0); } catch {} });
        currentES.addEventListener('warn', (e) => { try { const d = JSON.parse(e.data); setOutput(`Warn: ${d.path || ''} -> ${d.error || ''}`); } catch {} });
        currentES.addEventListener('error', (e) => { try { const d = JSON.parse(e.data); setOutput(`Error: ${d.error || ''}`); } catch { setOutput('Stream error'); } });
        currentES.addEventListener('end', (e) => { try { const d = JSON.parse(e.data); setOutput(`Scan finished: ${d.scanned}/${d.total} files in ${d.ms}ms${d.cancelled ? ' (cancelled)' : ''}`); } catch { setOutput('Scan finished'); } if (scanStatus) scanStatus.textContent = 'Scan complete'; stopLiveScan(false); });
      } catch (e) { setOutput(String(e.message||e)); setScanButtons(false); if (scanStatus) scanStatus.textContent = ''; }
    });
    $('#btnCustom').addEventListener('click', async () => {
      const raw = $('#customPaths').value || '';
      const paths = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (!paths.length) { setOutput('Enter one or more paths'); return; }
      try {
        resetScanUI();
        setScanButtons(true);
        if (scanStatus) scanStatus.textContent = 'Scanning…';
        const resp = await api('/scan/custom', { method: 'POST', body: { paths } });
        if (!resp.ok || !resp.jobId) throw new Error(resp.error || 'Failed to start custom scan');
        currentJobId = resp.jobId;
        setOutput(`Custom scan started. Job ID: ${currentJobId}`);
        const token = encodeURIComponent(getToken() || '');
        currentES = new EventSource(`/scan/jobs/${currentJobId}/stream?token=${token}`);
        currentES.addEventListener('start', (e) => { try { const d = JSON.parse(e.data); setOutput(`Scan started at ${d.at || ''}`); } catch {} if (scanStatus) scanStatus.textContent = 'Scanning…'; });
        currentES.addEventListener('count', (e) => { try { const d = JSON.parse(e.data); updateProgress(0, d.total || 0); } catch {} });
        currentES.addEventListener('file', (e) => { try { const d = JSON.parse(e.data); if (d.path) appendScanned(d.path); } catch {} });
        currentES.addEventListener('progress', (e) => { try { const d = JSON.parse(e.data); updateProgress(d.scanned || 0, d.total || 0); } catch {} });
        currentES.addEventListener('warn', (e) => { try { const d = JSON.parse(e.data); setOutput(`Warn: ${d.path || ''} -> ${d.error || ''}`); } catch {} });
        currentES.addEventListener('error', (e) => { try { const d = JSON.parse(e.data); setOutput(`Error: ${d.error || ''}`); } catch { setOutput('Stream error'); } });
        currentES.addEventListener('end', (e) => { try { const d = JSON.parse(e.data); setOutput(`Scan finished: ${d.scanned}/${d.total} files in ${d.ms}ms${d.cancelled ? ' (cancelled)' : ''}`); } catch { setOutput('Scan finished'); } if (scanStatus) scanStatus.textContent = 'Scan complete'; stopLiveScan(false); });
      } catch (e) { setOutput(String(e.message||e)); setScanButtons(false); if (scanStatus) scanStatus.textContent = ''; }
    });
    const startBtn = document.getElementById('btnTrackStart');
    if (startBtn) startBtn.addEventListener('click', startLiveScan);
    const cancelBtn = document.getElementById('btnTrackCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => stopLiveScan(true));
    const clearBtn = document.getElementById('btnClearScanned');
    if (clearBtn) clearBtn.addEventListener('click', () => { scannedFiles = []; if (scannedListEl) scannedListEl.innerHTML = ''; setOutput('Cleared scanned files list'); });
    const downloadBtn = document.getElementById('btnDownloadScanned');
    if (downloadBtn) downloadBtn.addEventListener('click', () => {
      const blob = new Blob([scannedFiles.join('\n')], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `scanned-files-${Date.now()}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    $('#btnThreats').addEventListener('click', async () => {
      try {
        const data = await api('/threats');
        renderThreats(data);
        setOutput(data);
      } catch (e) { setOutput(String(e.message||e)); }
    });
    $('#btnRemoveAll').addEventListener('click', async () => {
      if (!confirm('Remove ALL threats?')) return;
      await removeAllWithRetry({ maxRetries: 4, delayMs: 1500 });
    });
    $('#btnRemoveSelected').addEventListener('click', async () => {
      await removeSelectedWithRetry({ maxRetries: 4, delayMs: 1500 });
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
