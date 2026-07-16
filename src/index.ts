/**
 * priced-round-math — dilution math for a priced venture round.
 *
 * The option-pool shuffle (solving the pre-money pool top-up needed to hit a
 * post-close pool percentage, and its effective-valuation cost), price per
 * share, investor share counts, and the resulting ownership table — with
 * invariants (ownership sums to 1, investor % = investment/post-money).
 *
 * Definitions used (the standard venture convention):
 *   PPS        = preMoney / preRoundFullyDiluted′
 *   where preRoundFullyDiluted′ INCLUDES the new pool top-up (the "shuffle" —
 *   the pool is created pre-money, so existing holders absorb the dilution).
 *   investorShares = investment / PPS
 *   postMoney  = preMoney + investment
 */

export interface RoundInputs {
  /** Pre-money valuation in currency units. */
  preMoney: number;
  /** New investment in currency units. */
  investment: number;
  /** Fully diluted shares before the round (issued + existing pool, allocated + unallocated). */
  preRoundFullyDiluted: number;
  /** Unallocated option-pool shares already existing (counted inside preRoundFullyDiluted). */
  existingUnallocatedPool?: number;
  /**
   * Target unallocated pool as a fraction of POST-close fully diluted
   * (e.g. 0.1 for a "10% post-close pool"). Omit for no pool top-up.
   */
  targetPoolPostClose?: number;
}

export interface RoundResult {
  /** Price per share. */
  pricePerShare: number;
  /** New option-pool shares created pre-money (the shuffle). */
  poolTopUp: number;
  /** Shares issued to the new investor(s). */
  investorShares: number;
  /** Fully diluted shares after the close. */
  postRoundFullyDiluted: number;
  /** Investor ownership fraction post-close. */
  investorOwnership: number;
  /** Total unallocated pool fraction post-close. */
  poolOwnership: number;
  /** Pre-round holders' remaining ownership fraction post-close. */
  existingOwnership: number;
  /** Post-money valuation (preMoney + investment). */
  postMoney: number;
  /**
   * The "effective" pre-money after subtracting the value of the new pool —
   * what the option-pool shuffle really costs the existing holders.
   */
  effectivePreMoney: number;
}

function check(cond: boolean, msg: string): void {
  if (!cond) throw new RangeError(msg);
}

/**
 * Solve a priced round, including the option-pool shuffle.
 *
 * Derivation of the top-up P (new pool shares):
 *   PPS  = preMoney / (S + P)             (pool created pre-money)
 *   I    = investorShares × PPS
 *   FD′  = S + P + investorShares
 *   want (P + E) / FD′ = t                (E = existing unallocated)
 * Substituting investorShares = I(S+P)/preMoney gives a linear equation in P.
 *
 * ```ts
 * pricedRound({ preMoney: 8_000_000, investment: 2_000_000,
 *   preRoundFullyDiluted: 8_000_000, targetPoolPostClose: 0.1 });
 * ```
 */
export function pricedRound(inputs: RoundInputs): RoundResult {
  const { preMoney, investment, preRoundFullyDiluted: S } = inputs;
  const E = inputs.existingUnallocatedPool ?? 0;
  const t = inputs.targetPoolPostClose ?? 0;

  check(Number.isFinite(preMoney) && preMoney > 0, `preMoney must be positive, got ${preMoney}`);
  check(Number.isFinite(investment) && investment >= 0, `investment must be ≥ 0, got ${investment}`);
  check(Number.isFinite(S) && S > 0, `preRoundFullyDiluted must be positive, got ${S}`);
  check(Number.isFinite(E) && E >= 0 && E <= S, `existingUnallocatedPool must be in [0, preRoundFullyDiluted]`);
  check(Number.isFinite(t) && t >= 0 && t < 1, `targetPoolPostClose must be in [0, 1), got ${t}`);

  // FD′(P) = (S + P) × (1 + I/V)   since investorShares = I(S+P)/V
  const k = 1 + investment / preMoney;

  // (P + E) = t × (S + P) × k  →  P (1 − tk) = t k S − E
  const denom = 1 - t * k;
  check(
    denom > 0,
    `targetPoolPostClose ${t} is too large to solve given the round size (t × postMoney/preMoney ≥ 1)`,
  );
  let poolTopUp = (t * k * S - E) / denom;
  if (poolTopUp < 0) poolTopUp = 0; // existing pool already exceeds the target

  const pricePerShare = preMoney / (S + poolTopUp);
  const investorShares = investment / pricePerShare;
  const postRoundFullyDiluted = S + poolTopUp + investorShares;
  const postMoney = preMoney + investment;

  return {
    pricePerShare,
    poolTopUp,
    investorShares,
    postRoundFullyDiluted,
    investorOwnership: investorShares / postRoundFullyDiluted,
    poolOwnership: (poolTopUp + E) / postRoundFullyDiluted,
    existingOwnership: (S - E) / postRoundFullyDiluted,
    postMoney,
    effectivePreMoney: preMoney - poolTopUp * pricePerShare,
  };
}

export interface Holder {
  name: string;
  shares: number;
}

export interface DilutedHolder extends Holder {
  ownershipBefore: number;
  ownershipAfter: number;
  dilution: number;
}

/**
 * Apply a round's dilution to a holder list (shares stay constant; ownership
 * shrinks by the same factor for everyone who isn't buying in).
 */
export function diluteHolders(holders: readonly Holder[], round: RoundResult, preRoundFullyDiluted: number): DilutedHolder[] {
  check(preRoundFullyDiluted > 0, "preRoundFullyDiluted must be positive");
  return holders.map((h) => {
    check(h.shares >= 0, `holder ${h.name} has negative shares`);
    const before = h.shares / preRoundFullyDiluted;
    const after = h.shares / round.postRoundFullyDiluted;
    return { ...h, ownershipBefore: before, ownershipAfter: after, dilution: before - after };
  });
}

/**
 * Convenience: the round WITHOUT a pool top-up (PPS = preMoney / preRoundFD).
 */
export function simplePricedRound(preMoney: number, investment: number, preRoundFullyDiluted: number): RoundResult {
  return pricedRound({ preMoney, investment, preRoundFullyDiluted });
}
