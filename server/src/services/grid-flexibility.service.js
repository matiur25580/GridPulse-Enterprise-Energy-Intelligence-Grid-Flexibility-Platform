const round = (value, digits = 3) => Number(value.toFixed(digits))

export function evaluateGridFlexibility(hourlyProfile, input) {
  const eventHours = new Set(input.eventHours)
  const schedule = Array.from({ length: 24 }, (_, hour) => {
    const point = hourlyProfile.find((item) => item.hour === hour)
    const loadKwh = Math.max(0, Number(point?.loadKwh) || 0)
    const solarKwh = Math.max(0, Number(point?.solarKwh) || 0)
    const solarSelfConsumedKwh = Math.min(loadKwh, solarKwh)
    const gridImportKwh = Math.max(0, loadKwh - solarSelfConsumedKwh)
    const estimatedExportKwh = Math.max(0, solarKwh - loadKwh)
    const isEvent = eventHours.has(hour)
    const demandResponseKwh = isEvent ? gridImportKwh * input.reductionPercent / 100 : 0
    return {
      hour,
      observedLoad: Boolean(point?.observedLoad),
      observedSolar: Boolean(point?.observedSolar),
      loadKwh,
      solarGenerationKwh: solarKwh,
      solarSelfConsumedKwh,
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
  const exports = sum('estimatedExportKwh')
  const gridImport = sum('baselineGridImportKwh')
  const curtailed = sum('demandResponseKwh')
  const postEventImport = sum('postEventGridImportKwh')
  const avoidedEmissions = (selfConsumed + curtailed) * input.gridEmissionFactorKgPerKwh

  return {
    assumptions: {
      profile: 'average observed hourly energy by UTC hour across the selected history window',
      load: input.loadSource === 'main' ? 'main meters used as facility load; solar meters treated as generation' : 'submeters used as a fallback load proxy because no main meters were observed; results may not represent whole-facility demand',
      renewable: 'solar meter energy is treated as gross generation; self-consumption is estimated as the hourly minimum of load and solar generation',
      export: 'surplus solar generation above hourly load is an estimated export proxy; no utility export meter is available in this calculation',
      demandResponse: 'event curtailment is modeled as a percentage reduction of baseline grid import during selected UTC hours; no flexibility asset is dispatched',
      emissions: 'avoided emissions use the user-supplied grid emissions factor and count estimated solar self-consumption plus modeled demand-response reduction',
      control: 'advisory scenario only; no commands are sent to meters, inverters, batteries, or grid equipment',
    },
    renewable: {
      dailyGenerationKwh: round(generation),
      dailySelfConsumedKwh: round(selfConsumed),
      dailyEstimatedExportKwh: round(exports),
      selfConsumptionPercent: generation > 0 ? round(selfConsumed / generation * 100, 2) : null,
      solarCoveragePercent: sum('loadKwh') > 0 ? round(selfConsumed / sum('loadKwh') * 100, 2) : null,
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
