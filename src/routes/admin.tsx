import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  adminLogs,
  adminMarkOrder,
  adminOrders,
  adminOverview,
  adminSaveSetting,
  adminSetPlan,
  adminSetRole,
  adminSetTool,
  adminUsers,
  ensureMe,
  type Role,
} from "@/lib/server/app";
import { TOOLS } from "@/lib/tools/registry";
import { formatInr } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: Admin });

type Tab = "overview" | "users" | "orders" | "tools" | "settings" | "audit";

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("overview");
  const [role, setRole] = useState<Role | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    ensureMe()
      .then((me) => {
        const r = me.profile.role;
        setRole(r);
        if (!["super_admin", "admin", "editor", "support"].includes(r)) setForbidden(true);
      })
      .catch(() => setForbidden(true));
  }, [user, isPending]);

  if (isPending) {
    return (
      <AppShell>
        <main className="px-4 py-16">Loading…</main>
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (forbidden) {
    return (
      <AppShell>
        <main className="mx-auto max-w-xl px-4 py-16">
          <h1 className="font-serif text-3xl">Forbidden</h1>
          <p className="mt-2 text-muted-foreground">This area is limited to staff roles.</p>
        </main>
      </AppShell>
    );
  }

  const tabs: Tab[] = ["overview", "users", "orders", "tools", "settings", "audit"];

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-serif text-4xl">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">Role: {role?.replace("_", " ")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button key={t} type="button" variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
              {t}
            </Button>
          ))}
        </div>
        <div className="mt-8">
          {tab === "overview" ? <Overview /> : null}
          {tab === "users" ? <Users role={role} /> : null}
          {tab === "orders" ? <Orders /> : null}
          {tab === "tools" ? <ToolsAdmin /> : null}
          {tab === "settings" ? <SettingsAdmin /> : null}
          {tab === "audit" ? <Audit /> : null}
        </div>
      </main>
    </AppShell>
  );
}

function Overview() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminOverview>> | null>(null);
  useEffect(() => {
    adminOverview().then(setData).catch((err) => toast.error(err.message));
  }, []);
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const empty = data.users === 0 && data.jobsToday === 0;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={String(data.users)} />
        <Stat label="Jobs today" value={String(data.jobsToday)} />
        <Stat label="Jobs this month" value={String(data.jobsMonth)} />
        <Stat label="Failed jobs" value={String(data.failed)} />
        <Stat label="Paid revenue" value={data.revenuePaise ? formatInr(data.revenuePaise) : "No data available yet."} />
        <Stat label="Pending orders" value={String(data.pending)} />
      </div>
      <h2 className="mt-8 font-serif text-2xl">By plan</h2>
      {data.byPlan.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No data available yet.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {data.byPlan.map((p) => (
            <li key={p.plan_id}>
              {p.plan_id}: {p.n}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-8 font-serif text-2xl">Top tools</h2>
      {data.top.length === 0 || empty ? (
        <p className="mt-2 text-sm text-muted-foreground">No data available yet.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm">
          {data.top.map((t) => (
            <li key={t.tool_slug}>
              <Link to="/tools/$slug" params={{ slug: t.tool_slug }} className="hover:underline">
                {t.tool_slug}
              </Link>{" "}
              · {t.n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl tabular-nums">{value}</p>
    </div>
  );
}

function Users({ role }: { role: Role | null }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminUsers>>>([]);
  useEffect(() => {
    adminUsers().then(setRows).catch((err) => toast.error(err.message));
  }, []);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2">User</th>
            <th>Plan</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.user_id} className="border-b border-border">
              <td className="py-2">
                <div>{u.email ?? u.user_id}</div>
              </td>
              <td>
                <select
                  className="h-9 rounded-md border border-input bg-card px-2"
                  defaultValue={u.plan_id}
                  onChange={async (e) => {
                    try {
                      await adminSetPlan({ data: { userId: u.user_id, planId: e.target.value } });
                      toast.success("Plan updated");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <option value="free">free</option>
                  <option value="standard">standard</option>
                  <option value="premium">premium</option>
                </select>
              </td>
              <td>{u.role}</td>
              <td>
                {role === "super_admin" && u.role !== "super_admin" ? (
                  <select
                    className="h-9 rounded-md border border-input bg-card px-2"
                    defaultValue={u.role}
                    onChange={async (e) => {
                      try {
                        await adminSetRole({ data: { userId: u.user_id, role: e.target.value as Role } });
                        toast.success("Role updated");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                  >
                    <option value="user">user</option>
                    <option value="support">support</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="mt-4 text-muted-foreground">No data available yet.</p> : null}
    </div>
  );
}

function Orders() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminOrders>>>([]);
  const load = () => adminOrders().then(setRows).catch((err) => toast.error(err.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2">Order</th>
            <th>Plan</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-border">
              <td className="py-2 font-mono text-xs">{o.id}</td>
              <td>{o.plan_id}</td>
              <td>{formatInr(o.amount_paise)}</td>
              <td>{o.status}</td>
              <td className="space-x-2">
                {o.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await adminMarkOrder({ data: { id: o.id, status: "paid" } });
                        toast.success("Marked paid");
                        load();
                      }}
                    >
                      Mark paid
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await adminMarkOrder({ data: { id: o.id, status: "failed" } });
                        load();
                      }}
                    >
                      Fail
                    </Button>
                  </>
                ) : o.status === "paid" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await adminMarkOrder({ data: { id: o.id, status: "refunded" } });
                      load();
                    }}
                  >
                    Refund
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="mt-4 text-muted-foreground">No data available yet.</p> : null}
    </div>
  );
}

function ToolsAdmin() {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {TOOLS.map((t) => (
        <li key={t.slug} className="flex items-center justify-between px-4 py-3 text-sm">
          <span>
            {t.name} <span className="text-muted-foreground">/{t.slug}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await adminSetTool({ data: { slug: t.slug, enabled: false } });
              toast.success(`${t.name} disabled`);
            }}
          >
            Disable
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SettingsAdmin() {
  const [ads, setAds] = useState(false);
  const [seo, setSeo] = useState(true);
  return (
    <div className="max-w-lg space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} />
        Enable labeled advertisements
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={seo} onChange={(e) => setSeo(e.target.checked)} />
        SEO tools enabled
      </label>
      <Button
        type="button"
        onClick={async () => {
          await adminSaveSetting({ data: { key: "ads_enabled", value: ads } });
          await adminSaveSetting({ data: { key: "seo_tools_enabled", value: seo } });
          toast.success("Settings saved");
        }}
      >
        Save settings
      </Button>
      <p className="text-sm text-muted-foreground">
        Rewarded ads require a dedicated provider and server-side receipts. Ordinary AdSense is never used as a
        reward. Stripe and Razorpay keys are not stored in this preview.
      </p>
      <Textarea readOnly value="AdSense client ID is stored in settings when provided by the operator." />
    </div>
  );
}

function Audit() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminLogs>>>([]);
  useEffect(() => {
    adminLogs().then(setRows).catch((err) => toast.error(err.message));
  }, []);
  if (!rows.length) return <p className="text-muted-foreground">No data available yet.</p>;
  return (
    <ul className="space-y-2 font-mono text-xs">
      {rows.map((r) => (
        <li key={r.id} className="rounded-md border border-border px-3 py-2">
          {r.created_at} · {r.action} · {r.detail}
        </li>
      ))}
    </ul>
  );
}
