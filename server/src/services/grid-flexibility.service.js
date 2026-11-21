const round = (value, digits = 3) => Number(value.toFixed(digits))

export function evaluateGridFlexibility(hourlyProfile, input) {
  const eventHours = new Set(input.eventHours)
  const schedule = Array.from({ length: 24 }, (_, hour) => {
    const point = hourlyProfile.find((item) => item.hour === hour)
    const loadKwh = Math.max(0, Number(point?.loadKwh) || 0)
    const solarKwh = Math.max(0, Number(point?.solarKwh) || 0)
    const hasOverlap = Boolean(point?.observedLoad && point?.observedSolar)
    const solarSelfConsumedKwh = hasOverlap ? Math.min(loadKwh, solarKwh) : 0
    const solarGenerationWithLoadKwh = hasOverlap ? solarKwh : 0
    const loadDuringSolarObservedKwh = hasOverlap ? loadKwh : 0
    const gridImportKwh = point?.observedLoad ? Math.max(0, loadKwh - solarSelfConsumedKwh) : 0
    const estimatedExportKwh = hasOverlap ? Math.max(0, solarKwh - loadKwh) : 0
    const isEvent = eventHours.has(hour)
    const demandResponseKwh = isEvent ? gridImportKwh * input.reductionPercent / 100 : 0
    return {
      hour,
      observedLoad: Boolean(point?.observedLoad),
      observedSolar: Boolean(point?.observedSolar),
      loadKwh,
      solarGenerationKwh: solarKwh,
      solarSelfConsumedKwh,
      solarGenerationWithLoadKwh,
      loadDuringSolarObservedKwh,
      estimatedExportKwh,
      baselineGridImportKwh: gridImportKwh,
      demandResponseKwh,
      postEventGridImportKwh: Math.max(0, gridImportKwh - demandResponseKwh),
      isEvent,
    }
  })

  const sum = (key) => schedule.reduce((total, item) => total + item[key], 0)
  const generation = sum('solarGenerationKwh')
  const selfConsumed = sum('solarSelfConsumedKwh')
  const solarGenerationWithLoad = sum('solarGenerationWithLoadKwh')
  const loadDuringSolarObserved = sum('loadDuringSolarObservedKwh')
  const exports = sum('estimatedExportKwh')
  const gridImport = sum('baselineGridImportKwh')
  const curtailed = sum('demandResponseKwh')
  const postEventImport = sum('postEventGridImportKwh')
  const avoidedEmissions = (selfConsumed + curtailed) * input.gridEmissionFactorKgPerKwh

  return {
    assumptions: {
      profile: 'average observed hourly energy by UTC hour across the selected history window',
      load: input.loadSource === 'main' ? 'main meters used as facility load; when solar telemetry is absent, observed load is treated as grid import for that hour' : 'submeters used as a fallback load proxy because no main meters were observed; results may not represent whole-facility demand. When solar telemetry is absent, observed load is treated as grid import for that hour',
      renewable: 'solar generation is reported from observed solar intervals; self-consumption and surplus export are estimated only for hours with both load and solar readings. Unmatched hours are excluded from those ratios.',
      export: 'surplus solar generation above hourly load is an estimated export proxy; no utility export meter is available in this calculation',
      demandResponse: 'event curtailment is modeled as a percentage reduction of baseline grid import during selected UTC hours; no flexibility asset is dispatched',
      emissions: 'avoided emissions use the user-supplied grid emissions factor and count estimated solar self-consumption plus modeled demand-response reduction',
      control: 'advisory scenario only; no commands are sent to meters, inverters, batteries, or grid equipment',
    },
    renewable: {
      dailyGenerationKwh: round(generation),
      dailySelfConsumedKwh: round(selfConsumed),
      dailyEstimatedExportKwh: round(exports),
      selfConsumptionPercent: solarGenerationWithLoad > 0 ? round(selfConsumed / solarGenerationWithLoad * 100, 2) : null,
      solarCoveragePercent: loadDuringSolarObserved > 0 ? round(selfConsumed / loadDuringSolarObserved * 100, 2) : null,
    },
    demandResponse: {
      eventHours: [...eventHours].sort((a, b) => a - b),
      dailyBaselineGridImportKwh: round(gridImport),
      dailyCurtailedKwh: round(curtailed),
      dailyPostEventGridImportKwh: round(postEventImport),
      reductionPercent: input.reductionPercent,
      estimatedIncentive: round(curtailed * input.incentivePerKwh, 2),
      incentiveRatePerKwh: input.incentivePerKwh,
    },
    emissions: {
      gridEmissionFactorKgPerKwh: input.gridEmissionFactorKgPerKwh,
      dailyAvoidedKgCo2e: round(avoidedEmissions, 3),
      annualizedAvoidedTonnesCo2e: round(avoidedEmissions * 365 / 1000, 3),
    },
    schedule: schedule.map((item) => ({
      hourUtc: item.hour,
      observedLoad: item.observedLoad,
      observedSolar: item.observedSolar,
      loadKwh: round(item.loadKwh),
      solarGenerationKwh: round(item.solarGenerationKwh),
      selfConsumedSolarKwh: round(item.solarSelfConsumedKwh),
      estimatedExportKwh: round(item.estimatedExportKwh),
      baselineGridImportKwh: round(item.baselineGridImportKwh),
      demandResponseKwh: round(item.demandResponseKwh),
      postEventGridImportKwh: round(item.postEventGridImportKwh),
      event: item.isEvent,
    })),
  }
}
