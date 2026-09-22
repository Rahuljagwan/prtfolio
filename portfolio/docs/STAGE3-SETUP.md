# Stage 3 setup: database, migration, seed, admin

Until `DATABASE_URL` is set, the site runs on the built-in content in `src/content/seed.ts` and `/admin` shows a
"Database not connected" notice. Nothing breaks. Follow these steps to switch on the CMS.

## a) Create the Neon database

1. Go to https://neon.tech and sign up (the free plan is enough).
2. Click **Create project**. Name it `portfolio`, pick the region closest to you (for India: Singapore or Mumbai if offered),
   and keep the default Postgres version.
3. Neon creates a database called `neondb` and a role for you automatically.

## b) Get the two connection strings

On the project dashboard click **Connect**.

| Variable | Which string | How to get it |
|---|---|---|
| `DATABASE_URL` | **Pooled** (host contains `-pooler`) | Leave the "Connection pooling" toggle **on** and copy the string |
| `DIRECT_URL` | **Direct** (no `-pooler`) | Turn the "Connection pooling" toggle **off** and copy the string |

Both must end with `?sslmode=require`.

Now create your local env file:

```bash
cd portfolio
cp .env.example .env
```

Edit `.env` and set:

```
DATABASE_URL="<pooled string>"
DIRECT_URL="<direct string>"
ADMIN_PASSWORD="<a long unique password, 16+ characters>"
AUTH_SECRET="<output of the command below>"
```

Generate `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env` is git-ignored. Never commit it.

## c) Run the migration and the seed

```bash
npm install                 # also runs `prisma generate`
npm run db:migrate          # creates the tables (uses DIRECT_URL)
npm run db:seed             # copies src/content/seed.ts into the database
npm run dev
```

The seed is safe to re-run. It never overwrites edits you made in the admin, because it only fills a table
when that table is empty.

After the seed, the site looks identical, but it is now reading from Postgres.

Open http://localhost:3000/admin and sign in with `ADMIN_PASSWORD`.

**If Prisma fails with "self-signed certificate in certificate chain"** (common on company networks that inspect
HTTPS), tell Node to trust the Windows certificate store for that command:

```bash
NODE_OPTIONS=--use-system-ca npx prisma generate
```

(PowerShell: `$env:NODE_OPTIONS="--use-system-ca"` first.) Do not disable TLS verification.

## Deploying to Vercel

1. Push the repo and import it in Vercel. Set the **Root Directory** to `portfolio`.
2. Add the four environment variables (`DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSWORD`, `AUTH_SECRET`).
3. Run the migration against Neon once from your machine: `npm run db:deploy`, then `npm run db:seed`.
4. Deploy. `postinstall` generates the Prisma client during the build.

## How persistence works

```
Admin form -> POST/PATCH/DELETE /api/admin/...  -> zod validation -> Prisma -> Neon Postgres
                                                                        |
                                                          revalidatePath("/")
                                                                        v
Public page (static)  <-- getPortfolio() reads Postgres on the next request after a save
```

- Every save is validated on the server with zod (unknown fields are rejected).
- Each list table has an integer `order` column. Drag-and-drop rewrites it in one transaction.
- The public page is statically generated for speed. Each successful admin save calls `revalidatePath("/")`,
  so the change appears on the next page load with no redeploy.
- If the database is unreachable, the public page falls back to the seed content instead of showing an error.

## Auth in short

- Single admin. The password is compared in constant time against `ADMIN_PASSWORD`.
- A successful login sets an httpOnly, SameSite=Lax (Secure in production) cookie that carries an expiry
  timestamp signed with `AUTH_SECRET`. It lasts 7 days. Nothing is stored in the database.
- Every admin API route re-checks the cookie, and every write also checks the request `Origin` matches the site (CSRF defence).
- Login attempts are limited per IP. The limiter is in memory, so on serverless hosting it slows guessing per instance
  but is not a global limit. Use a long password.
- Why not NextAuth? For one user and one password it adds providers, adapters and session tables you would never use.
  Switch to it only if you later add more admins or OAuth sign-in.

To sign everyone out at once, change `AUTH_SECRET`.
