export function isAlertStale(lastSeenAt, staleAfterMinutes, now = new Date()) {
  if (!lastSeenAt) return true
  return now.getTime() - new Date(lastSeenAt).getTime() > staleAfterMinutes * 60_000
}

export function exceedsEnergyThreshold(observedKwh, thresholdKwh) {
  return Number.isFinite(observedKwh) && Number.isFinite(thresholdKwh) && observedKwh > thresholdKwh
}
