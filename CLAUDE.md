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
| Сховище     | Upstash Redis (через `@upstash/redis`)                      | —                                 |
| Файли       | Vercel Blob (`@vercel/blob`) — фото продуктів, стиснення `sharp` | —                            |
| Кроп фото   | `react-easy-crop`                                           | —                                 |
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
│   │       ├── product-image/route.ts        # POST multipart → sharp → Vercel Blob → { url }
│   │       ├── product-image/fetch/route.ts  # POST { url } → SSRF-guarded proxy для кропу в браузері
│   │       ├── product-image/silpo/route.ts  # GET ?q= → пошук товарів на silpo.ua (title + URL картинок)
│   │       ├── nutrition-search/route.ts     # GET ?source=silpo|tablycja&q= → КБЖВ на 100 г із зовнішніх каталогів
│   │       ├── products/route.ts       # GET, PUT
│   │       ├── dishes/route.ts         # GET, PUT
│   │       ├── meals/route.ts          # GET, PUT (всі дні)
│   │       ├── meal-presets/route.ts   # GET, PUT
│   │       ├── targets/route.ts        # GET, PUT
│   │       ├── macro-targets/route.ts  # GET, PUT
│   │       ├── pinned/route.ts         # GET, PUT
│   │       ├── meals-done/route.ts     # GET, PUT
│   │       ├── weight-log/route.ts     # GET, PUT
│   │       └── settings/route.ts       # GET, PUT (weekStartDay тощо)
│   ├── components/            # 10 React-компонентів (модалки, продукти, страви, статистика)
│   ├── context/
│   │   └── DataContext.tsx    # глобальний state + auto-save (debounce 500мс)
│   ├── data/
│   │   └── presets.ts         # каталог продуктів (~120 шт), категоризований
│   ├── hooks/                 # порожній — кандидат на винесення хуків з App.tsx
│   ├── lib/                   # SERVER-ONLY
│   │   ├── auth.ts            # createToken, verifyToken, set/get/clear cookie
│   │   ├── db.ts              # Upstash Redis (per-slice read/write + auto-migration)
│   │   ├── images.ts          # sharp → 512px WebP, put/del у Vercel Blob, fetchRemoteImage з SSRF-захистом
│   │   ├── silpo.ts           # searchSilpo(): публічний storefront API sf-ecom-api.silpo.ua, картинки images.silpo.ua
│   │   ├── nutritionSources.ts # searchNutrition(): Сільпо (attributeGroups.nutrient з картки) і tablycjakalorijnosti (autocomplete + JSON-LD сторінки)
│   │   └── validators.ts      # type guards для тіл PUT-запитів
│   ├── utils/
│   │   ├── nutrients.ts       # розрахунки КБЖУ для продукту/страви
│   │   ├── imageCrop.ts       # CLIENT: експорт квадратного кропу в WebP/JPEG, витяг фото з буфера
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
3. Кожен з 9 data-route handlers додатково перевіряє токен через `getAuthFromCookie()` — це **обов'язковий** дубль (middleware/proxy не покриває server functions).
4. Logout: `POST /api/auth/logout` → `cookieStore.delete('mb-token')` → клієнт робить `window.location.href = '/login'`.

### Data flow

- **Завантаження:** `DataProvider.sync()` робить **10 паралельних GET** (по одному на slice, `cache: 'no-store'`) і застосовує результат. Викликається при mount і повторно — див. «Синхронізація» нижче. Якщо хоч один slice впав, весь `sync` відхиляється: наявні дані лишаються, а не підмінюються дефолтами (порожній стан у памʼяті — це саме те, що потім затирає сервер).
- **Збереження:** кожен slice має власний debounced (500мс) PUT через `useDebouncedSave`. Зміна одного slice (напр., `products`) НЕ триггерить PUT інших — кожен endpoint валідує тільки свою форму, тож пошкоджений запит не може стерти інші дані. Блок захищений `initialized.current = true` через 100мс після завантаження, щоб не зберегти defaults.
- **Сервер:** `readSlice<K>(userId, key)` / `writeSlice<K>(userId, key, value)` — async-функції в `src/lib/db.ts`, що читають/пишуть в Upstash Redis за ключами `mb:user:{userId}:{slice}`. Користувачі — `mb:user:{id}` + `mb:userByEmail:{email}` (індекс).
- **Сід:** `ensureSeedUser()` lazy-створює demo-юзера (`vr.peredera@gmail.com` / `mealbuilder123`) на першому виклику auth-функції, якщо його ще нема в KV. Idempotent. Каталог продуктів із `presets.ts` сідиться через `seedProductCatalog()` рівно один раз на користувача (прапорець `mb:user:{id}:products:seeded`, `SET NX`), і для зареєстрованих, і для demo-юзера.
- **Валідація:** кожен PUT route використовує type guard з `src/lib/validators.ts` (`isProductArray`, `isDailyMeals` тощо). Невалідне тіло → `400 Invalid shape`.
- **Файлова система більше не використовується** runtime-кодом. Папка `db/` залишена тимчасово як джерело для `npm run migrate:kv`.

