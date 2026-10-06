import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/admin/LoginForm'
import { adminConfigured, isAdmin } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false, nocache: true },
}

export default async function AdminLoginPage() {
  // Already in? Don't show a login form to someone who has a session.
  if (await isAdmin()) redirect('/masteradmin')

  return (
    <main className="w narrow adm-login">
      <p className="eyebrow">TCC Solutions Group</p>
      <h1>Admin</h1>

      {adminConfigured() ? (
        <LoginForm />
      ) : (
        // Fails closed and says why, so a missing variable is obvious rather
        // than looking like a broken form.
        <p className="notice" role="alert">
          Admin access is not configured on this deployment. Set ADMIN_TOKEN (at least 32
          characters) and redeploy.
        </p>
      )}
    </main>
  )
}
