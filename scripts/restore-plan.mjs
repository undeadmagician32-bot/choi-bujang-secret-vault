import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RestoreAbort, formatPlan, planRestore } from '../src/restore-plan.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
try {
  const plan = await planRestore({ root, ...(process.argv[2] ? { snapshotPath: resolve(process.argv[2]) } : {}) });
  console.log(formatPlan(plan));
} catch (error) {
  if (error instanceof RestoreAbort) {
    console.error(`중단: ${error.code} - ${error.message}`);
    process.exit(1);
  }
  throw error;
}