### Фото продуктів

- `Product.imageUrl` — публічний URL мініатюри у Vercel Blob (`products/{userId}/…webp`). Це **зовнішній вигляд** продукту, не пов'язано зі сканером етикеток.
- Джерела в `ProductImageField`: файл з галереї, буфер обміну (кнопка через Clipboard API або Ctrl+V у формі, приймає і зображення, і http-посилання), посилання, пошук у Сільпо (`SilpoImagePicker`: запит підставляється з назви продукту, вибране 800px фото йде через `/api/product-image/fetch`). Усі шляхи ведуть у `ImageCropModal` (react-easy-crop, aspect 1:1).
- Сільпо: неофіційний API, який використовує їхній сайт (`sf-ecom-api.silpo.ua/v1/uk/branches/<нульовий uuid>/products?search=`). Може змінитись без попередження, тому `searchSilpo` толерантний до форми відповіді і повертає порожній список, а не падає.
- Завантаження відбувається **лише при submit** форми (`ProductForm`), тож скасування не лишає сиріт у Blob.
- `POST /api/product-image` приймає ≤4 МБ (ліміт тіла Vercel-функції 4.5 МБ), `sharp` робить 512×512 WebP q80.
- `POST /api/product-image/fetch` проксіює віддалене зображення для кропу (браузер не може читати чужі картинки через CORS). Захист: лише http/https, DNS-резолв і заборона приватних діапазонів на кожному редіректі, ліміт 15 МБ, таймаут 15 с, `content-type: image/*`.
- Роути продуктів приймають `imageUrl` лише з нашого Blob-хоста і префікса цього користувача (`isOwnProductImageUrl`); при заміні або видаленні продукту старий blob видаляється best-effort.

### Імпорт КБЖВ

- Кнопка «Імпорт КБЖВ» у `ProductForm` відкриває `NutritionImportModal` з двома джерелами. Запит підставляється з назви продукту; вибір заповнює калорії/Б/Ж/В, назву лише якщо поле порожнє. Якщо в результаті є фото, воно тягнеться через `/api/product-image/fetch` і стає draft без кропу (сервер центрує квадрат при збереженні).
- Обидва джерела потребують другого запиту на кожен результат (Сільпо: картка товару, таблиця: HTML сторінки), тому fan-out обмежений `DETAIL_LIMIT = 8`, усе паралельно з таймаутом 12 с. Результати без харчової цінності відкидаються.
- Це неофіційні ендпоінти, парсери толерантні: невідома форма → порожній список, а не 500.

### Синхронізація між пристроями

Клієнт тримає повне дзеркало даних у памʼяті, тому довго відкрита вкладка (типово — телефон) показує і **записує назад** застарілу копію. Наприклад `setMealsForDate` пише день цілком, тож зміни, зроблені на іншому пристрої, зникали.

