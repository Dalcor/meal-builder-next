# Інструкції для код ревью — Meal Builder

Цей документ описує, **на що звертати увагу під час перевірки змін** у проєкті Meal Builder. Перед ревью прочитайте `CLAUDE.md` у корені — він містить опис архітектури, стеку та логіки.

---

## 0. Перед початком ревью

1. **Перевірте `node_modules/next/dist/docs/`** — у цьому проєкті використовується Next.js 16, який має breaking changes порівняно з тим, що знає більшість моделей. Якщо ревюїте код, що використовує Next.js API, звіряйтеся з bundled docs, а не з пам'яттю.
2. Перевірте, що зміни узгоджуються з обома файлами `AGENTS.md` і `CLAUDE.md` (зокрема правилом «читати docs перед написанням коду»).
3. Якщо PR торкається auth, storage або middleware — це **критичні** зони, ревью має бути максимально ретельним.

---

## 1. Next.js 16 — критичні правила

### 1.1 `middleware.ts` deprecated → `proxy.ts`

У Next.js 16 файл `middleware.ts` deprecated і має бути перейменований на `proxy.ts`, а функція `middleware` → `proxy`.

- **Зараз у проєкті:** `src/middleware.ts` — застаріла конвенція. Якщо ревьюєте PR, що торкається цього файлу, **запропонуйте міграцію**: `npx @next/codemod@canary middleware-to-proxy .`
- Якщо створюється новий middleware-подібний код — **обов'язково** використовуйте `proxy.ts` + експорт `proxy`, а не `middleware`.
- Перевірте, що `matcher` лишається коректним після перейменування.

### 1.2 `cookies()` — async

```ts
// Правильно (Next.js 15+):
const cookieStore = await cookies();
cookieStore.set(...);

// Неправильно:
const cookieStore = cookies();
```

У `src/lib/auth.ts` це зроблено правильно — будь-які нові виклики `cookies()` мають бути awaited.

### 1.3 Route handlers — серверна перевірка авторизації

`proxy.ts` (раніше middleware) **не гарантує** захист API routes для server functions та edge cases. Кожен route handler у `src/app/api/**/route.ts` має **самостійно** викликати `getAuthFromCookie()` (як це роблять усі 9 data-роутів — `/api/products`, `/api/dishes` тощо).

> **Перевірка під час ревью:** будь-який новий route handler у захищеній зоні має містити:
> ```ts
> const auth = await getAuthFromCookie();
> if (!auth) return NextResponse.json(null, { status: 401 });
> ```
> Покладатися виключно на proxy/middleware — антипатерн.

### 1.4 `'use client'` — обережно з межею

- `'use client'` має бути **на самому верху файлу**, перед імпортами.
- Файли в `src/lib/` (auth, db) **не повинні** містити `'use client'` — це серверний код, що використовує `fs` та `next/headers`.
- Файли в `src/app/api/**/route.ts` **ніколи** не мають `'use client'`.
- Імпорт серверного коду з клієнтського файлу — критична помилка ревью.

---

## 2. Безпека (auth + storage)

### 2.1 JWT та секрети

- `src/lib/auth.ts` має fallback `'meal-builder-secret-key-change-in-production'`. **Це попередження**, а не безпечне значення. Перевірте, що:
  - У production оточенні задана змінна `JWT_SECRET`.
  - Жоден PR не вимикає або не послаблює fallback.
  - Секрет ніколи не потрапляє у клієнтський бандл.
- Перевірте, що cookie `mb-token` зберігає прапори: `httpOnly: true`, `sameSite: 'lax'`, `secure` у production.

### 2.2 Паролі

- `bcrypt.hashSync` / `compareSync` — синхронні. Прийнятно для поточного scale (1-2 користувачі, реєстрація рідка). Якщо очікуються паралельні логіни / реєстрації під навантаженням, замініть на async версії, щоб не блокувати event loop.
- Cost factor `10` — мінімум для нових проєктів. Не зменшуйте.
- **Не дозволяйте** логувати або повертати `passwordHash` у відповіді API.

### 2.3 Валідація вхідних даних

API routes **не мають** жорсткої валідації:
- `/api/auth/register` перевіряє лише непорожність полів.
- Немає перевірки формату email, мінімальної довжини пароля, складності.

> **Якщо PR додає нові ендпоінти** — наполягайте на серверній валідації (наприклад, через `zod`). Ніколи не довіряйте клієнтським перевіркам.

### 2.4 Захист даних користувача

- Кожен з 9 data-ендпоінтів коректно обмежує доступ через `auth.userId` з cookie — переконайтеся, що **жоден новий ендпоінт** не приймає `userId` з тіла/query, а завжди бере його з токена.
- Шлях до файлу будується як `userdata/${userId}.json` — `userId` походить з підписаного JWT, тож path traversal неможливий. Якщо колись з'явиться вхід на основі вводу користувача — додайте sanitization.

### 2.5 Concurrent writes у KV

