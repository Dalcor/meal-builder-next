import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import type { Product, UserData, UserSliceKey } from '@/types';
import { buildSeedProducts } from '@/data/presets';

// All persistent state lives in Upstash Redis. The same env vars work
// locally (drop them into .env.local) and on Vercel (auto-injected by the
// Upstash marketplace integration). Several env-var naming conventions
// are accepted so this code works across Vercel integration variants:
//   - UPSTASH_REDIS_REST_*           (Upstash CLI / direct)
//   - KV_REST_API_*                  (legacy Vercel KV)
//   - STORAGE_KV_REST_API_*          (Vercel marketplace integration named "STORAGE")
function makeKv(): Redis {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.STORAGE_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.STORAGE_KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Missing Upstash credentials. Set UPSTASH_REDIS_REST_URL and ' +
        'UPSTASH_REDIS_REST_TOKEN in .env.local (locally) or in your ' +
        'Vercel project env vars.',
    );
  }
  return new Redis({ url, token });
}

let _kv: Redis | null = null;
function kv(): Redis {
  if (!_kv) _kv = makeKv();
  return _kv;
}

export interface DbUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

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

const SEED_EMAIL = 'vr.peredera@gmail.com';
const SEED_PASSWORD = 'mealbuilder123';
const SEED_USER_ID = 'user_1';
const SEED_USER_NAME = 'Viktor';

// ---------- Key builders ----------

function sliceKey(userId: string, key: UserSliceKey): string {
  return `mb:user:${userId}:${key}`;
}

function userKey(id: string): string {
  return `mb:user:${id}`;
}

function emailKey(email: string): string {
  return `mb:userByEmail:${email.toLowerCase()}`;
}

// ---------- Lazy one-time seed of the demo account ----------
//
// Without this, a fresh KV instance has no users at all and login fails.
// Idempotent: only writes if the seed email isn't already registered.
let seedPromise: Promise<void> | null = null;

