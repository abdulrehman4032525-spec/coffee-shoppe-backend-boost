import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Coffee Shoppe — Backend API" },
      { name: "description", content: "Backend API and admin dashboard for the Coffee Shoppe website." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Index() {
  const endpoints = [
    { method: "POST", path: "/api/public/reservations", body: '{ name, email, phone, date: "YYYY-MM-DD", time: "HH:MM", partySize, specialRequests? }' },
    { method: "POST", path: "/api/public/contact", body: "{ name, email, message }" },
    { method: "POST", path: "/api/public/newsletter", body: "{ email }" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Coffee Shoppe</p>
          <h1 className="text-4xl font-semibold mt-2">Backend Service</h1>
          <p className="mt-3 text-muted-foreground">
            Public REST endpoints for the Coffee Shoppe Next.js site, plus an admin dashboard for
            reservations, messages, and newsletter subscribers.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-widest text-primary mb-4">Public Endpoints (CORS *)</h2>
          <div className="space-y-3">
            {endpoints.map((e) => (
              <div key={e.path} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary text-primary-foreground">
                    {e.method}
                  </span>
                  <code className="text-sm">{e.path}</code>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-mono">{e.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-widest text-primary mb-4">Admin</h2>
          <Link
            to="/admin"
            className="inline-block px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
          >
            Open Admin Dashboard →
          </Link>
        </section>
      </main>
    </div>
  );
}
