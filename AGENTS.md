# UniService — Agent Guide

## Architecture

Full-stack app: **React 18 + Vite** frontend → **.NET 8 API** (ASP.NET Core) → **Supabase PostgreSQL** (shared with the Flutter app).

```
Proyecto/
├── frontend/              # React + Vite SPA (port 5173)
├── UniserviceAPI/         # .NET 8 API (port 5165)
├── database/              # SQL migration files (numbered 01, 02, ...)
├── docker-compose.yml     # SQL Server container + auto-imports ./database/*.sql
└── package.json           # Root scripts: npm run dev
```

## Commands

| Task | Command | Notes |
|------|---------|-------|
| Start everything | `npm run dev` (root) | Starts Docker DB (40s wait) + frontend. **Does NOT start the API** |
| Start frontend only | `cd frontend && npm run dev` | Proxies `/api`, `/imagenes-servicios`, `/chathub` → `localhost:5165` |
| Start API | Open `UniserviceAPI/UniserviceAPI.sln` in Visual Studio, press F5 | Or `dotnet run` in `UniserviceAPI/UniserviceAPI/` |
| Stop DB | `npm run stop` (root) | |
| Remove DB containers | `npm run clean` (root) | |
| Build frontend | `cd frontend && npm run build` | |

**API runs on port 5165.** Vite dev server proxies all `/api/*` requests there. No CORS issues in dev.

## Frontend Structure

- Entry: `frontend/src/main.jsx` → `App.jsx` (React Router)
- Routes: `/login`, `/home-guest`, `/home`, `/servicio`, `/perfil`, `/perfil/:id`, `/admin-dashboard`
- Pages: `frontend/src/Pages/` — organized by role: `Principal/`, `Guest/`, `Admin/`, `shared/`
- Shared constants: `frontend/src/Pages/shared/constantes.js` — pagination (8/page), categories, API endpoints, dynamic form configs
- Auth: JWT stored in `localStorage` as `token` + `usuarioId`
- Theme: dark/light via `data-theme` attribute on `<html>`, CSS in `styles/` + `styles/light_theme/`
- **No lint, no typecheck, no test framework configured.** Skip those steps.

## Backend Structure

- `UniserviceAPI/` is a copy of the API of the mobile app (`UniserviceAPP/UniserviceAPI`): both share the same Supabase DB, so keep them in sync when the schema changes.
- Framework: ASP.NET Core 8, controllers under `UniserviceAPI/UniserviceAPI/Controllers/`. Raw Npgsql queries.
- Routes: `/api/auth` (login, register, logout, change-password), `/api/auth/institutional-email` (OTP send/verify), `/api/servicios`, `/api/solicitudes`, `/api/calificaciones`, `/api/perfil`, `/api/chat`, `/api/reportes`, `/api/admin` (+ `/api/admin/acceso`).
- Auth: JWT (`token` in localStorage). The user always comes from the token, never from the body/URL. Sessions are revocable (logout and password changes invalidate old tokens).
- Registration: only `@unicesar.edu.co`; send-code → verify-code (returns `verificacion_token`) → register. Google login and change-email are disabled.
- Admin panel: account login + per-admin admin password (`/api/admin/acceso/verificar`); its token goes in `X-Admin-Elevacion` (`apiFetch` adds it to `/api/admin/*`).
- Services: `estado` pendiente → aprobado ⇄ pausado, or rechazado. Any edit (text or images) returns it to pendiente.
- Email: Brevo API. Storage: Supabase Storage bucket `imagenes-servicios`. SignalR hub at `/chathub` (JWT in `?access_token=`); messages are sent by REST.
- Frontend API helpers: `frontend/src/utils/apiFetch.js`, adapters in `frontend/src/Pages/shared/{servicios,solicitudes,chat}.js`.

## Database

- Supabase PostgreSQL shared with the mobile app. Current migrations (already applied): `database/supabase/` (see its README). Do not run the old `database/*.sql` scripts against Supabase.
- Docker/SQL Server (`docker-compose.yml`) is the old local setup and does not match the current schema.

## Environment

- API config: `UniserviceAPI/UniserviceAPI/appsettings.json` or `.env` next to `Program.cs` (see `UniserviceAPI/.env.example`). Neither is committed. Required: `ConnectionStrings__DefaultConnection`, `Jwt__Key` (≥32 chars, not the old default), `InstitutionalEmail__CodeKey`, `Brevo__*`, `Supabase__Url`, `Supabase__ServiceKey`.

## Conventions

- No TypeScript, no ESLint, no Prettier config — plain JS/JSX
- CSS: custom CSS files per page/component, no CSS-in-JS, no Tailwind
- Icons: Bootstrap Icons (`bi-*` classes)
- API calls: raw `fetch()`, no axios for app code (axios is a dep but unused)
- Date format: Spanish locale (`es-ES`, `es-CO`)
- Currency: COP (Colombian Pesos)