async function ensureSeedUser(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const existing = await kv().get<string>(emailKey(SEED_EMAIL));
    if (existing) return;
    const seed: DbUser = {
      id: SEED_USER_ID,
      email: SEED_EMAIL,
      name: SEED_USER_NAME,
      passwordHash: bcrypt.hashSync(SEED_PASSWORD, 10),
    };
    await kv().set(userKey(seed.id), seed);
    await kv().set(emailKey(seed.email), seed.id);
  })().catch(err => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

// ---------- Slices (blob — full slice replace) ----------
//
// These are JSON blobs that the client mirrors and writes whole. Used for
// slices where granular mutation isn't worth the complexity yet:
// dishes, dailyMeals, targets, macroTargets, mealsDone, mealPresets,
// weightLog. Multi-tab clobbering is possible here — see the note in
// docs/code-review.md §11.

export async function readSlice<K extends UserSliceKey>(
  userId: string,
  key: K,
): Promise<UserData[K]> {
  const v = await kv().get<UserData[K]>(sliceKey(userId, key));
  return v ?? SLICE_DEFAULTS[key];
}

export async function writeSlice<K extends UserSliceKey>(
  userId: string,
  key: K,
  value: UserData[K],
): Promise<void> {
  await kv().set(sliceKey(userId, key), value);
}

// ---------- Products (Redis HASH — granular per-product CRUD) ----------
//
// Stored as `mb:user:{userId}:products:items` (HASH). Field = product id,
// value = full Product as JSON. Multi-tab safe: HSET only touches the
// specified field, HDEL only removes the specified field.

function productsHashKey(userId: string): string {
  return `mb:user:${userId}:products:items`;
}

function legacyProductsKey(userId: string): string {
  return `mb:user:${userId}:products`;
}

// Migrate the user's products from the old blob layout to a HASH.
// Idempotent — once the legacy key is gone, this is a no-op.
async function migrateProductsToHash(userId: string): Promise<void> {
  const legacy = await kv().get<Product[]>(legacyProductsKey(userId));
  if (!legacy || !Array.isArray(legacy) || legacy.length === 0) {
    // Nothing to migrate; ensure legacy key is cleared so we don't re-check.
    if (legacy !== null) {
      await kv().del(legacyProductsKey(userId));
    }
    return;
  }
  const fields: Record<string, Product> = {};
  for (const p of legacy) {
    if (p && typeof p.id === 'string') fields[p.id] = p;
  }
  if (Object.keys(fields).length > 0) {
    await kv().hset(productsHashKey(userId), fields);
  }
  await kv().del(legacyProductsKey(userId));
}

export async function listProducts(userId: string): Promise<Product[]> {
  await migrateProductsToHash(userId);
  const obj = await kv().hgetall<Record<string, Product>>(productsHashKey(userId));
  if (!obj) return [];
  return Object.values(obj);
}

export async function setProduct(userId: string, product: Product): Promise<void> {
  await migrateProductsToHash(userId);
  await kv().hset(productsHashKey(userId), { [product.id]: product });
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  await migrateProductsToHash(userId);
  await kv().hdel(productsHashKey(userId), productId);
}

// ---------- Pinned IDs (Redis SET — granular pin / unpin) ----------
//
// Stored as `mb:user:{userId}:pinnedIds:set`. SADD to pin, SREM to unpin.
// Multi-tab safe: each operation is atomic and only affects one element.

function pinnedSetKey(userId: string): string {
  return `mb:user:${userId}:pinnedIds:set`;
}

function legacyPinnedKey(userId: string): string {
  return `mb:user:${userId}:pinnedIds`;
}

async function migratePinnedToSet(userId: string): Promise<void> {
  const legacy = await kv().get<string[]>(legacyPinnedKey(userId));
  if (!legacy || !Array.isArray(legacy) || legacy.length === 0) {
    if (legacy !== null) await kv().del(legacyPinnedKey(userId));
    return;
  }
  const valid = legacy.filter((s): s is string => typeof s === 'string');
  if (valid.length > 0) {
    await kv().sadd(pinnedSetKey(userId), valid[0], ...valid.slice(1));
  }
  await kv().del(legacyPinnedKey(userId));
}

export async function listPinned(userId: string): Promise<string[]> {
  await migratePinnedToSet(userId);
  return kv().smembers(pinnedSetKey(userId));
}

export async function addPin(userId: string, productId: string): Promise<void> {
  await migratePinnedToSet(userId);
  await kv().sadd(pinnedSetKey(userId), productId);
}

export async function removePin(userId: string, productId: string): Promise<void> {
  await migratePinnedToSet(userId);
  await kv().srem(pinnedSetKey(userId), productId);
}

// ---------- Users ----------

export async function getUserByEmail(email: string): Promise<DbUser | undefined> {
  await ensureSeedUser();
  const id = await kv().get<string>(emailKey(email));
  if (!id) return undefined;
  return (await kv().get<DbUser>(userKey(id))) ?? undefined;
}

export async function getUserById(id: string): Promise<DbUser | undefined> {
  await ensureSeedUser();
  return (await kv().get<DbUser>(userKey(id))) ?? undefined;
}

export async function createUser(
  email: string,
  name: string,
  password: string,
): Promise<DbUser> {
  await ensureSeedUser();
  const existing = await kv().get<string>(emailKey(email));
  if (existing) throw new Error('User already exists');
  const newUser: DbUser = {
    id: `user_${Date.now()}`,
    email,
    name,
    passwordHash: bcrypt.hashSync(password, 10),
  };
  await kv().set(userKey(newUser.id), newUser);
  await kv().set(emailKey(email), newUser.id);
  // Seed the new user's product catalog with the default presets, so they
  // start with a usable list instead of an empty sidebar. Stored directly
  // in the HASH layout (no migration needed).
  const seedProducts = buildSeedProducts();
  if (seedProducts.length > 0) {
    const fields: Record<string, Product> = {};
    for (const p of seedProducts) fields[p.id] = p;
    await kv().hset(productsHashKey(newUser.id), fields);
  }
  return newUser;
}

export function verifyPassword(user: DbUser, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}
