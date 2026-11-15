# WeCare Autism Academy

One Next.js app with three areas (see `design/system-design.md`):

| Area | Path | Who |
|---|---|---|
| Public website | `/` (`app/(site)`) | Everyone |
| Parent portal | `/portal` (`app/(portal)`) | Parents (self-registered) |
| Clinic app (installable PWA) | `/app` (`app/(clinic)/app`) | Admin and staff |

Stack: Next.js 16 (App Router), React 19, Drizzle ORM on Postgres (Neon in production), Better Auth
(email and password), Zod.

- Clinic app and parent portal: stock Ant Design 6 (default theme and layout, no visual overrides).
- Public website: its own design built with Tailwind 4, Phosphor icons and native accessible forms.
  It does not load Ant Design.

## Local setup

```bash
npm install
cp .env.example .env.local          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:up                       # local Postgres in Docker on 127.0.0.1:5433
npm run db:migrate                  # schema + reference data (therapies, clinic profile row)
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='at-least-10-chars' \
  npm run db:create-admin           # first administrator
npm run dev
```

Sign in at `/login`. Admins create staff accounts in the clinic app under Settings > Users and roles.
Parents register at `/register`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | ESLint, `next typegen && tsc`, Vitest unit tests |
| `npm run db:generate` | Generate a SQL migration from `db/schema` changes (review it before committing) |
| `npm run db:migrate` | Apply migrations (uses `DATABASE_URL_UNPOOLED` if set, else `DATABASE_URL`) |
| `npm run db:up` / `db:down` | Start or stop the local Docker database |

## Where things live

- `db/schema/` tables, `db/migrations/` generated SQL (0001 seeds reference data)
- `lib/permissions.ts` the roles matrix as `can(actor, action, resource)` (tested in `lib/permissions.test.ts`)
- `server/` server-only code: auth, session (data access layer), services, Server Actions
- `lib/validation/` Zod schemas shared by forms and Server Actions
- `app/(site)/site.css` and the `@theme` tokens in `app/globals.css` the website design system
- `components/site/` website components (header, footer, journey board, form kit); `components/clinic/` clinic app
- `content/therapies.ts` website copy for the four therapy lines

## Notes

- Authorization is enforced in the service layer on every read and write. `proxy.ts` only redirects
  visitors without a session cookie, and layouts only route people to the right area.
- Cache Components is turned off on purpose (see the comment in `next.config.ts`): Ant Design's
  CSS-in-JS (used in the clinic app and portal) is not compatible with it yet.
- Clinic contact details are never invented: empty fields show "To be confirmed" on the website until
  an admin fills them in under Content > About details.
