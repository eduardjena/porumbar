/*
 * Un server PostgreSQL de unică folosință, pentru teste și capturi de ecran: un cluster nou într-un director temporar,
 * pe un port liber, accesibil doar local și fără parolă. Nu atinge serviciul PostgreSQL instalat și nici datele lui.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';

const EXE = process.platform === 'win32' ? '.exe' : '';

/** Directorul cu programele PostgreSQL: PG_BIN, PATH sau locurile obișnuite de instalare (versiunea cea mai nouă). */
export function findPostgresBin() {
  const has = (dir) => fs.existsSync(path.join(dir, `initdb${EXE}`));
  if (process.env.PG_BIN && has(process.env.PG_BIN)) return process.env.PG_BIN;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) if (dir && has(dir)) return dir;
  const roots = process.platform === 'win32'
    ? [{ root: path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL'), sub: 'bin' }]
    : [{ root: '/usr/lib/postgresql', sub: 'bin' }, { root: '/usr/pgsql', sub: 'bin' }];
  for (const { root, sub } of roots) {
    let versions = [];
    try {
      versions = fs.readdirSync(root);
    } catch {
      continue;
    }
    versions.sort((a, b) => Number(b) - Number(a));
    for (const v of versions) if (has(path.join(root, v, sub))) return path.join(root, v, sub);
  }
  throw new Error('Nu găsesc programele PostgreSQL (initdb). Instalează PostgreSQL sau setează PG_BIN.');
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Pornește clusterul; `url` e conexiunea către baza `postgres` (de acolo se creează bazele), `stop()` îl șterge. */
export async function startTempPostgres() {
  const bin = findPostgresBin();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'porumbar-pg-'));
  const data = path.join(dir, 'data');
  // Fără canale spre acest proces: serverul pornit de pg_ctl le-ar moșteni, iar apelul n-ar mai reveni.
  const run = (tool, args) => execFileSync(path.join(bin, `${tool}${EXE}`), args, { stdio: 'ignore', timeout: 60_000 });
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  const port = await freePort();
  // Fără fsync: datele sunt de unică folosință, iar testele merg mult mai repede.
  run('pg_ctl', ['-D', data, '-w', '-l', path.join(dir, 'server.log'),
    '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c max_connections=200`, 'start']);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    } catch {
      /* deja oprit */
    }
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  return { url: `postgres://postgres@127.0.0.1:${port}/postgres`, stop };
}

/** O bază nouă într-un server existent; întoarce conexiunea ei. */
export async function createDatabase(adminUrl, name) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'ro-RO'`);
  } finally {
    await client.end();
  }
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}