Upstash Redis виконує `SET` атомарно на рівні одного ключа — конкуренція двох PUT в один slice безпечна (виграє останній writer, без corruption). Але **між** ключами немає транзакції: якщо логіка вимагає узгодженого оновлення двох slice одночасно, оформляйте це як один slice або вводьте версіювання.

> **При ревью змін у `db.ts` / route handlers:**
> - Не приймайте PR, що додає часті записи (наприклад, PUT на кожен `setState`) — воно зараз дебансовано на 500мс у `DataContext`, і це має лишитися. Кожен PUT — це одна команда у free-tier ліміт Upstash (10k/день).
> - Якщо новий route мутує кілька slice одночасно, перевірте чи це справді треба — частіше це сигнал об'єднати їх в один slice.

---

## 3. Архітектура клієнтської частини

### 3.1 `src/App.tsx` — антипатерн

Файл містить ~880 рядків і всю UI-логіку: списки продуктів/страв, drag&drop, модалки, статистику, дату, таргети. Це **технічний борг**.

> **Заохочуйте** PR, що:
> - Виносять обробники (`handleAddProduct`, `handleSaveDish`, `handlePastePreset`) в окремі hooks (`src/hooks/`, який зараз порожній).
> - Розбивають JSX на менші компоненти (Header, Sidebar, MealsList).
> - Виносять допоміжні функції (`generateId`, `toDateKey`, `formatDateLabel`, `shiftDate`) у `src/utils/dates.ts`.
>
> Не вимагайте все одразу, але **не дозволяйте** додавати нові 100+ рядків у `App.tsx` без винесення.

### 3.2 `DataContext` — auto-save

`src/context/DataContext.tsx` робить debounced PUT всіх даних на кожну зміну (500мс). Перевірте:
- Чи не забули покрити нове поле в трьох місцях: `UserData`, `DEFAULTS`, `useEffect` для збереження.
- Чи не зламали flag `initialized.current` — він блокує запис на першому rendering після завантаження.
- Чи не додають нові виклики `fetch('/api/...')` поза `useDebouncedSave` без явної причини.
- Якщо додано новий slice — є відповідний type guard у `src/lib/validators.ts` і route викликає його у PUT.

### 3.3 ID для нових сутностей

Новостворені продукти/страви/items використовують `crypto.randomUUID()`. Серверні `DbUser.id` — `user_${Date.now()}`. **Не змішуйте підходи**: усе нове в state — UUID; усе нове в `users.json` — узгодьте з командою.

### 3.4 Серіалізація

- Усі нові поля в state мають бути JSON-серіалізованими (бо записуються у файл і передаються через fetch).
- **Не зберігайте** Date-об'єкти, Map, Set, function в `UserData`. Дату — як ISO string (`'YYYY-MM-DD'`).

---

## 4. Drag & Drop (@dnd-kit)

- `id` у `useDraggable`/`useDroppable` має бути **глобально унікальним** у межах `DndContext`. Зараз продукти і drop-зони використовують різні неймспейси (`product.id` vs `'breakfast' | 'lunch' | ...`) — їх не можна перетинати.
- `data: { sourceType, sourceId }` у `useDraggable` — це contract для `handleDragEnd`. Не перейменовуйте без оновлення обробника в `App.tsx`.
- `PointerSensor` має `activationConstraint: { distance: 5 }` — клавіатура й accessibility поки не покриті. Якщо PR додає accessibility — це вітається.

---

## 5. Розрахунки KBJU

- `src/utils/nutrients.ts:getDishNutrients` повертає страву на 100г. Не плутайте з `getDishTotalWeight`, що дає вагу всієї страви.
- Округлення до 1 знаку після коми робиться через `round()` лише в `getDishNutrients`. У `MealZone`, `App.tsx`, `exportPdf.ts` форматування — `.toFixed(0|1)`. Це **двошарове** округлення може давати помилку 0.1. **Не переходьте** на `Math.floor`/`Math.ceil` без обговорення.
- `fixedPortion` страви ігнорують модалку грамів — переконайтеся, що нова логіка drag-end це поважає.

---

## 6. UX-патерни

- Native `alert('Невірний формат файлу')` у `App.tsx:handleImport` — тимчасове рішення. Якщо ревью додає нові помилки — використовуйте уже готовий `PromptModal`/створюйте `AlertModal`, а не `alert/confirm`.
- Усі модалки закриваються кліком на overlay (`onClick={onCancel}` на backdrop + `e.stopPropagation()` на body). Зберігайте цей патерн.
- Усі тексти UI — українською. **Не змішуйте** з російською/англійською у видимих рядках.

---

## 7. PDF експорт

`src/utils/exportPdf.ts` будує HTML-стрінг і відкриває нове вікно з `window.open` + `document.write`.

- `document.write` deprecated; може блокуватися браузерами. **Не розширюйте** цей API без переходу на більш стабільний підхід (наприклад, `jspdf` + autoTable, або серверний рендер).
- Будь-який нюанс верстки в PDF має бути перевірений у Chrome **і** Firefox перед мерджем.

---

## 8. TypeScript

