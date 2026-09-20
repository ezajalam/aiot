import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";
import { checkLimits, type PlanLimits } from "@/lib/billing/limits";
import { localDay, localMonth } from "@/lib/utils";

export type Role = "super_admin" | "admin" | "editor" | "support" | "user";

export type Profile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  plan_id: string;
  created_at: string;
};

type PlanRow = {
  id: string;
  name: string;
  price_paise: number;
  interval_days: number | null;
  daily_limit: number | null;
  monthly_limit: number | null;
  period_limit: number | null;
  ad_free: boolean;
  blurb: string;
  is_public: boolean;
};

function asPlan(row: PlanRow): PlanLimits {
  return {
    id: row.id,
    name: row.name,
    dailyLimit: row.daily_limit,
    monthlyLimit: row.monthly_limit,
    periodLimit: row.period_limit,
    adFree: row.ad_free,
    pricePaise: row.price_paise,
    intervalDays: row.interval_days,
  };
}

async function loadPlan(sql: Awaited<ReturnType<typeof getSql>>, planId: string): Promise<PlanRow> {
  const rows = await sql<PlanRow>`select * from plans where id = ${planId} limit 1`;
  const row = rows[0];
  if (!row) throw new Error("Plan not found");
  return row;
}

async function ensureProfileRow(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  email: string | null,
): Promise<Profile> {
  const existing = await sql<Profile>`select user_id, email, display_name, role, plan_id, created_at from profiles where user_id = ${userId} limit 1`;
  if (existing[0]) return existing[0];
  const supers = await sql<{ n: number }>`select count(*)::int as n from profiles where role = 'super_admin'`;
  const role: Role = (supers[0]?.n ?? 0) === 0 ? "super_admin" : "user";
  try {
    await sql`insert into profiles (user_id, email, role, plan_id) values (${userId}, ${email}, ${role}, 'free')`;
  } catch {
    await sql`insert into profiles (user_id, email, role, plan_id) values (${userId}, ${email}, 'user', 'free')`;
  }
  const created = await sql<Profile>`select user_id, email, display_name, role, plan_id, created_at from profiles where user_id = ${userId} limit 1`;
  return created[0]!;
}

async function usedFor(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  bucket: string,
): Promise<number> {
  const rows = await sql<{ used: number }>`select used from usage_counters where subject_type = 'user' and subject_id = ${userId} and bucket = ${bucket}`;
  return rows[0]?.used ?? 0;
}

async function bump(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  bucket: string,
  limit: number | null,
): Promise<boolean> {
  if (limit === null) {
    await sql`
      insert into usage_counters (subject_type, subject_id, bucket, used)
      values ('user', ${userId}, ${bucket}, 1)
      on conflict (subject_type, subject_id, bucket)
      do update set used = usage_counters.used + 1
    `;
    return true;
  }
  const rows = await sql<{ used: number }>`
    insert into usage_counters (subject_type, subject_id, bucket, used)
    values ('user', ${userId}, ${bucket}, 1)
    on conflict (subject_type, subject_id, bucket)
    do update set used = usage_counters.used + 1
    where usage_counters.used < ${limit}
    returning used
  `;
  return Boolean(rows[0]);
}

async function dropOne(sql: Awaited<ReturnType<typeof getSql>>, userId: string, bucket: string) {
  await sql`
    update usage_counters
    set used = greatest(used - 1, 0)
    where subject_type = 'user' and subject_id = ${userId} and bucket = ${bucket}
  `;
}

function staff(role: Role) {
  return role === "super_admin" || role === "admin" || role === "editor" || role === "support";
}

function adminish(role: Role) {
  return role === "super_admin" || role === "admin";
}

export const getPublicState = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const settingsRows = await sql<{ key: string; value: string }>`select key, value from settings`;
  const settings: Record<string, string | number | boolean | null> = {};
  for (const row of settingsRows) {
    try {
      settings[row.key] = JSON.parse(row.value) as string | number | boolean | null;
    } catch {
      settings[row.key] = row.value;
    }
  }
  const overrides = await sql<{ slug: string; enabled: boolean; featured: boolean; homepage: boolean }>`select slug, enabled, featured, homepage from tool_overrides`;
  const plans = await sql<PlanRow>`select * from plans where is_public = true order by sort_order`;
  const faqs = await sql<{ id: number; question: string; answer: string }>`select id, question, answer from faqs where tool_slug is null order by sort_order, id`;
  const pages = await sql<{ slug: string; title: string; kind: string }>`select slug, title, kind from cms_pages where status = 'published'`;
  return { settings, overrides, plans, faqs, pages };
});

