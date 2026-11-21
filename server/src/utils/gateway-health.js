export function gatewayHealth(source, now = new Date()) {
  if (source.status === 'disabled') return { health: 'disabled', minutesSinceLastSuccess: source.lastSuccessAt ? Math.max(0, Math.floor((now.getTime() - new Date(source.lastSuccessAt).getTime()) / 60000)) : null }
  if (!source.lastSuccessAt) return { health: 'awaiting_data', minutesSinceLastSuccess: null }
  const age = now.getTime() - new Date(source.lastSuccessAt).getTime()
  const threshold = source.expectedIntervalMinutes * 3 * 60 * 1000
  return {
    health: age > threshold ? 'stale' : 'healthy',
    minutesSinceLastSuccess: Math.max(0, Math.floor(age / 60000)),
  }
}
