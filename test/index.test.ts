import { describe, expect, it } from "vitest";
import { diluteHolders, pricedRound, simplePricedRound } from "../src/index.js";
import { CASES } from "./fixtures.js";

describe("simple round (no pool shuffle)", () => {
  it("classic: $2M on $8M pre = 20% to the investor", () => {
    const r = simplePricedRound(8_000_000, 2_000_000, 8_000_000);
    expect(r.pricePerShare).toBe(1);
    expect(r.investorShares).toBe(2_000_000);
    expect(r.investorOwnership).toBeCloseTo(0.2, 12);
    expect(r.postMoney).toBe(10_000_000);
  });

  it("ownership always sums to 1", () => {
    const r = simplePricedRound(12_345_678, 3_456_789, 9_876_543);
    expect(r.investorOwnership + r.poolOwnership + r.existingOwnership).toBeCloseTo(1, 12);
  });

  it("investor % equals investment / post-money — the fundamental identity", () => {
    const r = simplePricedRound(8_000_000, 2_000_000, 5_000_000);
    expect(r.investorOwnership).toBeCloseTo(2_000_000 / 10_000_000, 12);
  });
});

describe("the option-pool shuffle", () => {
  const r = pricedRound({
    preMoney: 8_000_000,
    investment: 2_000_000,
    preRoundFullyDiluted: 8_000_000,
    targetPoolPostClose: 0.1,
  });

  it("hits the post-close pool target exactly", () => {
    expect(r.poolOwnership).toBeCloseTo(0.1, 12);
  });

  it("keeps the investment/post-money identity", () => {
    expect(r.investorOwnership).toBeCloseTo(2_000_000 / 10_000_000, 12);
  });

  it("pool comes out of the pre-money: PPS drops below the no-pool case", () => {
    const noPool = simplePricedRound(8_000_000, 2_000_000, 8_000_000);
    expect(r.pricePerShare).toBeLessThan(noPool.pricePerShare);
    expect(r.poolTopUp).toBeGreaterThan(0);
    // PPS = preMoney / (S + poolTopUp) exactly
    expect(r.pricePerShare).toBeCloseTo(8_000_000 / (8_000_000 + r.poolTopUp), 10);
  });

  it("effective pre-money = pre-money minus the pool's value", () => {
    expect(r.effectivePreMoney).toBeCloseTo(8_000_000 - r.poolTopUp * r.pricePerShare, 8);
    expect(r.effectivePreMoney).toBeLessThan(8_000_000);
  });

  it("existing unallocated pool reduces the top-up", () => {
    const withExisting = pricedRound({
      preMoney: 8_000_000,
      investment: 2_000_000,
      preRoundFullyDiluted: 8_000_000,
      existingUnallocatedPool: 400_000,
      targetPoolPostClose: 0.1,
    });
    expect(withExisting.poolTopUp).toBeLessThan(r.poolTopUp);
    expect(withExisting.poolOwnership).toBeCloseTo(0.1, 12);
  });

  it("no top-up when the existing pool already exceeds the target", () => {
    const big = pricedRound({
      preMoney: 8_000_000,
      investment: 2_000_000,
      preRoundFullyDiluted: 8_000_000,
      existingUnallocatedPool: 2_000_000, // 25% pre-round
      targetPoolPostClose: 0.1,
    });
    expect(big.poolTopUp).toBe(0);
    expect(big.poolOwnership).toBeGreaterThan(0.1);
  });

  it("ownership sums to 1 with the shuffle", () => {
    expect(r.investorOwnership + r.poolOwnership + r.existingOwnership).toBeCloseTo(1, 12);
  });
});

describe("holder dilution", () => {
  it("all non-participating holders dilute by the same factor", () => {
    const round = pricedRound({
      preMoney: 8_000_000,
      investment: 2_000_000,
      preRoundFullyDiluted: 8_000_000,
      targetPoolPostClose: 0.1,
    });
    const holders = diluteHolders(
      [
        { name: "Founder A", shares: 4_000_000 },
        { name: "Founder B", shares: 3_000_000 },
        { name: "Angel", shares: 1_000_000 },
      ],
      round,
      8_000_000,
    );
    const factor0 = holders[0]!.ownershipAfter / holders[0]!.ownershipBefore;
    for (const h of holders) {
      expect(h.ownershipAfter / h.ownershipBefore).toBeCloseTo(factor0, 12);
      expect(h.dilution).toBeGreaterThan(0);
    }
    // founders keep proportional stakes relative to each other
    expect(holders[0]!.ownershipAfter / holders[1]!.ownershipAfter).toBeCloseTo(4 / 3, 12);
  });
});