export const getCmsPage = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await getSql();
    const rows = await sql<{
      slug: string;
      title: string;
      body: string;
      meta_title: string | null;
      meta_description: string | null;
      kind: string;
      noindex: boolean;
    }>`select slug, title, body, meta_title, meta_description, kind, noindex from cms_pages where slug = ${slug} and status = 'published' limit 1`;
    return rows[0] ?? null;
  });

export const listBlog = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return sql<{ slug: string; title: string; meta_description: string | null; published_at: string }>`
    select slug, title, meta_description, published_at
    from cms_pages
    where kind = 'blog' and status = 'published'
    order by published_at desc
  `;
});

export const ensureMe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const session = await getSessionUser();
    const profile = await ensureProfileRow(sql, context.userId, session?.email ?? null);
    const plan = await loadPlan(sql, profile.plan_id);
    const sub = await sql<{
      id: string;
      status: string;
      period_end: string | null;
      plan_id: string;
    }>`select id, status, period_end, plan_id from subscriptions where user_id = ${context.userId} order by created_at desc limit 1`;
    const active = sub[0];
    if (active && active.status === "active" && active.period_end && new Date(active.period_end) < new Date()) {
      await sql`update subscriptions set status = 'expired' where id = ${active.id}`;
      await sql`update profiles set plan_id = 'free' where user_id = ${context.userId}`;
      profile.plan_id = "free";
    }
    const day = `daily:${localDay()}`;
    const month = `monthly:${localMonth()}`;
    const period = active?.id ? `period:${active.id}` : `monthly:${localMonth()}`;
    const usage = {
      dailyUsed: await usedFor(sql, context.userId, day),
      monthlyUsed: await usedFor(sql, context.userId, month),
      periodUsed: await usedFor(sql, context.userId, period),
    };
    const limits = asPlan(plan);
    const check = checkLimits(limits, usage);
    return { profile, plan, usage, check, subscription: active ?? null };
  });

export const reserveUsage = createServerFn({ method: "POST" })
  .validator((slug: string) => slug)
  .middleware([authMiddleware])
  .handler(async ({ context, data: slug }) => {
    const sql = await getSql();
    const profile = await ensureProfileRow(sql, context.userId, null);
    const plan = await loadPlan(sql, profile.plan_id);
    const sub = await sql<{ id: string; status: string; period_end: string | null }>`
      select id, status, period_end from subscriptions
      where user_id = ${context.userId} and status = 'active'
      order by created_at desc limit 1
    `;
    const active = sub[0];
    if (active?.period_end && new Date(active.period_end) < new Date()) {
      await sql`update subscriptions set status = 'expired' where id = ${active.id}`;
      await sql`update profiles set plan_id = 'free' where user_id = ${context.userId}`;
      throw new Error("Your subscription has expired.");
    }
    const limits = asPlan(plan);
    const day = `daily:${localDay()}`;
    const month = `monthly:${localMonth()}`;
    const period = active?.id ? `period:${active.id}` : month;
    const before = {
      dailyUsed: await usedFor(sql, context.userId, day),
      monthlyUsed: await usedFor(sql, context.userId, month),
      periodUsed: await usedFor(sql, context.userId, period),
    };
    const gate = checkLimits(limits, before);
    if (!gate.allowed) {
      throw new Error(
        gate.reason === "daily"
          ? "Daily limit reached. Upgrade for more uses."
          : gate.reason === "monthly"
            ? "Monthly limit reached. Upgrade for more uses."
            : "Subscription period limit reached.",
      );
    }
    const okDay = await bump(sql, context.userId, day, limits.dailyLimit);
    if (!okDay) throw new Error("Daily limit reached. Upgrade for more uses.");
    const okMonth = await bump(sql, context.userId, month, limits.monthlyLimit);
    if (!okMonth) {
      await dropOne(sql, context.userId, day);
      throw new Error("Monthly limit reached. Upgrade for more uses.");
    }
    const okPeriod = await bump(sql, context.userId, period, limits.periodLimit);
    if (!okPeriod) {
      await dropOne(sql, context.userId, day);
      await dropOne(sql, context.userId, month);
      throw new Error("Subscription period limit reached.");
    }
    const event = await sql<{ id: number }>`
      insert into usage_events (subject_type, subject_id, tool_slug, status)
      values ('user', ${context.userId}, ${slug}, 'reserved')
      returning id
    `;
    return { eventId: event[0]!.id, remaining: Math.max(0, gate.remaining - 1) };
  });

