import { spawnSync } from 'node:child_process'

/**
 * Applies pending migrations during the Vercel build, where DATABASE_URL and
 * DATABASE_URL_UNPOOLED already exist.
 *
 * Migrations run here rather than from a laptop on purpose: Vercel will not
 * reveal production secrets to `vercel env pull`, so the alternative is a
 * database password pasted into someone's terminal. This way the credential
 * never leaves Vercel.
 *
 * With no DATABASE_URL (local development, demo mode) it skips instead of
 * failing, so `npm run build` still works on a machine with no database.
 */

if (!process.env.DATABASE_URL) {
  console.log('[migrate] No DATABASE_URL — skipping migrations (demo mode).')
  process.exit(0)
}

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.warn(
    '[migrate] DATABASE_URL_UNPOOLED is not set. Prisma will try to migrate over the pooled connection, which usually fails.',
  )
}

console.log('[migrate] Applying migrations...')
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

// Fail the build rather than shipping an app whose tables do not exist. A
// failed deploy leaves the previous one serving; a half-migrated one does not.
process.exit(result.status ?? 1)