- `tsconfig.json` має `strict: true` — **не вимикайте** окремі правила. Якщо `any` чи `unknown` — обов'язкова явна причина в коментарі або PR-описі.
- `UserData` у `src/lib/db.ts` (server) і `UserData` у `src/context/DataContext.tsx` (client) — **дублювання**. Якщо PR змінює форму — змініть в обох місцях. Бонус — винесіть в `src/types.ts`.
- Префер `import type { ... }` для type-only імпортів (це вже виконано всюди, тримайте).

---

## 9. Стилі

- Tailwind v4 через `@tailwindcss/postcss` — **не додавайте** `tailwind.config.js`, конфіг тепер inline у CSS (через `@theme`).
- `src/app/globals.css` мінімальний. Якщо потрібні нові тематичні токени — додавайте через Tailwind v4 `@theme`, а не глобальні CSS-змінні.
- Кольори прив'язані до семантики (amber=сніданок, green=обід, indigo=вечеря, pink=перекуси). Зберігайте узгодженість.

---

## 10. Чек-ліст ревьювера

Перед апрувом перевірте:

- [ ] Усі server-only імпорти (`fs`, `bcryptjs`, `next/headers`) **не** в файлах з `'use client'`.
- [ ] Кожен новий route handler у захищеній зоні викликає `getAuthFromCookie()`.
- [ ] Жодного нового хардкоду секретів (`JWT_SECRET`, паролів, API ключів).
- [ ] Зміни у формі `UserData` синхронізовані: типи, defaults, fetch у `DataContext`, `db.ts`.
- [ ] Якщо PR розширює `App.tsx` — нова логіка винесена або є явна причина залишити.
- [ ] Немає нових `alert/confirm/prompt` — використано модалки.
- [ ] Українська локалізація для нових UI-рядків.
- [ ] `npm run lint` проходить без warnings.
- [ ] `npm run build` успішний.
- [ ] Якщо змінено auth-флоу — описано план тестування у PR (логін → перезавантаження → logout → доступ до `/`).
- [ ] Якщо змінено `middleware.ts` — обговорено перейменування на `proxy.ts`.

---

## 11. Дисципліна змін схеми (persisted data)

User-data slices в KV — це JSON-блоби. Їхня форма перевіряється `src/lib/validators.ts` при кожному PUT. Якщо ваші зміни ламають форму — клієнт отримує `400`, зміни не зберігаються, ризик мовчазної втрати даних. Минулий інцидент (втрата макі/лосося/яблука під час deploy) показав це на практиці. Правила:

1. **Нові поля — завжди опціональні.** `field?: T`. Validator: `if (v.field !== undefined) { ... }`. Старі клієнти, що не шлють `field`, продовжують зберігатися.
2. **Не міняйте тип існуючого поля.** Якщо потрібен новий формат — додайте нове поле, депрекейте старе. Перехідний період: код читає обидва, пише нове.
3. **Не переймейновуйте поля.** Те саме — додайте нове, мігруйте при читанні.
4. **Validator має бути permissive до зайвих полів.** Старі клієнти можуть надсилати поля, яких уже нема. Не валідатор має це відсікати — просто ігнорувати їх. (Поточні validators не перевіряють `Object.keys` строго — це коректно.)
5. **Backfill при читанні, не при записі.** Якщо існуючі дані не мають нового поля — заповніть його у `DataContext` після bootstrap (як зараз робить `backfillSnapshots`). Не ламайте PUT-ендпоінт вимогою.
6. **Перевірити «old client → new server» вручну.** Перед пушем, скрафтіть PUT з тілом старої форми (наприклад, `MealItem` без `snapshot`) і впевніться що 200, не 400. Можна curl-ом або з DevTools.
7. **При неминучих breaking changes** (рідко): робіть це окремим релізом з міграцією KV даних *перед* deploy. Скрипт типу `scripts/migrate-fs-to-kv.mjs` — приклад однократної міграції.

> **Чек:** усі сучасні MealItem мають `id`, `sourceType`, `sourceId`, `grams`. Все інше (`snapshot`, тощо) — опціональне. Усі сучасні Product мають 4 КБЖУ + `id` + `name`. `unit` і `fixedPortion` — опціональні. Це baseline, що не повинен ламатися.

## 12. Що **відхиляти** автоматично

- PR, що commit-ить `db/users.json` з реальними хешами або файли з `db/userdata/`.
- PR, що commit-ить `.env*`.
- PR, що додає `JWT_SECRET` або інший секрет в `next.config.ts` чи в коді.
- PR без опису + без test plan, що торкається auth, storage або міграцій.
- PR, що понижує bcrypt cost або змінює алгоритм хешу.
- PR, що використовує `git push --force` на `main`.

---

## 13. Корисні команди

```bash
npm run dev        # локальний dev server (port 3000)
npm run build      # production build
npm run start      # production server
npm run lint       # eslint

# Codemods (Next.js 16):
npx @next/codemod@canary middleware-to-proxy .
```

Якщо потрібно скинути локального користувача — видаліть `db/users.json` (буде створений seed-користувач: `vr.peredera@gmail.com` / `mealbuilder123`). **Цей seed — лише для локальної розробки.**