export const finishUsage = createServerFn({ method: "POST" })
  .validator((input: { eventId: number; ok: boolean }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number; status: string }>`
      select id, status from usage_events
      where id = ${data.eventId} and subject_id = ${context.userId}
      limit 1
    `;
    const ev = rows[0];
    if (!ev) return;
    if (data.ok) {
      await sql`update usage_events set status = 'completed' where id = ${ev.id}`;
      return;
    }
    await sql`update usage_events set status = 'rolled_back' where id = ${ev.id}`;
    const day = `daily:${localDay()}`;
    const month = `monthly:${localMonth()}`;
    await dropOne(sql, context.userId, day);
    await dropOne(sql, context.userId, month);
    const sub = await sql<{ id: string }>`
      select id from subscriptions where user_id = ${context.userId} and status = 'active' order by created_at desc limit 1
    `;
    if (sub[0]) await dropOne(sql, context.userId, `period:${sub[0].id}`);
    else await dropOne(sql, context.userId, month);
  });

export const createOrder = createServerFn({ method: "POST" })
  .validator((input: { planId: string; coupon?: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const plan = await loadPlan(sql, data.planId);
    if (plan.price_paise <= 0) throw new Error("That plan does not require payment");
    let amount = plan.price_paise;
    let couponCode: string | null = null;
    if (data.coupon) {
      const code = data.coupon.trim().toUpperCase();
      const coupons = await sql<{
        code: string;
        percent_off: number | null;
        amount_off_paise: number | null;
        active: boolean;
        max_redemptions: number | null;
        redeemed: number;
      }>`select * from coupons where code = ${code} limit 1`;
      const c = coupons[0];
      if (!c || !c.active) throw new Error("Coupon is not valid");
      if (c.max_redemptions !== null && c.redeemed >= c.max_redemptions) throw new Error("Coupon is exhausted");
      if (c.percent_off) amount = Math.round(amount * (1 - c.percent_off / 100));
      if (c.amount_off_paise) amount = Math.max(0, amount - c.amount_off_paise);
      couponCode = c.code;
      await sql`update coupons set redeemed = redeemed + 1 where code = ${c.code}`;
    }
    const id = `ord_${crypto.randomUUID()}`;
    await sql`
      insert into orders (id, user_id, plan_id, amount_paise, currency, status, provider, coupon_code, note)
      values (${id}, ${context.userId}, ${plan.id}, ${amount}, 'INR', 'pending', 'manual', ${couponCode}, 'Manual / UPI — awaiting verification')
    `;
    await sql`insert into audit_logs (user_id, action, detail) values (${context.userId}, 'order.create', ${id})`;
    return { id, amount, planId: plan.id, status: "pending" as const };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      plan_id: string;
      amount_paise: number;
      status: string;
      provider: string;
      created_at: string;
    }>`select id, plan_id, amount_paise, status, provider, created_at from orders where user_id = ${context.userId} order by created_at desc`;
  });

export const exportMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await sql<{
      user_id: string;
      email: string | null;
      display_name: string | null;
      role: string;
      plan_id: string;
    }>`select user_id, email, display_name, role, plan_id from profiles where user_id = ${context.userId}`;
    const usage = await sql<{ id: number; tool_slug: string; status: string; created_at: string }>`
      select id, tool_slug, status, created_at from usage_events where subject_id = ${context.userId} order by created_at desc limit 500
    `;
    const orders = await sql<{ id: string; plan_id: string; amount_paise: number; status: string; created_at: string }>`
      select id, plan_id, amount_paise, status, created_at from orders where user_id = ${context.userId}
    `;
    const subs = await sql<{ id: string; plan_id: string; status: string; period_end: string | null }>`
      select id, plan_id, status, period_end from subscriptions where user_id = ${context.userId}
    `;
    return { profile: profile[0] ?? null, usage, orders, subscriptions: subs };
  });

