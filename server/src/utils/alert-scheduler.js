export function isAlertLeaseAvailable(leaseUntil, now = new Date()) {
  return !leaseUntil || new Date(leaseUntil).getTime() <= now.getTime()
}

export function nextAlertEvaluationAt(now, intervalSeconds) {
  return new Date(now.getTime() + intervalSeconds * 1000)
}
