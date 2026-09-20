import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { deleteMe, ensureMe, exportMe, listMyOrders, type Role } from "@/lib/server/app";
import { formatInr } from "@/lib/utils";
import { downloadBlob } from "@/lib/utils";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Awaited<ReturnType<typeof ensureMe>> | null>(null);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listMyOrders>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    Promise.all([ensureMe(), listMyOrders()])
      .then(([a, b]) => {
        setMe(a);
        setOrders(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load account"));
  }, [user, isPending]);

  if (isPending) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 py-16">Loading account…</main>
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const isStaff = me && ["super_admin", "admin", "editor", "support"].includes(me.profile.role);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl">Account</h1>
        <p className="mt-2 text-muted-foreground">{user.primaryEmail ?? user.displayName}</p>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        {me ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card title="Plan" value={me.plan.name} />
            <Card title="Role" value={labelRole(me.profile.role)} />
            <Card
              title="Allowance left"
              value={me.check.limit === null ? "Unlimited in this window" : `${me.check.remaining} remaining`}
            />
            <Card title="Used today" value={String(me.usage.dailyUsed)} />
            <Card title="Used this month" value={String(me.usage.monthlyUsed)} />
            <Card title="Period used" value={String(me.usage.periodUsed)} />
          </section>
        ) : (
          <p className="mt-8 text-muted-foreground">No data available yet.</p>
        )}
        {me?.subscription ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Subscription {me.subscription.status}
            {me.subscription.period_end ? ` · ends ${me.subscription.period_end}` : ""}
          </p>
        ) : null}

        {isStaff ? (
          <Button asChild className="mt-6">
            <Link to="/admin">Open admin</Link>
          </Button>
        ) : null}

        <h2 className="mt-12 font-serif text-2xl">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No data available yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-mono text-xs">{o.id}</span>
                <span>{o.plan_id}</span>
                <span>{formatInr(o.amount_paise)}</span>
                <span className="capitalize">{o.status}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const data = await exportMe();
              downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "anvil-export.json");
            }}
          >
            Export my data
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (!confirm("Delete account data? This cannot be undone.")) return;
              try {
                await deleteMe();
                toast.success("Account data removed. Sign out to finish.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not delete");
              }
            }}
          >
            Delete account data
          </Button>
        </div>
      </main>
    </AppShell>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg">{value}</p>
    </div>
  );
}

function labelRole(role: Role) {
  return role.replace("_", " ");
}
