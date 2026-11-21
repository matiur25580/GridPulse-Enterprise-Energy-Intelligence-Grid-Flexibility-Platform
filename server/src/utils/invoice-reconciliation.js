export const roundInvoiceValue = (value, digits = 2) => Number(value.toFixed(digits))

export function calculateInvoiceReconciliation({
  actualAmount, estimatedAmount, actualEnergyKwh, estimatedEnergyKwh,
  actualDemandKw = null, estimatedDemandKw = null, currency, tolerancePercent,
}) {
  const amountVariance = roundInvoiceValue(actualAmount - estimatedAmount)
  const amountVariancePercent = estimatedAmount > 0 ? roundInvoiceValue(amountVariance / estimatedAmount * 100) : null
  const energyVarianceKwh = roundInvoiceValue(actualEnergyKwh - estimatedEnergyKwh)
  const energyVariancePercent = estimatedEnergyKwh > 0 ? roundInvoiceValue(energyVarianceKwh / estimatedEnergyKwh * 100) : null
  const demandVarianceKw = actualDemandKw == null || estimatedDemandKw == null ? null : roundInvoiceValue(actualDemandKw - estimatedDemandKw)
  const withinTolerance = estimatedAmount === 0 ? actualAmount === 0 : amountVariancePercent != null && Math.abs(amountVariancePercent) <= tolerancePercent
  return {
    status: withinTolerance ? 'within_tolerance' : 'discrepancy',
    tolerancePercent,
    estimatedAmount: roundInvoiceValue(estimatedAmount),
    actualAmount: roundInvoiceValue(actualAmount),
    amountVariance,
    amountVariancePercent,
    estimatedEnergyKwh,
    actualEnergyKwh,
    energyVarianceKwh,
    energyVariancePercent,
    estimatedDemandKw,
    actualDemandKw,
    demandVarianceKw,
    currency,
    notes: [
      ...(amountVariance > 0 ? ['Actual utility amount is higher than the modeled estimate.'] : amountVariance < 0 ? ['Actual utility amount is lower than the modeled estimate.'] : ['Actual and modeled amounts match.']),
      ...(estimatedDemandKw == null ? ['Demand comparison is unavailable because the estimate lacks complete measured demand coverage.'] : []),
      ...(amountVariancePercent == null ? ['Percentage variance is unavailable because the modeled amount is zero.'] : []),
    ],
    methodology: 'Actual invoice totals are compared with a newly generated GridPulse estimate using the selected tariff version and eligible meter telemetry for the same facility and dates. This is an exception-screening aid, not an accounting adjustment.',
    reconciledAt: new Date(),
  }
}
