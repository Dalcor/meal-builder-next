import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import type { UserData, UserSliceKey } from '@/types';

const DB_DIR = path.join(process.cwd(), 'db');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const USERDATA_DIR = path.join(DB_DIR, 'userdata');

export interface DbUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

const SLICE_FILES: Record<UserSliceKey, string> = {
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

const SLICE_DEFAULTS: { [K in UserSliceKey]: UserData[K] } = {
  products: [],
  dishes: [],
  dailyMeals: {},
  targets: { breakfast: 500, lunch: 700, dinner: 500, snacks: 300 },
  macroTargets: { proteinGrams: 150, fatPercent: 25 },
  pinnedIds: [],
  mealsDone: {},
  mealPresets: [],
  weightLog: {},
};

function ensureDbDirs(): void {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(USERDATA_DIR)) fs.mkdirSync(USERDATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    // Seed with initial user: vr.peredera@gmail.com / mealbuilder123
    const hash = bcrypt.hashSync('mealbuilder123', 10);
    const seedUser: DbUser = {
      id: 'user_1',
      email: 'vr.peredera@gmail.com',
      name: 'Viktor',
      passwordHash: hash,
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([seedUser], null, 2));
  }
}

function getUserDir(userId: string): string {
  return path.join(USERDATA_DIR, userId);
}

// Migrate the legacy single-file layout (`db/userdata/{userId}.json`) into
// the per-slice directory layout. Idempotent and non-destructive: only fills
// in slices that don't already exist on disk, then removes the legacy file.
function migrateLegacyUserFile(userId: string): void {
  const legacy = path.join(USERDATA_DIR, `${userId}.json`);
  if (!fs.existsSync(legacy)) return;
  const dir = getUserDir(userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let old: Record<string, unknown>;
  try {
    old = JSON.parse(fs.readFileSync(legacy, 'utf-8')) as Record<string, unknown>;
  } catch {
    return;
  }

  for (const key of Object.keys(SLICE_FILES) as UserSliceKey[]) {
    const target = path.join(dir, SLICE_FILES[key]);
    if (fs.existsSync(target)) continue;
    const value = old[key] ?? SLICE_DEFAULTS[key];
    fs.writeFileSync(target, JSON.stringify(value, null, 2));
  }
  fs.unlinkSync(legacy);
}

function ensureUserDir(userId: string): string {
  ensureDbDirs();
  const dir = getUserDir(userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  migrateLegacyUserFile(userId);
  return dir;
}

export function readSlice<K extends UserSliceKey>(userId: string, key: K): UserData[K] {
  const dir = ensureUserDir(userId);
  const file = path.join(dir, SLICE_FILES[key]);
  if (!fs.existsSync(file)) return SLICE_DEFAULTS[key];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as UserData[K];
  } catch {
    return SLICE_DEFAULTS[key];
  }
}

export function writeSlice<K extends UserSliceKey>(
  userId: string,
  key: K,
  value: UserData[K],
): void {
  const dir = ensureUserDir(userId);
  const file = path.join(dir, SLICE_FILES[key]);
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function getUsers(): DbUser[] {
  ensureDbDirs();
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

export function getUserByEmail(email: string): DbUser | undefined {
  return getUsers().find(u => u.email === email);
}

export function getUserById(id: string): DbUser | undefined {
  return getUsers().find(u => u.id === id);
}

export function createUser(email: string, name: string, password: string): DbUser {
  ensureDbDirs();
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    throw new Error('User already exists');
  }
  const newUser: DbUser = {
    id: `user_${Date.now()}`,
    email,
    name,
    passwordHash: bcrypt.hashSync(password, 10),
  };
  users.push(newUser);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  return newUser;
}

export function verifyPassword(user: DbUser, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}