- `sync()` перечитує всі slices і оновлює state **без** прапорця `loading` (UI не блимає).
- Автоматично: `visibilitychange` (тільки коли `visibilityState === 'visible'`), `focus`, `pageshow` (bfcache — телефон воскрешає вкладку без жодного запиту), `online`. Дедуплікація подій — `MIN_AUTO_SYNC_GAP_MS = 3000`.
- Вручну: `SyncButton` у шапці показує, наскільки свіжі дані («щойно», «5 хв тому», «Не оновилось»).
- **Захист від втрати локальних правок:** `sync` не запускається, поки `pendingWrites.current > 0` (є незавершений granular-запис), а blob-slices (`targets`/`macroTargets`/`settings`) не перезаписуються, якщо локальне значення відрізняється від baseline — тобто користувач щойно щось увів і debounce ще не відпрацював.
- **Фонового поллінгу немає навмисно:** 10 GET кожні N секунд на відкриту вкладку швидко зʼїли б ліміт Upstash (500K команд/міс).
- Лишається вузьке місце: одночасне редагування **одного й того ж дня** на двох пристроях — виграє той, хто зберіг останнім.

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
- `settings.weekStartDay` — день початку тижня (`0` = нд … `6` = сб, як `Date#getDay()`), задається в модалці налаштувань і визначає тижневе вікно в `StatsPanel`. Дефолт `1` (понеділок).

## Налаштування для локального запуску

```bash
npm install
cp .env.example .env.local
# Заповніть .env.local з Upstash dashboard (або `vercel env pull`)
npm run dev   # http://localhost:3000
```

Demo-користувач створюється автоматично в KV при першому виклику auth:

- **Email:** `vr.peredera@gmail.com`
- **Пароль:** `mealbuilder123`

Обов'язкові env vars (локально і в prod):

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — сховище. Альтернативні назви `KV_REST_API_URL` / `KV_REST_API_TOKEN` теж працюють.
- `JWT_SECRET` — обов'язково в production, інакше використовується небезпечний fallback.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob для фото продуктів (інжектиться при прив'язці store до проєкту).
- `NODE_ENV=production` — щоб cookie стало `secure`.


## Скрипти

```bash
npm run dev      # next dev (Turbopack за замовчуванням у Next 16)
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

## Ключові інваріанти, які легко зламати

1. **Не імпортуйте `src/lib/auth.ts` чи `src/lib/db.ts` у файли з `'use client'`** — вони використовують `next/headers` і Upstash REST client (з токеном). Імпорт лише з route handlers або серверних компонентів.
2. **Не додавайте поле в `UserData`** без синхронізації: тип у `src/types.ts` → defaults і файл-мапа в `src/lib/db.ts` (`SLICE_FILES`, `SLICE_DEFAULTS`) → type guard у `src/lib/validators.ts` → новий `route.ts` у `src/app/api/...` → state + endpoint + `useDebouncedSave` у `src/context/DataContext.tsx`.
3. **Не покладайтеся** на middleware/proxy для авторизації API — кожен route handler **сам** перевіряє `getAuthFromCookie()`.
4. **Не міняйте формат `MealItem.sourceType`** без міграції наявних `db/userdata/*.json` — вони містять рядки `'product'` / `'dish'`.
5. **Не виводьте `passwordHash`** в API-відповідях.
6. **Не міняйте бекенд debounce** з 500мс на менше — це створить навантаження на fs writes і race condition.
7. **Не плутайте `getDishNutrients`** (повертає КБЖУ на 100г) з `getDishTotalWeight` (вага всієї страви).
8. **Не приймайте довільний `imageUrl`** у роутах продуктів — лише через `isOwnProductImageUrl`, інакше можна підставити чужий blob або видалити чужий файл при cleanup.

## Технічний борг (не блокери, але треба знати)

- `src/middleware.ts` — застаріла конвенція в Next.js 16. Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- `src/App.tsx` ~880 рядків — потрібне рефакторингове розділення (винести handlers у `src/hooks/`, JSX — на менші компоненти).
- File-based DB без блокувань — race condition при concurrent writes. Для production — справжня БД (Postgres/SQLite через Prisma/Drizzle) або хоча б `proper-lockfile`.
- `bcrypt.hashSync`/`compareSync` блокує event loop. Перейти на async версії при міграції з file-DB.
- `exportPdf` через `document.write` — браузери поступово припиняють це підтримувати.
- Немає серверної валідації на `/api/auth/register` (формат email, складність пароля). Слайс-роути валідуються type guards вручну — варто перейти на `zod`.
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
