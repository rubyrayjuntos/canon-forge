import fs from 'fs';
import dotenv from 'dotenv';

export function applyEnv() {
  dotenv.config({ path: '.env', override: true });
  dotenv.config({ path: '.env.local', override: true });
}

export function watchEnv(onReload) {
  for (const file of ['.env', '.env.local']) {
    try {
      fs.watch(file, () => {
        applyEnv();
        onReload?.(file);
      });
    } catch {
      // File may not exist yet.
    }
  }
}
