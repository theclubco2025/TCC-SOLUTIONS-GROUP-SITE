/**
 * Partner slug rules for TCCSG referral links: tccsolutionsgroup.com/{slug}/analyze
 *
 * Adapted from PlateHaven's `lib/tenant-slug.ts` and rewritten for TCCSG's own
 * reserved namespace — copied rather than imported, because the two products do
 * not share code and their reserved words are not the same. PlateHaven reserves
 * restaurant routes; TCCSG reserves its marketing pages and its own brands.
 *
 * Kept dependency-free so it runs in middleware (edge) as well as on the server.
 */

/** Slugs a stranger must never be able to claim. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // framework / app routes
  'api', 'app', '_next', 'static', 'public', 'assets', 'favicon', 'robots',
  'sitemap', 'health',
  // existing marketing pages — these are real files in public/
  'index.html', 'privacy.html', 'terms.html', 'index', 'privacy', 'terms',
  // routes this system owns or will own
  'partners', 'partner', 'analyze', 'admin', 'auth', 'login', 'logout',
  'signup', 'register', 'dashboard', 'leads', 'opportunities', 'commissions',
  'referrals', 'sales', 'reports',
  // brand / company terms
  'tccsg', 'tcc', 'tccsolutionsgroup', 'platehaven', 'navitap', 'www', 'mail',
  'email', 'support', 'help', 'about', 'contact', 'pricing', 'blog', 'status',
  'legal', 'careers',
])

const MAX_SLUG_LENGTH = 40

/** Shape a slug must match to be worth a database lookup at all. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

export function slugify(name: string): string {
  const base = String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics -> dash
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .replace(/-{2,}/g, '-') // collapse repeats
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '') // re-trim if the slice left a trailing dash

  return base || 'partner'
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}

/**
 * True when a path segment could plausibly be a partner slug. Used by
 * middleware, which has no database access, to avoid issuing an attribution
 * cookie for requests that are obviously not referral links.
 */
export function couldBePartnerSlug(segment: string): boolean {
  const s = segment.toLowerCase()
  return SLUG_PATTERN.test(s) && !isReservedSlug(s)
}

/**
 * Produce a unique, non-reserved slug. `exists` reports whether a candidate is
 * already taken. Reserved bases and collisions get a numeric suffix:
 * el-dorado -> el-dorado-2 -> el-dorado-3 ...
 */
export async function generateUniquePartnerSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name)

  const candidate = (n: number) => {
    const suffix = n <= 1 ? '' : `-${n}`
    const trimmed = base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/g, '')
    return `${trimmed}${suffix}`
  }

  for (let n = 1; n < 200; n++) {
    const slug = candidate(n)
    if (isReservedSlug(slug)) continue
    if (await exists(slug)) continue
    return slug
  }

  // Effectively unreachable, but never return a colliding slug.
  return `${base.slice(0, 30)}-${Date.now().toString(36)}`
}
