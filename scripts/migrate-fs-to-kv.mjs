// One-shot migration: read everything from db/ (legacy file-based storage)
// and push it into Upstash. Run once after creating the Upstash database
// and putting credentials into .env.local:
//
//   npm run migrate:kv
//
// Safe to re-run: SET overwrites the same keys idempotently. After it
// reports "Done!", you can delete the local db/ folder — the app no
// longer reads from disk.

import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';

const url =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error(
    '\nMissing credentials. Put these in .env.local first:\n' +
      '  UPSTASH_REDIS_REST_URL=...\n' +
      '  UPSTASH_REDIS_REST_TOKEN=...\n\n' +
      'Then run again: npm run migrate:kv\n',
  );
  process.exit(1);
}

const kv = new Redis({ url, token });

const SLICE_FILES = {
  products: 'products.json',
  dishes: 'dishes.json',
  dailyMeals: 'daily-meals.json',
  targets: 'targets.json',
  macroTargets: 'macro-targets.json',
  pinnedIds: 'pinned.json',
  mealsDone: 'meals-done.json',
  mealPresets: 'meal-presets.json',
  weightLog: 'weight-log.json',
};

const DB_DIR = path.join(process.cwd(), 'db');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const USERDATA_DIR = path.join(DB_DIR, 'userdata');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

async function main() {
  if (!fs.existsSync(USERS_FILE)) {
    console.log('No db/users.json found — nothing to migrate.');
    return;
  }

  const users = readJson(USERS_FILE);
  console.log(`Found ${users.length} user(s) in db/users.json\n`);

  for (const u of users) {
    console.log(`User: ${u.email} (${u.id})`);
    await kv.set(`mb:user:${u.id}`, u);
    await kv.set(`mb:userByEmail:${u.email.toLowerCase()}`, u.id);
    console.log(`  ✓ user record + email index`);

    const userDir = path.join(USERDATA_DIR, u.id);
    if (!fs.existsSync(userDir)) {
      console.log(`  (no userdata dir, skipping slices)\n`);
      continue;
    }

    for (const [sliceKey, fileName] of Object.entries(SLICE_FILES)) {
      const filePath = path.join(userDir, fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`  - ${sliceKey.padEnd(13)} (no file, default)`);
        continue;
      }
      const value = readJson(filePath);
      await kv.set(`mb:user:${u.id}:${sliceKey}`, value);
      const summary = Array.isArray(value)
        ? `[${value.length} items]`
        : `{${Object.keys(value).length} keys}`;
      console.log(`  ✓ ${sliceKey.padEnd(13)} ${summary}`);
    }
    console.log('');
  }

  console.log('Done! You can now `git rm -r db/userdata` and remove db/users.json.');
}

main().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
