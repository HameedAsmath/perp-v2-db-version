import Link from "next/link"

export function AuthLayout({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* top nav */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-semibold">Perp</span>
        <div className="flex gap-2">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm hover:bg-muted"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* centered card */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
          <h1 className="mb-6 text-center text-2xl font-semibold">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
