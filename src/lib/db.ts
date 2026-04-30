import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_DIR = path.join(process.cwd(), 'db');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const USERDATA_DIR = path.join(DB_DIR, 'userdata');

export interface DbUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

export interface UserData {
  products: unknown[];
  dishes: unknown[];
  dailyMeals: Record<string, unknown>;
  targets: Record<string, number>;
  macroTargets: Record<string, number>;
  pinnedIds: string[];
  mealsDone: Record<string, unknown>;
  mealPresets: unknown[];
  weightLog: Record<string, number>;
}

const DEFAULT_USER_DATA: UserData = {
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

function ensureDbExists() {
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

export function getUsers(): DbUser[] {
  ensureDbExists();
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

export function getUserByEmail(email: string): DbUser | undefined {
  return getUsers().find(u => u.email === email);
}

export function getUserById(id: string): DbUser | undefined {
  return getUsers().find(u => u.id === id);
}

export function createUser(email: string, name: string, password: string): DbUser {
  ensureDbExists();
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

export function getUserData(userId: string): UserData {
  ensureDbExists();
  const filePath = path.join(USERDATA_DIR, `${userId}.json`);
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_USER_DATA };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return { ...DEFAULT_USER_DATA, ...raw };
}

export function saveUserData(userId: string, data: UserData): void {
  ensureDbExists();
  const filePath = path.join(USERDATA_DIR, `${userId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
