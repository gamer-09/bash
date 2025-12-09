const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { EventEmitter } = require('events');

async function* walk(startPaths) {
  const stack = [...startPaths.map(p => path.resolve(p))];
  while (stack.length) {
    const p = stack.pop();
    let stat;
    try { stat = await fsp.lstat(p); } catch { continue; }
    if (stat.isSymbolicLink()) continue;
    if (stat.isFile()) {
      yield p;
      continue;
    }
    if (stat.isDirectory()) {
      let entries;
      try { entries = await fsp.readdir(p, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const child = path.join(p, e.name);
        if (e.isDirectory()) stack.push(child);
        else if (e.isFile()) yield child;
      }
    }
  }
}

async function countFiles(paths) {
  let total = 0;
  for await (const _ of walk(paths)) total++;
  return total;
}

class ScanJob extends EventEmitter {
  constructor(id, paths, defender) {
    super();
    this.id = id;
    this.paths = paths;
    this.defender = defender;
    this.scanned = 0;
    this.total = 0;
    this.running = false;
    this.cancelled = false;
    this.startedAt = 0;
    this.endedAt = 0;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    this.emit('start', { id: this.id, paths: this.paths, at: new Date(this.startedAt).toISOString() });
    try {
      this.total = await countFiles(this.paths);
      this.emit('count', { total: this.total });
      for await (const filePath of walk(this.paths)) {
        if (this.cancelled) break;
        this.scanned++;
        this.emit('file', { index: this.scanned, total: this.total, path: filePath });
        try { await this.defender.scanFile(filePath); } catch (e) { this.emit('warn', { path: filePath, error: String(e && e.message || e) }); }
        const percent = this.total > 0 ? Math.min(100, Math.round((this.scanned / this.total) * 100)) : 0;
        this.emit('progress', { scanned: this.scanned, total: this.total, percent });
      }
      this.endedAt = Date.now();
      this.running = false;
      this.emit('end', { scanned: this.scanned, total: this.total, ms: this.endedAt - this.startedAt, at: new Date(this.endedAt).toISOString(), cancelled: this.cancelled });
    } catch (e) {
      this.endedAt = Date.now();
      this.running = false;
      this.emit('error', { error: String(e && e.message || e), ms: this.endedAt - this.startedAt });
    }
  }

  cancel() {
    this.cancelled = true;
  }
}

class ScanManager {
  constructor(defender) {
    this.jobs = new Map();
    this.defender = defender;
    this.nextId = 1;
  }
  create(paths) {
    const id = String(this.nextId++);
    const job = new ScanJob(id, paths, this.defender);
    this.jobs.set(id, job);
    job.start();
    return job;
  }
  get(id) { return this.jobs.get(String(id)); }
  cancel(id) {
    const job = this.get(id);
    if (job) job.cancel();
    return !!job;
  }
}

module.exports = { ScanManager };
