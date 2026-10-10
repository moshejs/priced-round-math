# priced-round-math

Priced venture-round **dilution math** — the **option-pool shuffle** (solve the pre-money pool top-up needed to hit a post-close target), price per share, investor share counts, and ownership tables with hard invariants. Zero dependencies.

```
npm install priced-round-math
```

## Why

"$2M on $8M pre with a 10% post-close pool" hides a linear equation: the new pool is created *pre-money*, so it comes out of the existing holders — the famous [option-pool shuffle](https://venturehacks.com/option-pool-shuffle). Every founder negotiating a term sheet, and every tool that models one, needs this exact solve. This package does the algebra and reports what the pool *really* cost (`effectivePreMoney`).

```ts
import { pricedRound } from "priced-round-math";

const r = pricedRound({
  preMoney: 8_000_000,
  investment: 2_000_000,
  preRoundFullyDiluted: 8_000_000,
  targetPoolPostClose: 0.10,
});

r.investorOwnership;  // 0.20  — always exactly investment / post-money
r.poolOwnership;      // 0.10  — hits the target exactly
r.poolTopUp;          // the shares created pre-money
r.pricePerShare;      // lower than without the pool — that's the shuffle
r.effectivePreMoney;  // preMoney minus the value handed to the new pool
```

## API

- **`pricedRound({ preMoney, investment, preRoundFullyDiluted, existingUnallocatedPool?, targetPoolPostClose?, rounding? })`** — full solve. An existing unallocated pool reduces the top-up; if it already exceeds the target, `poolTopUp` is 0. Unsolvable targets (t × postMoney/preMoney ≥ 1) throw with an explanation. `targetPoolPostClose` is the *unallocated* pool as a fraction of post-close fully diluted shares.
- **`rounding`** (opt-in): `{ pricePerShareDecimals?: number, pricePerShareRounding?: "nearest" | "down", wholeShares?: boolean }`. `pricePerShareDecimals` rounds the PPS (4 → $1.2345), to nearest by default as in the YC SAFE User Guide examples, or `"down"` to truncate; `wholeShares` rounds the pool top-up up (target is a minimum) and investor shares down. `cashInvested` reports what the whole shares actually cost. With rounding on, the identities below hold only approximately (investor % is at most a share away from investment/post-money). Term sheets differ on rounding; check yours.
- **`simplePricedRound(preMoney, investment, preRoundFD)`** — no pool top-up.
- **`diluteHolders(holders, round, preRoundFD)`** — per-holder before/after ownership and dilution.

Without rounding, every figure is exact (fractional shares). Invariants enforced by the test suite: ownership fractions sum to 1; investor % ≡ investment/post-money regardless of the shuffle; PPS ≡ preMoney/(preRoundFD + poolTopUp); all holders dilute by the same factor. Checked against an independent exact-rational solver (5,000 random rounds, 45,000 values, worst relative error 7e-15) and the Venture Hacks worked example ($2M on $8M pre with a 20% post-close pool → $6M effective pre-money).

## Related

Part of a cap-table math family: [`safe-stack-conversion`](https://github.com/moshejs/safe-stack-conversion) · [`exit-waterfall`](https://github.com/moshejs/exit-waterfall) · [`vesting-schedule-math`](https://github.com/moshejs/vesting-schedule-math).

## Author

Built by **[Moshe Malka](https://moshemalka.com)** — engineering leader in New York City. Studio work at [Quentin.Code](https://www.quentin.software/).

MIT © Moshe Malka
