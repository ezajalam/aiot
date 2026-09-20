import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkLimits, DEFAULT_PLANS, GUEST_PLAN, wouldAllow } from "./limits.ts";

const free = DEFAULT_PLANS.find((p) => p.id === "free")!;
const standard = DEFAULT_PLANS.find((p) => p.id === "standard")!;
const premium = DEFAULT_PLANS.find((p) => p.id === "premium")!;

describe("usage limit boundaries", () => {
  it("guest 10/day: 9 allowed, 10 blocked, 11 blocked", () => {
    assert.equal(wouldAllow(9, GUEST_PLAN.dailyLimit), true);
    assert.equal(wouldAllow(10, GUEST_PLAN.dailyLimit), false);
    assert.equal(wouldAllow(11, GUEST_PLAN.dailyLimit), false);
  });

  it("free 25/month: 24/25 allowed, 25/25 blocked, 26/25 blocked", () => {
    assert.equal(checkLimits(free, { dailyUsed: 0, monthlyUsed: 24, periodUsed: 0 }).allowed, true);
    assert.equal(checkLimits(free, { dailyUsed: 0, monthlyUsed: 25, periodUsed: 0 }).allowed, false);
    assert.equal(checkLimits(free, { dailyUsed: 0, monthlyUsed: 26, periodUsed: 0 }).allowed, false);
    assert.equal(checkLimits(free, { dailyUsed: 0, monthlyUsed: 25, periodUsed: 0 }).reason, "monthly");
  });

  it("standard daily 100: 99/100 allowed, 100/100 blocked, 101/100 blocked", () => {
    const base = { monthlyUsed: 0, periodUsed: 0 };
    assert.equal(checkLimits(standard, { ...base, dailyUsed: 99 }).allowed, true);
    assert.equal(checkLimits(standard, { ...base, dailyUsed: 100 }).allowed, false);
    assert.equal(checkLimits(standard, { ...base, dailyUsed: 101 }).allowed, false);
  });

  it("standard period 3000: 2999 allowed, 3000 blocked, 3001 blocked", () => {
    const base = { dailyUsed: 0, monthlyUsed: 0 };
    assert.equal(checkLimits(standard, { ...base, periodUsed: 2999 }).allowed, true);
    assert.equal(checkLimits(standard, { ...base, periodUsed: 3000 }).allowed, false);
    assert.equal(checkLimits(standard, { ...base, periodUsed: 3001 }).allowed, false);
  });

  it("premium daily 500 and period 15000", () => {
    assert.equal(
      checkLimits(premium, { dailyUsed: 499, monthlyUsed: 0, periodUsed: 14999 }).allowed,
      true,
    );
    assert.equal(
      checkLimits(premium, { dailyUsed: 500, monthlyUsed: 0, periodUsed: 0 }).allowed,
      false,
    );
    assert.equal(
      checkLimits(premium, { dailyUsed: 0, monthlyUsed: 0, periodUsed: 15000 }).allowed,
      false,
    );
  });

  it("reports the tighter remaining window", () => {
    const check = checkLimits(standard, { dailyUsed: 90, monthlyUsed: 0, periodUsed: 10 });
    assert.equal(check.allowed, true);
    assert.equal(check.bucket, "daily");
    assert.equal(check.remaining, 10);
  });
});