describe("validation", () => {
  it("rejects impossible pool targets and bad inputs", () => {
    expect(() =>
      pricedRound({
        preMoney: 1_000_000,
        investment: 9_000_000,
        preRoundFullyDiluted: 1_000_000,
        targetPoolPostClose: 0.2, // t×k = 0.2×10 = 2 ≥ 1 → unsolvable
      }),
    ).toThrow(/too large/);
    expect(() => simplePricedRound(0, 1, 1)).toThrow(RangeError);
    expect(() => simplePricedRound(1, -1, 1)).toThrow(RangeError);
    expect(() =>
      pricedRound({ preMoney: 1, investment: 1, preRoundFullyDiluted: 1, targetPoolPostClose: 1 }),
    ).toThrow(RangeError);
  });
});

describe("published worked example", () => {
  it("Venture Hacks: $2M on $8M pre with a 20% post-close pool → $6M effective pre-money", () => {
    // https://venturehacks.com/option-pool-shuffle
    const r = pricedRound({
      preMoney: 8_000_000,
      investment: 2_000_000,
      preRoundFullyDiluted: 6_000_000,
      targetPoolPostClose: 0.2,
    });
    expect(r.effectivePreMoney).toBeCloseTo(6_000_000, 6);
    expect(r.poolOwnership).toBeCloseTo(0.2, 12);
    expect(r.investorOwnership).toBeCloseTo(0.2, 12);
    expect(r.existingOwnership).toBeCloseTo(0.6, 12);
  });
});

describe("opt-in rounding", () => {
  const base = { preMoney: 8_000_000, investment: 2_000_000, preRoundFullyDiluted: 8_000_000, targetPoolPostClose: 0.1 };

  it("is off by default (exact, fractional shares)", () => {
    const r = pricedRound(base);
    expect(Number.isInteger(r.poolTopUp)).toBe(false);
    expect(r.cashInvested).toBeCloseTo(2_000_000, 6);
  });

  it("wholeShares: pool rounds up, investor shares round down", () => {
    const r = pricedRound({ ...base, rounding: { wholeShares: true } });
    expect(r.poolTopUp).toBe(1_142_858); // exact 1,142,857.14
    expect(Number.isInteger(r.investorShares)).toBe(true);
    expect(r.poolOwnership).toBeGreaterThanOrEqual(0.1);
    expect(r.cashInvested).toBeLessThanOrEqual(2_000_000);
    expect(2_000_000 - r.cashInvested).toBeLessThan(r.pricePerShare);
    expect(r.investorOwnership + r.poolOwnership + r.existingOwnership).toBeCloseTo(1, 12);
  });

  it("wholeShares does not round an exact integer up because of float noise", () => {
    // exact top-up is 2,000,000 shares
    const r = pricedRound({ preMoney: 8_000_000, investment: 2_000_000, preRoundFullyDiluted: 6_000_000, targetPoolPostClose: 0.2, rounding: { wholeShares: true } });
    expect(r.poolTopUp).toBe(2_000_000);
    expect(r.investorShares).toBe(2_000_000);
  });

  it("pricePerShareDecimals truncates the PPS", () => {
    const r = pricedRound({ ...base, rounding: { pricePerShareDecimals: 4, wholeShares: true } });
    expect(r.pricePerShare).toBe(0.8749); // 8M / 9,142,858 = 0.874999…
    expect(r.investorShares).toBe(Math.floor(2_000_000 / 0.8749));
    expect(() => pricedRound({ ...base, rounding: { pricePerShareDecimals: 1.5 } })).toThrow(RangeError);
  });
});

describe("independent reference fixtures (exact rationals, bisection)", () => {
  it.each(CASES.map((c, i) => [i, c] as const))("case %i", (_i, c) => {
    const r = pricedRound(c.inputs);
    for (const [k, want] of Object.entries(c.expected)) {
      const got = r[k as keyof typeof c.expected];
      expect(Math.abs(got - want) / Math.max(1, Math.abs(want))).toBeLessThan(1e-9);
    }
  });
});
