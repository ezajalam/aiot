import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/utils";
import { createOrder, getPublicState } from "@/lib/server/app";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";

export const Route = createFileRoute("/pricing")({
  loader: () => getPublicState(),
  component: Pricing,
});

function Pricing() {
  const data = Route.useLoaderData();
  const plans = data.plans.filter((p) => p.id !== "guest");
  const { user, isPending } = useCurrentUserState();
  const [coupon, setCoupon] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  async function checkout(planId: string) {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setPendingPlan(planId);
    try {
      const order = await createOrder({ data: { planId, coupon: coupon || undefined } });
      toast.success(`Order ${order.id} is pending verification.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setPendingPlan(null);
    }
  }

  if (isPending) {
    return (
      <AppShell>
        <main className="mx-auto max-w-6xl px-4 py-16">Loading…</main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-4xl">Pricing</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Paid plans are not activated from a browser redirect. Checkout creates a pending manual / UPI order.
          An administrator marks it paid after funds arrive.
        </p>
        <div className="mt-6 max-w-xs">
          <Input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon (optional)" />
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <article key={p.id} className="flex flex-col rounded-xl border border-border bg-card p-6">
              <h2 className="font-serif text-3xl">{p.name}</h2>
              <p className="mt-2 font-serif text-4xl">{formatInr(p.price_paise)}</p>
              <p className="mt-3 text-sm text-muted-foreground">{p.blurb}</p>
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                {p.daily_limit ? <li>{p.daily_limit} uses per day</li> : <li>No daily cap</li>}
                {p.monthly_limit ? <li>{p.monthly_limit} uses per calendar month</li> : null}
                {p.period_limit ? <li>{p.period_limit.toLocaleString("en-IN")} uses per billing period</li> : null}
                {p.ad_free ? <li>Advertisements off</li> : <li>May show labeled ads</li>}
              </ul>
              {p.price_paise > 0 ? (
                <Button className="mt-6" disabled={pendingPlan === p.id} onClick={() => checkout(p.id)}>
                  {pendingPlan === p.id ? "Creating order…" : "Request upgrade"}
                </Button>
              ) : (
                <Button asChild className="mt-6" variant="outline">
                  <Link to={user ? "/account" : "/login"}>{user ? "Current free plan" : "Create account"}</Link>
                </Button>
              )}
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Try coupon <span className="font-mono">WELCOME10</span> for 10% off. Stripe and Razorpay adapters are
          architected; this preview uses manual verification so a redirect cannot grant a plan.
        </p>
      </main>
    </AppShell>
  );
}

void RedirectToSignIn;
