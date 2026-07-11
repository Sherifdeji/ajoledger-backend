/**
 * Calculates the final gross amount (in KOBO) a user must be charged so that after 
 * Nomba deducts its processing fees, the exact required Net Amount lands in our wallet.
 * 
 * @param expectedContributionKobo - The base contribution amount in Kobo.
 * @param memberCount - The total number of members in the group.
 * @param platformFeeKobo - The AjoLedger platform fee in Kobo (default: 500 kobo / ₦5).
 * @returns The total gross amount to charge the user in Kobo.
 */
export function calculateGrossChargeKobo(
  expectedContributionKobo: number,
  memberCount: number,
  platformFeeKobo: number = 500,
): number {
  const NOMBA_FEE_PERCENTAGE = 0.01;
  const NOMBA_FEE_MIN_KOBO = 1000;
  const NOMBA_FEE_CAP_KOBO = 15000;
  const OUTBOUND_FEE_NAIRA = 20;

  // 1. Shared Outbound Fee (Rounded up to nearest whole Naira, converted to Kobo)
  const sharedOutboundFeeKobo = Math.ceil(OUTBOUND_FEE_NAIRA / memberCount) * 100;

  // 2. Target Net (The exact amount that MUST land in our wallet)
  const targetNetKobo = expectedContributionKobo + sharedOutboundFeeKobo + platformFeeKobo;

  // 3. Threshold Boundaries
  const minThresholdKobo = NOMBA_FEE_MIN_KOBO / NOMBA_FEE_PERCENTAGE - NOMBA_FEE_MIN_KOBO; // 99,000 kobo (₦990)
  const maxThresholdKobo = NOMBA_FEE_CAP_KOBO / NOMBA_FEE_PERCENTAGE - NOMBA_FEE_CAP_KOBO; // 1,485,000 kobo (₦14,850)

  // 4. Gross Calculation
  let grossKobo: number;

  if (targetNetKobo <= minThresholdKobo) {
    grossKobo = targetNetKobo + NOMBA_FEE_MIN_KOBO;
  } else if (targetNetKobo > minThresholdKobo && targetNetKobo <= maxThresholdKobo) {
    grossKobo = targetNetKobo / (1 - NOMBA_FEE_PERCENTAGE);
  } else {
    grossKobo = targetNetKobo + NOMBA_FEE_CAP_KOBO;
  }

  // 5. Final Return (Guarantees zero fractional kobo)
  return Math.ceil(grossKobo);
}
