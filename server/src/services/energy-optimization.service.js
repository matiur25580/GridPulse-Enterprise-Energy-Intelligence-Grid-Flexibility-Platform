const round = (value, digits = 3) => Number(value.toFixed(digits))

export function simulateEnergyOptimization(hourlyProfile, input) {
  const peakHours = new Set(input.peakHours)
  const batteryEnabled = input.batteryCapacityKwh > 0 && input.batteryPowerKw > 0
  const oneWayEfficiency = Math.sqrt(input.roundTripEfficiency)
  const capacity = input.batteryCapacityKwh
  const reserve = capacity * input.reserveSocPercent / 100
  let stateOfCharge = capacity * input.initialSocPercent / 100
  stateOfCharge = Math.max(reserve, Math.min(capacity, stateOfCharge))

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const observed = hourlyProfile.find((item) => item.hour === hour)
    const energyKwh = Math.max(0, Number(observed?.energyKwh) || 0)
    const demandKw = observed?.demandKw == null ? energyKwh : Math.max(0, Number(observed.demandKw))
    const isPeak = peakHours.has(hour)
    const rate = isPeak ? input.peakRatePerKwh : input.offPeakRatePerKwh
    return { hour, energyKwh, baselineDemandKw: demandKw, rate, isPeak, observed: Boolean(observed), chargeKwh: 0, dischargeKwh: 0 }
  })

  // Dispatch chronologically so energy charged later in the day cannot serve an earlier peak.
  if (batteryEnabled) {
    for (const item of hours) {
      if (!item.observed) continue
      if (!item.isPeak) {
        const availableInput = Math.min(input.batteryPowerKw, (capacity - stateOfCharge) / oneWayEfficiency)
        item.chargeKwh = Math.max(0, availableInput)
        stateOfCharge += item.chargeKwh * oneWayEfficiency
      } else {
        const availableOutput = Math.min(input.batteryPowerKw, Math.max(0, stateOfCharge - reserve) * oneWayEfficiency)
        item.dischargeKwh = Math.min(item.energyKwh, Math.max(0, availableOutput))
        stateOfCharge -= item.dischargeKwh / oneWayEfficiency
      }
    }
  }

  const hasDemandMeasurements = hourlyProfile.some((item) => item.demandKw != null)
  const hasMissingDemandMeasurements = hourlyProfile.some((item) => item.demandKw == null)
  const demandProxy = hasDemandMeasurements
    ? (hasMissingDemandMeasurements ? 'maximum observed demand kW where available; missing-hour demand falls back to hourly energy kWh as indicative average kW' : 'maximum observed demand kW by hour')
    : 'hourly energy kWh treated as average kW; indicative only'

  const baselineCost = hours.reduce((sum, item) => sum + item.energyKwh * item.rate, 0)
  const optimizedCost = hours.reduce((sum, item) => sum + Math.max(0, item.energyKwh + item.chargeKwh - item.dischargeKwh) * item.rate, 0)
  const baselinePeakKw = Math.max(0, ...hours.map((item) => item.baselineDemandKw))
  const optimizedPeakKw = Math.max(0, ...hours.map((item) => Math.max(0, item.baselineDemandKw + item.chargeKwh - item.dischargeKwh)))
  const totalCharge = hours.reduce((sum, item) => sum + item.chargeKwh, 0)
  const totalDischarge = hours.reduce((sum, item) => sum + item.dischargeKwh, 0)
  const savings = baselineCost - optimizedCost

  return {
    assumptions: {
      profile: 'average observed hourly day across the selected history window',
      tariff: 'flat off-peak and peak rates; configured peak hours are interpreted in UTC',
      battery: batteryEnabled ? 'idealized one-hour dispatch with configured power, capacity, reserve and round-trip efficiency' : 'battery dispatch disabled; set capacity and power above zero to simulate storage',
      demandProxy,
      control: 'planning simulation only; no equipment commands are sent',
    },
    baseline: {
      dailyEnergyKwh: round(hours.reduce((sum, item) => sum + item.energyKwh, 0)),
      dailyCost: round(baselineCost, 2),
      peakDemandKw: round(baselinePeakKw),
    },
    optimized: {
      dailyGridEnergyKwh: round(hours.reduce((sum, item) => sum + item.energyKwh + item.chargeKwh - item.dischargeKwh, 0)),
      dailyCost: round(optimizedCost, 2),
      peakDemandKw: round(optimizedPeakKw),
      batteryChargeKwh: round(totalCharge),
      batteryDischargeKwh: round(totalDischarge),
      endingStateOfChargeKwh: round(stateOfCharge),
    },
    impact: {
      dailyCostSavings: round(savings, 2),
      costSavingsPercent: baselineCost > 0 ? round(savings / baselineCost * 100, 2) : null,
      peakReductionKw: round(Math.max(0, baselinePeakKw - optimizedPeakKw)),
      peakReductionPercent: baselinePeakKw > 0 ? round(Math.max(0, baselinePeakKw - optimizedPeakKw) / baselinePeakKw * 100, 2) : null,
    },
    schedule: hours.map((item) => ({
      hourUtc: item.hour,
      observed: item.observed,
      baselineEnergyKwh: round(item.energyKwh),
      gridEnergyKwh: round(Math.max(0, item.energyKwh + item.chargeKwh - item.dischargeKwh)),
      chargeKwh: round(item.chargeKwh),
      dischargeKwh: round(item.dischargeKwh),
      tariffRate: item.rate,
      period: item.isPeak ? 'peak' : 'off-peak',
    })),
  }
}
