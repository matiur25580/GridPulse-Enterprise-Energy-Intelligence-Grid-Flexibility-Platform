const DAY_MS = 86400000

const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function buildEnergyForecast(daily, horizonDays, generatedAt = new Date()) {
  const observations = daily
    .map((item) => ({ date: item._id, energyKwh: Math.max(0, Number(item.energyKwh) || 0) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const window = observations.slice(-14)
  const baselineWindow = window.slice(-7)
  const baseline = baselineWindow.length
    ? baselineWindow.reduce((sum, item) => sum + item.energyKwh, 0) / baselineWindow.length
    : 0
  const meanX = (window.length - 1) / 2
  const meanY = window.length ? window.reduce((sum, item) => sum + item.energyKwh, 0) / window.length : 0
  const denominator = window.reduce((sum, _item, index) => sum + (index - meanX) ** 2, 0)
  const rawSlope = denominator
    ? window.reduce((sum, item, index) => sum + (index - meanX) * (item.energyKwh - meanY), 0) / denominator
    : 0
  const maxDailyTrend = Math.max(baseline * 0.15, 0.01)
  const slope = Math.max(-maxDailyTrend, Math.min(maxDailyTrend, rawSlope))
  const lastDate = observations.length ? new Date(observations[observations.length - 1].date + 'T00:00:00.000Z') : new Date(generatedAt)
  const forecast = Array.from({ length: horizonDays }, (_item, index) => {
    const step = index + 1
    const energyKwh = Math.max(0, baseline + slope * step)
    const uncertainty = Math.max(baseline * 0.15, energyKwh * 0.08) * Math.sqrt(step)
    const date = new Date(lastDate.getTime() + step * DAY_MS).toISOString().slice(0, 10)
    return {
      date,
      energyKwh: Number(energyKwh.toFixed(3)),
      lowerKwh: Number(Math.max(0, energyKwh - uncertainty).toFixed(3)),
      upperKwh: Number((energyKwh + uncertainty).toFixed(3)),
    }
  })
  return {
    model: 'seven-day-moving-average-with-capped-linear-trend',
    methodology: 'A transparent baseline using the last seven observed daily totals and a linear trend fitted to up to fourteen observed days. Trend is capped at 15% of baseline per day; uncertainty bands are heuristic, not statistical confidence intervals.',
    historyCount: observations.length,
    baselineDailyKwh: Number(baseline.toFixed(3)),
    dailyTrendKwh: Number(slope.toFixed(3)),
    forecast,
  }
}

export function detectConsumptionAnomalies(dailyMeterRows, minimumHistory = 7) {
  const byMeter = new Map()
  for (const row of dailyMeterRows) {
    const key = String(row.meterId)
    if (!byMeter.has(key)) byMeter.set(key, [])
    byMeter.get(key).push(row)
  }

  const anomalies = []
  for (const [meterId, rows] of byMeter) {
    rows.sort((a, b) => a.date.localeCompare(b.date))
    for (let index = 0; index < rows.length; index += 1) {
      const current = rows[index]
      const history = rows.slice(Math.max(0, index - 14), index).slice(-14)
      if (history.length < minimumHistory) continue
      const values = history.map((item) => Number(item.energyKwh) || 0)
      const center = median(values)
      const mad = median(values.map((value) => Math.abs(value - center)))
      const threshold = center + Math.max(mad * 1.4826 * 3, center * 0.5, 0.01)
      const observed = Number(current.energyKwh) || 0
      if (observed <= threshold) continue
      anomalies.push({
        meterId,
        facilityId: current.facilityId,
        date: current.date,
        energyKwh: Number(observed.toFixed(3)),
        baselineKwh: Number(center.toFixed(3)),
        thresholdKwh: Number(threshold.toFixed(3)),
        severity: observed > threshold * 2 ? 'high' : 'medium',
        deviationRatio: Number((observed / Math.max(center, 0.01)).toFixed(2)),
        method: 'rolling-median-mad',
      })
    }
  }
  return anomalies.sort((a, b) => b.deviationRatio - a.deviationRatio)
}


/** Rolling-origin one-day-ahead evaluation; only contiguous prior daily observations are used. */
export function evaluateEnergyForecast(daily, backtestDays = 14, minimumTrainingDays = 7) {
  const observations = daily
    .map((item) => ({ date: item._id ?? item.date, energyKwh: Math.max(0, Number(item.energyKwh) || 0) }))
    .filter((item) => item.date && Number.isFinite(item.energyKwh))
    .sort((a, b) => a.date.localeCompare(b.date))
  const predictions = []
  for (let targetIndex = 1; targetIndex < observations.length; targetIndex += 1) {
    const target = observations[targetIndex]
    const previous = observations[targetIndex - 1]
    if (new Date(target.date + 'T00:00:00Z') - new Date(previous.date + 'T00:00:00Z') !== DAY_MS) continue
    const training = observations.slice(Math.max(0, targetIndex - 14), targetIndex)
    if (training.length < minimumTrainingDays) continue
    const isContiguous = training.every((item, index) => index === 0 ||
      new Date(item.date + 'T00:00:00Z') - new Date(training[index - 1].date + 'T00:00:00Z') === DAY_MS)
    if (!isContiguous) continue
    const prediction = buildEnergyForecast(training.map((item) => ({ _id: item.date, energyKwh: item.energyKwh })), 1).forecast[0]?.energyKwh
    if (!Number.isFinite(prediction)) continue
    const actual = target.energyKwh
    const error = prediction - actual
    predictions.push({
      date: target.date,
      actualKwh: Number(actual.toFixed(3)),
      predictedKwh: Number(prediction.toFixed(3)),
      errorKwh: Number(error.toFixed(3)),
      absoluteErrorKwh: Number(Math.abs(error).toFixed(3)),
      absolutePercentageError: actual > 0 ? Number((Math.abs(error) / actual * 100).toFixed(2)) : null,
    })
  }
  const evaluated = predictions.slice(-backtestDays)
  const count = evaluated.length
  const mae = count ? evaluated.reduce((sum, item) => sum + Math.abs(item.errorKwh), 0) / count : null
  const rmse = count ? Math.sqrt(evaluated.reduce((sum, item) => sum + item.errorKwh ** 2, 0) / count) : null
  const actualTotal = evaluated.reduce((sum, item) => sum + item.actualKwh, 0)
  const absoluteErrorTotal = evaluated.reduce((sum, item) => sum + Math.abs(item.errorKwh), 0)
  const percentageErrors = evaluated.filter((item) => item.absolutePercentageError !== null)
  const mape = percentageErrors.length ? percentageErrors.reduce((sum, item) => sum + item.absolutePercentageError, 0) / percentageErrors.length : null
  const meanError = count ? evaluated.reduce((sum, item) => sum + item.errorKwh, 0) / count : null
  return {
    method: 'rolling-origin-one-day-ahead',
    minimumTrainingDays,
    evaluatedDays: count,
    requestedDays: backtestDays,
    metrics: {
      maeKwh: mae === null ? null : Number(mae.toFixed(3)),
      rmseKwh: rmse === null ? null : Number(rmse.toFixed(3)),
      mapePercent: mape === null ? null : Number(mape.toFixed(2)),
      weightedAbsolutePercentageError: actualTotal > 0 ? Number((absoluteErrorTotal / actualTotal * 100).toFixed(2)) : null,
      meanErrorKwh: meanError === null ? null : Number(meanError.toFixed(3)),
    },
    predictions: evaluated,
    note: 'One-day-ahead rolling-origin evaluation on contiguous observed days only. Each prediction uses earlier observations; MAPE excludes zero-actual days. Metrics are descriptive, not a guarantee of future accuracy.',
  }
}
