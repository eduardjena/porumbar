/*
 * npm test: rulează testele pe PostgreSQL. Cu TEST_DATABASE_URL (conexiune cu drept de a crea baze) folosește acel
 * server; altfel pornește unul temporar din programele PostgreSQL instalate și îl șterge la final.
 */
import { spawnSync } from 'node:child_process';
import { startTempPostgres } from './lib/temp-postgres.mjs';

const args = process.argv.slice(2);
const files = args.length ? args : ['test/**/*.test.js'];
const temp = process.env.TEST_DATABASE_URL ? null : await startTempPostgres();
let status = 1;
try {
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', ...files], {
    stdio: 'inherit',
    env: { ...process.env, TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || temp.url },
  });
  status = r.status ?? 1;
} finally {
  temp?.stop();
}
process.exit(status);
