export type PlanLimits = {
  id: string;
  name: string;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  periodLimit: number | null;
  adFree: boolean;
  pricePaise: number;
  intervalDays: number | null;
};

export type UsageSnapshot = {
  dailyUsed: number;
  monthlyUsed: number;
  periodUsed: number;
};

export type LimitCheck = {
  allowed: boolean;
  reason: "ok" | "daily" | "monthly" | "period";
  remaining: number;
  limit: number | null;
  bucket: "daily" | "monthly" | "period" | "none";
};

function remainingOn(used: number, limit: number | null): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}

/** Allow the next use when `used < limit`. Equality is exhausted. */
export function wouldAllow(used: number, limit: number | null): boolean {
  if (limit === null) return true;
  if (limit <= 0) return false;
  return used < limit;
}

export function checkLimits(plan: PlanLimits, usage: UsageSnapshot): LimitCheck {
  if (!wouldAllow(usage.dailyUsed, plan.dailyLimit)) {
    return {
      allowed: false,
      reason: "daily",
      remaining: 0,
      limit: plan.dailyLimit,
      bucket: "daily",
    };
  }
  if (!wouldAllow(usage.monthlyUsed, plan.monthlyLimit)) {
    return {
      allowed: false,
      reason: "monthly",
      remaining: 0,
      limit: plan.monthlyLimit,
      bucket: "monthly",
    };
  }
  if (!wouldAllow(usage.periodUsed, plan.periodLimit)) {
    return {
      allowed: false,
      reason: "period",
      remaining: 0,
      limit: plan.periodLimit,
      bucket: "period",
    };
  }

  const candidates: LimitCheck[] = [];
  const dailyRem = remainingOn(usage.dailyUsed, plan.dailyLimit);
  const monthlyRem = remainingOn(usage.monthlyUsed, plan.monthlyLimit);
  const periodRem = remainingOn(usage.periodUsed, plan.periodLimit);

  if (dailyRem !== null) {
    candidates.push({
      allowed: true,
      reason: "ok",
      remaining: dailyRem,
      limit: plan.dailyLimit,
      bucket: "daily",
    });
  }
  if (monthlyRem !== null) {
    candidates.push({
      allowed: true,
      reason: "ok",
      remaining: monthlyRem,
      limit: plan.monthlyLimit,
      bucket: "monthly",
    });
  }
  if (periodRem !== null) {
    candidates.push({
      allowed: true,
      reason: "ok",
      remaining: periodRem,
      limit: plan.periodLimit,
      bucket: "period",
    });
  }

  if (candidates.length === 0) {
    return { allowed: true, reason: "ok", remaining: Infinity, limit: null, bucket: "none" };
  }
  candidates.sort((a, b) => a.remaining - b.remaining);
  return candidates[0]!;
}

export const GUEST_PLAN: PlanLimits = {
  id: "guest",
  name: "Guest",
  dailyLimit: 10,
  monthlyLimit: null,
  periodLimit: null,
  adFree: false,
  pricePaise: 0,
  intervalDays: null,
};

export const DEFAULT_PLANS: PlanLimits[] = [
  GUEST_PLAN,
  {
    id: "free",
    name: "Free Forever",
    dailyLimit: null,
    monthlyLimit: 25,
    periodLimit: null,
    adFree: false,
    pricePaise: 0,
    intervalDays: null,
  },
  {
    id: "standard",
    name: "Standard",
    dailyLimit: 100,
    monthlyLimit: null,
    periodLimit: 3000,
    adFree: false,
    pricePaise: 900,
    intervalDays: 30,
  },
  {
    id: "premium",
    name: "Premium",
    dailyLimit: 500,
    monthlyLimit: null,
    periodLimit: 15000,
    adFree: true,
    pricePaise: 3900,
    intervalDays: 30,
  },
];