export const deleteMe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await sql<Profile>`select * from profiles where user_id = ${context.userId}`;
    if (me[0]?.role === "super_admin") {
      throw new Error("The Super Admin account cannot be deleted. Transfer the role first.");
    }
    await sql`delete from usage_events where subject_id = ${context.userId}`;
    await sql`delete from usage_counters where subject_id = ${context.userId}`;
    await sql`delete from orders where user_id = ${context.userId}`;
    await sql`delete from subscriptions where user_id = ${context.userId}`;
    await sql`update profiles set deleted_at = now(), email = null, display_name = null, plan_id = 'free' where user_id = ${context.userId}`;
    await sql`insert into audit_logs (user_id, action, detail) values (${context.userId}, 'account.delete', ${context.userId})`;
    return { ok: true };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!staff(me.role)) throw new Error("Forbidden");
    const users = await sql<{ n: number }>`select count(*)::int as n from profiles where deleted_at is null`;
    const byPlan = await sql<{ plan_id: string; n: number }>`
      select plan_id, count(*)::int as n from profiles where deleted_at is null group by plan_id
    `;
    const jobsToday = await sql<{ n: number }>`
      select count(*)::int as n from usage_events where created_at >= current_date and status = 'completed'
    `;
    const jobsMonth = await sql<{ n: number }>`
      select count(*)::int as n from usage_events
      where created_at >= date_trunc('month', now()) and status = 'completed'
    `;
    const failed = await sql<{ n: number }>`select count(*)::int as n from usage_events where status = 'rolled_back'`;
    const revenue = await sql<{ n: number }>`
      select coalesce(sum(amount_paise), 0)::int as n from orders where status = 'paid'
    `;
    const top = await sql<{ tool_slug: string; n: number }>`
      select tool_slug, count(*)::int as n from usage_events
      where status = 'completed'
      group by tool_slug order by n desc limit 8
    `;
    const pending = await sql<{ n: number }>`select count(*)::int as n from orders where status = 'pending'`;
    return {
      users: users[0]?.n ?? 0,
      byPlan,
      jobsToday: jobsToday[0]?.n ?? 0,
      jobsMonth: jobsMonth[0]?.n ?? 0,
      failed: failed[0]?.n ?? 0,
      revenuePaise: revenue[0]?.n ?? 0,
      top,
      pending: pending[0]?.n ?? 0,
      role: me.role,
    };
  });

export const adminUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!staff(me.role)) throw new Error("Forbidden");
    return sql<Profile>`select user_id, email, display_name, role, plan_id, created_at from profiles where deleted_at is null order by created_at desc limit 200`;
  });

export const adminSetPlan = createServerFn({ method: "POST" })
  .validator((input: { userId: string; planId: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!adminish(me.role)) throw new Error("Forbidden");
    await loadPlan(sql, data.planId);
    await sql`update profiles set plan_id = ${data.planId} where user_id = ${data.userId}`;
    if (data.planId === "standard" || data.planId === "premium") {
      const id = `sub_${crypto.randomUUID()}`;
      const end = new Date();
      end.setDate(end.getDate() + 30);
      await sql`
        insert into subscriptions (id, user_id, plan_id, status, period_start, period_end, provider)
        values (${id}, ${data.userId}, ${data.planId}, 'active', now(), ${end.toISOString()}, 'manual')
      `;
    }
    await sql`insert into audit_logs (user_id, action, detail) values (${context.userId}, 'plan.assign', ${`${data.userId}:${data.planId}`})`;
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .validator((input: { userId: string; role: Role }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (me.role !== "super_admin") throw new Error("Only Super Admin can change roles");
    if (data.role === "super_admin") {
      throw new Error("Super Admin is unique. Transfer is not implemented as a second Super Admin.");
    }
    const target = await sql<Profile>`select * from profiles where user_id = ${data.userId}`;
    if (target[0]?.role === "super_admin") throw new Error("Cannot demote the Super Admin here.");
    await sql`update profiles set role = ${data.role} where user_id = ${data.userId}`;
    await sql`insert into audit_logs (user_id, action, detail) values (${context.userId}, 'role.set', ${`${data.userId}:${data.role}`})`;
    return { ok: true };
  });

export const adminOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!adminish(me.role) && me.role !== "support") throw new Error("Forbidden");
    return sql<{
      id: string;
      user_id: string;
      plan_id: string;
      amount_paise: number;
      status: string;
      created_at: string;
    }>`select id, user_id, plan_id, amount_paise, status, created_at from orders order by created_at desc limit 200`;
  });

