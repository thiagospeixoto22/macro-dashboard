import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), '.cache');

function ensureDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function fileForKey(key) {
  ensureDir();
  return path.join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

export async function withCache(key, ttlMs, loader, force = false) {
  const file = fileForKey(key);
  if (!force && fs.existsSync(file)) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Date.now() - raw.savedAt < ttlMs) {
        return raw.payload;
      }
    } catch {
      // ignore corrupt cache and re-fetch
    }
  }

  const payload = await loader();
  fs.writeFileSync(file, JSON.stringify({ savedAt: Date.now(), payload }, null, 2));
  return payload;
}
