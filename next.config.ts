import path from 'path'
import type { NextConfig } from 'next'

/**
 * The marketing site (index/privacy/terms) is served verbatim out of `public/`.
 * It is a live Twilio compliance asset — the legal identity, entity number and
 * contact details on those pages back a Primary Compliance Profile — so it is
 * deliberately NOT ported to React. Next serves `/privacy.html`, `/terms.html`
 * and `/assets/*` from `public/` natively; only `/` needs a rewrite, because
 * Next resolves `/` through the app router rather than the static handler.
 */
const nextConfig: NextConfig = {
  // Pin the trace root. A stray package-lock.json in a parent directory on this
  // machine makes Next infer the wrong workspace root and warn on every build.
  outputFileTracingRoot: path.join(__dirname),

  // The admin is never cached, never indexed, never framed and never leaks its
  // URL in a Referer header. These apply to every response under it, including
  // ones a page forgets to annotate.
  async headers() {
    return [
      {
        source: '/masteradmin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },

  async rewrites() {
    return [{ source: '/', destination: '/index.html' }]
  },
}

export default nextConfig