export const adminMarkOrder = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: "paid" | "failed" | "refunded" | "cancelled" }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!adminish(me.role)) throw new Error("Forbidden");
    const rows = await sql<{ id: string; user_id: string; plan_id: string; status: string }>`
      select id, user_id, plan_id, status from orders where id = ${data.id} limit 1
    `;
    const order = rows[0];
    if (!order) throw new Error("Order not found");
    await sql`update orders set status = ${data.status} where id = ${data.id}`;
    if (data.status === "paid") {
      const plan = await loadPlan(sql, order.plan_id);
      const end = new Date();
      end.setDate(end.getDate() + (plan.interval_days ?? 30));
      const sid = `sub_${crypto.randomUUID()}`;
      await sql`
        insert into subscriptions (id, user_id, plan_id, status, period_start, period_end, provider, provider_ref)
        values (${sid}, ${order.user_id}, ${order.plan_id}, 'active', now(), ${end.toISOString()}, 'manual', ${order.id})
      `;
      await sql`update profiles set plan_id = ${order.plan_id} where user_id = ${order.user_id}`;
    }
    if (data.status === "refunded" || data.status === "cancelled") {
      await sql`update subscriptions set status = ${data.status} where provider_ref = ${order.id}`;
      await sql`update profiles set plan_id = 'free' where user_id = ${order.user_id}`;
    }
    await sql`insert into audit_logs (user_id, action, detail) values (${context.userId}, 'order.status', ${`${data.id}:${data.status}`})`;
    return { ok: true };
  });

export const adminSaveSetting = createServerFn({ method: "POST" })
  .validator((input: { key: string; value: unknown }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!adminish(me.role)) throw new Error("Forbidden");
    const value = JSON.stringify(data.value);
    await sql`
      insert into settings (key, value) values (${data.key}, ${value})
      on conflict (key) do update set value = excluded.value
    `;
    await sql`insert into audit_logs (user_id, action, detail) values (${context.userId}, 'settings.set', ${data.key})`;
    return { ok: true };
  });

export const adminSetTool = createServerFn({ method: "POST" })
  .validator((input: { slug: string; enabled: boolean }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!adminish(me.role) && me.role !== "editor") throw new Error("Forbidden");
    await sql`
      insert into tool_overrides (slug, enabled) values (${data.slug}, ${data.enabled})
      on conflict (slug) do update set enabled = excluded.enabled
    `;
    return { ok: true };
  });

export const adminSavePage = createServerFn({ method: "POST" })
  .validator((input: { slug: string; title: string; body: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!adminish(me.role) && me.role !== "editor") throw new Error("Forbidden");
    await sql`
      insert into cms_pages (slug, title, body, status, kind)
      values (${data.slug}, ${data.title}, ${data.body}, 'published', 'page')
      on conflict (slug) do update set title = excluded.title, body = excluded.body, updated_at = now()
    `;
    return { ok: true };
  });

export const adminLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (!adminish(me.role)) throw new Error("Forbidden");
    return sql<{ id: number; user_id: string | null; action: string; detail: string | null; created_at: string }>`
      select id, user_id, action, detail, created_at from audit_logs order by created_at desc limit 100
    `;
  });

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      daily_limit: number | null;
      monthly_limit: number | null;
      period_limit: number | null;
      price_paise: number;
      ad_free: boolean;
    }) => input,
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await ensureProfileRow(sql, context.userId, null);
    if (me.role !== "super_admin") throw new Error("Only Super Admin can edit plans");
    await sql`
      update plans
      set daily_limit = ${data.daily_limit},
          monthly_limit = ${data.monthly_limit},
          period_limit = ${data.period_limit},
          price_paise = ${data.price_paise},
          ad_free = ${data.ad_free}
      where id = ${data.id}
    `;
    return { ok: true };
  });
