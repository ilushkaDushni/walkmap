# CLAUDE.md

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build (Turbopack)
- `npm run lint` — ESLint
- `ngrok http 3000` — публичный туннель для тестирования

## Architecture

**Next.js 16 + React 19** PWA for walking routes with interactive maps.

- **App Router** (`src/app/`): pages are server components by default; interactive ones use `"use client"`
- **Routes**: `/` (home), `/routes` (list), `/routes/[routeId]` (detail + map), `/profile`, `/settings`, `/~offline`
- **Components** (`src/components/`): RouteMap, RouteCard, RoutePath, StopMarker, UserMarker, StopDetail, SimulationControls, BottomNav, ProfileModal, SettingsModal, AdminModal, ThemeProvider, UserProvider
- **Hooks** (`src/hooks/`): `useSimulation` (animate along route path), `useUserLocation` (GPS tracking)
- **Data** (`src/data/routes.json`): route definitions with calibration points, pixel-based routePath, and stops
- **Lib** (`src/lib/mapGpsToMapXY.js`): affine transform — 3 GPS↔pixel calibration points convert device GPS to map coordinates
- **Lib** (`src/lib/mongodb.js`): MongoDB connection singleton (globalThis cache for HMR)
- **Lib** (`src/lib/tokens.js`): JWT token utilities — signAccessToken, verifyAccessToken, generateRefreshToken (jose)
- **API** (`src/app/api/`):
  - `auth/register` — POST, validates input, hashes password (bcryptjs), sends 6-digit code via Resend, stores in `pending_verifications`
  - `auth/verify` — POST, checks code + expiry, creates user in `users` collection
  - `auth/login` — POST, email + password (bcrypt compare)
  - `auth/me` — GET, verifies JWT access token (Authorization: Bearer), returns user
  - `auth/refresh` — POST, reads httpOnly refresh cookie, rotates tokens, returns new accessToken + user
  - `auth/logout` — POST, deletes refresh token from DB, clears cookie

## Tech Stack

- **Framework**: Next.js 16.1.6 + React 19.2.3
- **Styling**: Tailwind CSS 4 + CSS variables (dark/light themes)
- **Database**: MongoDB 8.2 (local, `mongodb://localhost:27017/pepe`)
- **Email**: Resend (`noreply@malisha.website`)
- **Auth**: bcryptjs (password hashing), JWT access/refresh tokens (jose)
- **PWA**: Serwist service worker
- **Icons**: lucide-react

## Map System

Custom SVG overlay on static map images (no Leaflet/Mapbox). Route paths, stop markers, and user position are rendered as SVG elements. GPS coordinates are converted to pixel positions via affine transformation using calibration data in routes.json.

## Theming

CSS variables in `globals.css` — dark theme by default, light via `[data-theme="light"]`. ThemeProvider context + localStorage persistence. Inline script in layout.js prevents flash.

Key variables: `--bg-main`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--border-color`.

## PWA

Serwist service worker (`src/app/sw.js`). Caching: CacheFirst for maps/images (30d), StaleWhileRevalidate for JS/CSS (7d). Offline fallback → `/~offline`.

## MongoDB & Auth

Local MongoDB (`MONGODB_URI` in `.env.local`). Domain: `malisha.website` (verified in Resend).

**Collections:**
- `users` — `{ username, email, passwordHash, role: "user"|"admin", createdAt }`
- `pending_verifications` — `{ username, email, passwordHash, code, createdAt, expiresAt }` (TTL 10 min)
- `refresh_tokens` — `{ token, userId, createdAt, expiresAt }` (7 day TTL, rotated on each refresh)

**Registration flow:** ProfileModal → "Зарегистрироваться" → ввод логина/email/пароля (x2) → API отправляет 6-значный код на email через Resend → ввод кода → аккаунт создан с `role: "user"`.

**Login flow:** ProfileModal → "Войти" → email + пароль → bcrypt compare → сессия.

**Admin:** роль `admin` назначается вручную в MongoDB (через Compass). AdminModal (Shield icon) появляется в BottomNav между Профилем и Маршрутами.

**Session — JWT access/refresh tokens:**
- **Access token**: JWT (HS256, 15 min TTL), stored in memory (React ref). Contains `{ userId, role }`. Sent via `Authorization: Bearer <token>`.
- **Refresh token**: random 64-char hex, 7 day TTL, stored as `httpOnly` cookie + in MongoDB `refresh_tokens` collection.
- **Token rotation**: POST `/api/auth/refresh` reads cookie → validates in DB → issues new access + new refresh token.
- **Session restore**: on page load, UserProvider calls `/api/auth/refresh` (cookie sent automatically) → restores user + accessToken.
- **authFetch**: wrapper in UserProvider that adds Bearer header; on 401 → auto-refresh → retry.
- **Logout**: POST `/api/auth/logout` → deletes refresh token from DB + clears cookie.

## GitHub

- **Repo**: https://github.com/ilushkaDushni/walkmap
- **Branch**: `main`

## .env.local

```
MONGODB_URI=mongodb://localhost:27017/pepe
RESEND_API_KEY=re_...
JWT_SECRET=<random-64-char-hex>
```

## Conventions

- **Language**: all UI text is in Russian (`lang="ru"`)
- **Path alias**: `@/*` → `src/*` (jsconfig.json)
- **Styling**: Tailwind CSS 4 + CSS variables; no CSS modules
- **Icons**: lucide-react
- **State**: React hooks + Context (ThemeProvider, UserProvider); no Redux
- **Static data**: routes.json is imported directly; user data via MongoDB API routes
- **Passwords**: hashed with bcryptjs (salt rounds: 10)
- **Email verification**: 6-digit code, 10 min expiry, sent via Resend from `noreply@malisha.website`

## Admin Panel (AdminModal)

Placeholder sections (stubs, to be implemented):
- Управление маршрутами (Route management)
- Пользователи (Users)
- Статистика (Statistics)
