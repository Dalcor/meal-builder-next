@AGENTS.md

# Meal Builder — контекст проєкту

> **Перед першим запитом:** прочитайте `docs/code-review.md` — там описані правила ревью, на які треба орієнтуватися також під час написання коду.

## Мета

Веб-додаток для **планування раціону з підрахунком КБЖУ** (калорії / білки / жири / вуглеводи). Користувач:

1. Веде каталог продуктів (свій + готовий пресет з ~120 продуктів) і конструює з них «страви» (recipes).
2. Перетягує продукти/страви у чотири зони дня — `breakfast` / `lunch` / `dinner` / `snacks`.
3. Бачить підсумкові КБЖУ за день і за прийом їжі, цільові показники, прогрес-бари.
4. Зберігає шаблони прийомів їжі (presets) і вставляє їх у будь-який день.
5. Веде журнал ваги, переглядає статистику за 30 днів, експортує день у PDF (через `window.print`).

Усі тексти UI — **українською**.

## Стек

| Шар         | Технологія                                                  | Версія                            |
| ----------- | ----------------------------------------------------------- | --------------------------------- |
| Framework   | Next.js (App Router)                                        | 16.2.4                            |
| UI          | React                                                       | 19.2.4                            |
| Стилі       | Tailwind CSS                                                | 4 (через `@tailwindcss/postcss`)  |
| Drag & drop | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`  | —                                 |
| Auth        | JWT через `jose` + cookie                                   | —                                 |
| Паролі      | `bcryptjs` (sync)                                           | —                                 |
| Сховище     | JSON-файли в `/db`                                          | —                                 |
| TypeScript  | strict                                                      | 5                                 |

> **Next.js 16 має breaking changes**. Найважливіше для цього проєкту:
> - `middleware.ts` deprecated → має бути `proxy.ts` (функція `proxy`). Зараз у проєкті ще `src/middleware.ts` — це борг.
> - `cookies()` тепер async — обов'язково `await cookies()`.
> - `'use client'` має бути на самому верху, перед імпортами.
>
> Завжди звіряйтеся з `node_modules/next/dist/docs/` (це bundled docs під вашу версію), а не з пам'яттю.

## Структура

```
meal-builder-next/
├── AGENTS.md                  # правило: читати docs перед кодуванням
├── CLAUDE.md                  # цей файл
├── docs/
│   └── code-review.md         # інструкції для ревью
├── db/                        # NOTE: persist; gitignore не покриває
│   ├── users.json             # масив користувачів з bcrypt-хешами
│   └── userdata/
│       └── user_<id>.json     # один файл = усі дані одного користувача
├── public/                    # SVG іконки створені CRA-стартером
├── src/
│   ├── app/                   # App Router
│   │   ├── layout.tsx         # html lang="uk", глобальний CSS
│   │   ├── page.tsx           # 'use client' → DataProvider + <App/>
│   │   ├── globals.css        # @import "tailwindcss"
│   │   ├── login/page.tsx     # форма входу/реєстрації
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts      # POST → set cookie
│   │       │   ├── logout/route.ts     # POST → clear cookie
│   │       │   ├── me/route.ts         # GET → перевірка токена
│   │       │   └── register/route.ts   # POST → create user
│   │       └── data/route.ts           # GET/PUT усіх даних користувача
│   ├── components/            # 10 React-компонентів (модалки, продукти, страви, статистика)
│   ├── context/
│   │   └── DataContext.tsx    # глобальний state + auto-save (debounce 500мс)
│   ├── data/
│   │   └── presets.ts         # каталог продуктів (~120 шт), категоризований
│   ├── hooks/                 # порожній — кандидат на винесення хуків з App.tsx
│   ├── lib/                   # SERVER-ONLY
│   │   ├── auth.ts            # createToken, verifyToken, set/get/clear cookie
│   │   └── db.ts              # fs-based JSON DB (sync writes)
│   ├── utils/
│   │   ├── nutrients.ts       # розрахунки КБЖУ для продукту/страви
│   │   └── exportPdf.ts       # window.open + document.write + window.print
│   ├── App.tsx                # NOTE: ~880 рядків — головна UI-збірка
│   ├── middleware.ts          # NOTE: deprecated в Next 16 → треба proxy.ts
│   └── types.ts               # Product, Dish, MealItem, Meals, MealPreset, ...
├── eslint.config.mjs          # eslint flat config + next presets
├── next.config.ts             # дефолт
├── postcss.config.mjs         # @tailwindcss/postcss
├── tsconfig.json              # paths: @/* → ./src/*
└── package.json
```

## Логіка та потоки даних

### Auth flow

1. `POST /api/auth/register` або `/login` → `bcrypt.compareSync` → `setAuthCookie({ userId, email })` → JWT (HS256, 30 днів) у cookie `mb-token` (`httpOnly`, `sameSite=lax`, `secure` у production).
2. На кожен запит до сторінки **і** API `src/middleware.ts` перевіряє валідність токена (виключення: `/api/auth/*`, `/login`, `/_next/*`, `/favicon.ico`).
3. API `/api/data` додатково перевіряє токен через `getAuthFromCookie()` — це **обов'язковий** дубль (middleware/proxy не покриває server functions).
4. Logout: `POST /api/auth/logout` → `cookieStore.delete('mb-token')` → клієнт робить `window.location.href = '/login'`.

### Data flow

- **Завантаження:** при mount `DataProvider` робить `GET /api/data` → отримує об'єкт `UserData` (`products`, `dishes`, `dailyMeals`, `targets`, `macroTargets`, `pinnedIds`, `mealsDone`, `mealPresets`, `weightLog`).
- **Збереження:** будь-яка зміна локального state триггерить debounced (500мс) `PUT /api/data` з усім блобом `UserData`. Блок захищений `initialized.current = true` через 100мс після завантаження, щоб не зберегти defaults.
- **Сервер:** `getUserData(userId)` читає `db/userdata/${userId}.json`, мерджить з `DEFAULT_USER_DATA`. `saveUserData` робить `fs.writeFileSync` (без блокувань — race condition, якщо запити одночасні).

### Drag & drop

- `useDraggable` навішений на `DraggableProduct` (продукт або страва), `data: { sourceType, sourceId }`.
- `useDroppable` навішений на чотири `MealZone` за `id: MealType`.
- `App.tsx:handleDragEnd` витягує nutrients, для **fixedPortion**-страв одразу додає весь вміст (без модалки), інакше відкриває `PortionModal`.

### KBJU розрахунки

- Продукт зберігається у форматі **на 100г**.
- Страва (`Dish`) — це список `{ productId, grams }`. `getDishNutrients` рахує сумарні КБЖУ і нормує до 100г, повертаючи `FoodNutrients` з ім'ям страви.
- `MealItem` — `{ sourceType: 'product'|'dish', sourceId, grams }`. Для відображення завжди множиться на `grams / 100`.
- День (`dayTotals`) — сума по всіх 4-х зонах `Meals`.

### Зберігання дати

- Ключ дня — рядок `YYYY-MM-DD` (utility-функції в `App.tsx`: `toDateKey`, `shiftDate`, `formatDateLabel`, `todayKey`).
- `dailyMeals[dateKey]` — об'єкт `Meals` для цього дня. Якщо запису немає — використовується `EMPTY_MEALS` (read-only).
- `mealsDone[dateKey][mealType]` — чекбокс «з'їдено».
- `weightLog[dateKey]` — число (кг) або відсутнє.

## Налаштування для локального запуску

```bash
npm install
npm run dev   # http://localhost:3000
```

Перший запуск автоматично створить `db/users.json` із seed-користувачем:

- **Email:** `vr.peredera@gmail.com`
- **Пароль:** `mealbuilder123`

Це **виключно** для локальної розробки. У production задавайте:

- `JWT_SECRET` — обов'язково, інакше використовується небезпечний fallback.
- `NODE_ENV=production` — щоб cookie стало `secure`.

## Скрипти

```bash
npm run dev      # next dev (Turbopack за замовчуванням у Next 16)
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

## Ключові інваріанти, які легко зламати

1. **Не імпортуйте `src/lib/auth.ts` чи `src/lib/db.ts` у файли з `'use client'`** — вони використовують `fs` і `next/headers`. Імпорт лише з route handlers або серверних компонентів.
2. **Не додавайте поле в `UserData`** в одному місці — синхронізуйте у трьох: `src/types.ts` (бажано), `src/lib/db.ts` (`UserData` + `DEFAULT_USER_DATA`), `src/context/DataContext.tsx` (`UserData` + `DEFAULTS` + state + ефект).
3. **Не покладайтеся** на middleware/proxy для авторизації API — кожен route handler **сам** перевіряє `getAuthFromCookie()`.
4. **Не міняйте формат `MealItem.sourceType`** без міграції наявних `db/userdata/*.json` — вони містять рядки `'product'` / `'dish'`.
5. **Не виводьте `passwordHash`** в API-відповідях.
6. **Не міняйте бекенд debounce** з 500мс на менше — це створить навантаження на fs writes і race condition.
7. **Не плутайте `getDishNutrients`** (повертає КБЖУ на 100г) з `getDishTotalWeight` (вага всієї страви).

## Технічний борг (не блокери, але треба знати)

- `src/middleware.ts` — застаріла конвенція в Next.js 16. Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- `src/App.tsx` ~880 рядків — потрібне рефакторингове розділення (винести handlers у `src/hooks/`, JSX — на менші компоненти).
- File-based DB без блокувань — race condition при concurrent writes. Для production — справжня БД (Postgres/SQLite через Prisma/Drizzle) або хоча б `proper-lockfile`.
- `bcrypt.hashSync`/`compareSync` блокує event loop. Перейти на async версії при міграції з file-DB.
- Дублювання типу `UserData` між server (`src/lib/db.ts`) і client (`src/context/DataContext.tsx`). Винести в `src/types.ts`.
- `exportPdf` через `document.write` — браузери поступово припиняють це підтримувати.
- Немає серверної валідації (zod/yup) на `/api/auth/register` і `/api/data`.
- `src/hooks/` порожній — кандидат для винесення `useMealActions`, `useProductActions`, `useDateNav` з `App.tsx`.

## Корисні команди для дослідження

```bash
# Що змінилося в Next.js 16
ls node_modules/next/dist/docs/01-app/02-guides/migrating/

# Чи сидить ще middleware.ts там, де не має бути
ls src/middleware.ts && echo "ще не мігровано"

# Подивитися на форму збережених даних користувача
cat db/userdata/user_1.json | head -100
```
