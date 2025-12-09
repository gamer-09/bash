const { spawn } = require('child_process');

function parseJsonLoose(s) {
  if (!s) return null;
  const start = Math.min(...['[', '{'].map(ch => {
    const idx = s.indexOf(ch);
    return idx === -1 ? Infinity : idx;
  }));
  if (!isFinite(start)) return null;
  const endBrace = s.lastIndexOf('}');
  const endBracket = s.lastIndexOf(']');
  const end = Math.max(endBrace, endBracket);
  if (end <= start) return null;
  const slice = s.slice(start, end + 1).trim();
  try { return JSON.parse(slice); } catch { return null; }
}

async function scanFile(filePath) {
  if (!filePath) throw new Error('filePath required');
  const p = psQuotePath(filePath);
  const script = `$ErrorActionPreference='SilentlyContinue'; try { Start-MpScan -ScanPath ${p} | Out-Null; @{ ok = $true; path = ${p} } | ConvertTo-Json } catch { @{ ok = $false; path = ${p}; error = $_.Exception.Message } | ConvertTo-Json }`;
  const out = await runPowerShell(script, { timeoutMs: 2 * 60 * 1000 });
  return parseJsonLoose(out) ?? { raw: out };
}

function runPowerShell(script, { timeoutMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try { ps.kill('SIGTERM'); } catch {}
        reject(new Error('PowerShell timed out'));
      }, timeoutMs);
    }
    ps.stdout.on('data', d => { stdout += d.toString(); });
    ps.stderr.on('data', d => { stderr += d.toString(); });
    ps.on('error', err => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    ps.on('close', code => {
      if (timer) clearTimeout(timer);
      if (code !== 0 && stderr.trim()) return reject(new Error(stderr.trim()));
      resolve(stdout.trim());
    });
  });
}

async function defenderAvailable() {
  const script = "if (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue) { 'true' } else { 'false' }";
  const out = await runPowerShell(script);
  return out.toLowerCase().includes('true');
}

async function isAdmin() {
  const script = "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)";
  const out = await runPowerShell(script);
  return out.toLowerCase().includes('true');
}

async function getStatus() {
  const script = "$ErrorActionPreference='SilentlyContinue'; if (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue) { Get-MpComputerStatus | ConvertTo-Json -Depth 4 } else { '{\"error\":\"Defender cmdlets not available\"}' }";
  const out = await runPowerShell(script);
  return parseJsonLoose(out) ?? { raw: out };
}

async function updateSignatures() {
  const script = "$ErrorActionPreference='SilentlyContinue'; try { Update-MpSignature | Out-Null; @{ updated = $true } | ConvertTo-Json } catch { @{ updated = $false; error = $_.Exception.Message } | ConvertTo-Json }";
  const out = await runPowerShell(script, { timeoutMs: 5 * 60 * 1000 });
  return parseJsonLoose(out) ?? { raw: out };
}

async function startScan(type) {
  const t = type === 'FullScan' ? 'FullScan' : 'QuickScan';
  const script = `$ErrorActionPreference='SilentlyContinue'; try { Start-MpScan -ScanType ${t} | Out-Null; @{ started = $true; type = '${t}' } | ConvertTo-Json } catch { @{ started = $false; type='${t}'; error = $_.Exception.Message } | ConvertTo-Json }`;
  const out = await runPowerShell(script, { timeoutMs: 0 });
  return parseJsonLoose(out) ?? { raw: out };
}

function psQuotePath(p) {
  return `'${String(p).replace(/'/g, "''")}'`;
}

async function startCustomScan(paths) {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
  if (!list.length) return { started: false, error: 'paths required' };
  let script;
  if (list.length === 1) {
    // Single path: pass as string
    const p = psQuotePath(list[0]);
    script = `$ErrorActionPreference='SilentlyContinue'; try { Start-MpScan -ScanPath ${p} | Out-Null; @{ started = $true; paths = ${p} } | ConvertTo-Json } catch { @{ started = $false; error = $_.Exception.Message; paths = ${p} } | ConvertTo-Json }`;
  } else {
    // Multiple: pass as array
    const arr = list.map(psQuotePath).join(',');
    script = `$ErrorActionPreference='SilentlyContinue'; $paths = @(${arr}); try { Start-MpScan -ScanPath $paths | Out-Null; @{ started = $true; paths = $paths } | ConvertTo-Json } catch { @{ started = $false; error = $_.Exception.Message; paths = $paths } | ConvertTo-Json }`;
  }
  const out = await runPowerShell(script);
  return parseJsonLoose(out) ?? { raw: out };
}

async function getThreats() {
  const script = "$ErrorActionPreference='SilentlyContinue'; $t = Get-MpThreat; if ($t) { $t | ConvertTo-Json -Depth 5 } else { '[]' }";
  const out = await runPowerShell(script);
  const parsed = parseJsonLoose(out);
  if (Array.isArray(parsed)) return parsed;
  if (parsed) return [parsed];
  return [];
}

async function getDetections() {
  const script = "$ErrorActionPreference='SilentlyContinue'; $d = Get-MpThreatDetection; if ($d) { $d | ConvertTo-Json -Depth 5 } else { '[]' }";
  const out = await runPowerShell(script);
  const parsed = parseJsonLoose(out);
  if (Array.isArray(parsed)) return parsed;
  if (parsed) return [parsed];
  return [];
}

async function removeThreats(threatIds) {
  const ids = Array.isArray(threatIds) ? threatIds.filter(x => x !== null && x !== undefined) : [];
  let script;
  if (ids.length) {
    const idList = ids.map(n => Number(n)).filter(n => Number.isFinite(n)).join(',');
    script = `$ErrorActionPreference='SilentlyContinue'; try { Remove-MpThreat -ThreatID ${idList} | Out-Null; @{ removed = $true; ids = @(${idList}) } | ConvertTo-Json } catch { @{ removed = $false; error = $_.Exception.Message; ids = @(${idList}) } | ConvertTo-Json }`;
  } else {
    script = "$ErrorActionPreference='SilentlyContinue'; try { Remove-MpThreat -All | Out-Null; @{ removed = $true; all = $true } | ConvertTo-Json } catch { @{ removed = $false; all = $true; error = $_.Exception.Message } | ConvertTo-Json }";
  }
  const out = await runPowerShell(script);
  return parseJsonLoose(out) ?? { raw: out };
}

module.exports = {
  defenderAvailable,
  isAdmin,
  getStatus,
  updateSignatures,
  startScan,
  startCustomScan,
  scanFile,
  getThreats,
  getDetections,
  removeThreats,
};
