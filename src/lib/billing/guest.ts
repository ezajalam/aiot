import { checkLimits, GUEST_PLAN, type LimitCheck } from "./limits";
import { localDay } from "@/lib/utils";

const KEY = "anvil.guest-usage.v1";

type Stored = { day: string; count: number };

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { day: localDay(), count: 0 };
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.day !== localDay()) return { day: localDay(), count: 0 };
    return { day: parsed.day, count: Number(parsed.count) || 0 };
  } catch {
    return { day: localDay(), count: 0 };
  }
}

function write(s: Stored) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function guestSnapshot(): LimitCheck & { used: number } {
  const s = read();
  const check = checkLimits(GUEST_PLAN, {
    dailyUsed: s.count,
    monthlyUsed: 0,
    periodUsed: 0,
  });
  return { ...check, used: s.count };
}

export function reserveGuest(): LimitCheck & { used: number } {
  const s = read();
  const check = checkLimits(GUEST_PLAN, {
    dailyUsed: s.count,
    monthlyUsed: 0,
    periodUsed: 0,
  });
  if (!check.allowed) return { ...check, used: s.count };
  const next = { day: localDay(), count: s.count + 1 };
  write(next);
  return {
    ...checkLimits(GUEST_PLAN, { dailyUsed: next.count, monthlyUsed: 0, periodUsed: 0 }),
    used: next.count,
    remaining: Math.max(0, (GUEST_PLAN.dailyLimit ?? 0) - next.count),
  };
}

export function rollbackGuest() {
  const s = read();
  write({ day: localDay(), count: Math.max(0, s.count - 1) });
}
