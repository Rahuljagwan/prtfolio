# Deploying to Vercel (checklist)

## 1. Before you deploy (once, from your machine)

1. Create the Neon project and copy both connection strings (see STAGE3-SETUP.md, sections a and b).
2. Put them in a local `.env` (never committed) along with `ADMIN_PASSWORD` and `AUTH_SECRET`.
3. Create the tables and load your content:
   ```bash
   cd portfolio
   npm install
   npm run db:deploy     # prisma migrate deploy: applies prisma/migrations to Neon (uses DIRECT_URL)
   npm run db:seed       # copies src/content/seed.ts into Neon (safe to re-run)
   ```
4. Commit everything, including `prisma/migrations/`. Do not commit `.env`.

## 2. Vercel project settings

| Setting | Value |
|---|---|
| Framework preset | Next.js (auto-detected) |
| **Root Directory** | `portfolio` (the app is in a subfolder) |
| Install command | default (`npm install`). Its `postinstall` runs `prisma generate` |
| **Build command** | default `next build` |
| Output directory | default |
| Node.js version | 20.x or newer |

Optional: to apply migrations automatically on every deploy, set the build command to
`prisma migrate deploy && next build`. This needs `DIRECT_URL` at build time and fails the build if a migration fails.
The manual step in section 1 is simpler for a personal site.

## 3. Environment variables (Project > Settings > Environment Variables)

Set all four for **Production** (and **Preview** if you want preview deployments to work; see the note below).

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** string (host contains `-pooler`), ends with `?sslmode=require` | Used by the running site |
| `DIRECT_URL` | Neon **direct** string (no `-pooler`), ends with `?sslmode=require` | Used only by `prisma migrate` |
| `ADMIN_PASSWORD` | A long unique password (16+ characters) | The `/admin` login |
| `AUTH_SECRET` | 64 random hex characters | Signs the admin session cookie. Changing it logs everyone out |

Generate the secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 4. How the database connects in production

```
Vercel serverless function --(DATABASE_URL, pooled, TLS)--> Neon pooler (PgBouncer) --> Neon Postgres
Your laptop / CI: prisma migrate --(DIRECT_URL, direct, TLS)--> Neon Postgres
```

- Serverless functions open many short connections, so runtime traffic goes through Neon's **pooler**.
  Prisma Migrate cannot use a pooler, so it uses the **direct** URL. That is why there are two variables
  ([Neon and Prisma guide](https://neon.com/docs/guides/prisma)).
- Prisma reads `DATABASE_URL` for the client and `DIRECT_URL` for migrations, as set in `prisma/schema.prisma`.
- Neon's free plan suspends an idle database and wakes it on the next request. The first connection after a long idle
  can take about 5 seconds (measured), which is Prisma's default connect timeout, so it used to fail with
  "Can't reach database server". The client now waits up to 15 seconds (`connect_timeout`, added in `src/lib/db.ts`;
  put your own `connect_timeout` in `DATABASE_URL` to override it). Public pages are pre-built, so visitors are not affected.
- If the database really is unreachable (for example a network that blocks port 5432), the site serves its built-in
  content, logs one line instead of a stack trace, and skips the database for 30 seconds so pages are not slowed down.
- Pick the Vercel function region closest to your Neon region (Project > Settings > Functions).

## 5. First deploy: verify

1. Open the site. It should look identical to local.
2. Go to `/admin`, sign in, change something small (for example the availability text), save, and reload the public
   page. If the change shows up, the database and cache refresh are working.
3. **Why step 2 matters:** the public page is pre-built at deploy time. If `DATABASE_URL` is missing or wrong during
   the build, the site quietly falls back to the built-in seed content instead of failing. An admin save
   also refreshes the page, so the check above catches this.
4. In `/admin`, replace the placeholders under **Contact links**: email, phone, WhatsApp (with country code, for
   example `+91-9876543210`), LinkedIn and GitHub. The WhatsApp QR code is generated from that number.
5. Check Lighthouse on the live URL, and the `/?lite` view if you want to compare with the static hero.

## 6. Gotchas

- **Preview deployments** use the same variables. If they point at your production database, edits made from a
  preview change live content. Either give Preview its own Neon branch (Neon has database branching) or leave
  `ADMIN_PASSWORD` unset for Preview so `/admin` stays disabled there.
- **`.env` is ignored by git**, so Vercel only sees what you set in its dashboard.
- **Login rate limiting** is per serverless instance (in memory). It slows guessing but is not a global limit,
  so use a long password.
- **Rotating secrets:** change `ADMIN_PASSWORD` or `AUTH_SECRET` in Vercel, then redeploy.
- **Schema changes later:** edit `prisma/schema.prisma`, run `npm run db:migrate` locally, commit the new migration
  folder, then run `npm run db:deploy` against Neon before (or as part of) the next deploy.
