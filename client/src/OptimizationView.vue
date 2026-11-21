<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { optimizationApi, type OptimizationScenario, type OptimizationScenarioInput } from './services/api'

const props = defineProps<{ organizationId: string }>()
const form = ref<OptimizationScenarioInput>({
  historyDays: 30,
  offPeakRatePerKwh: 5,
  peakRatePerKwh: 12,
  peakHours: [17, 18, 19, 20],
  batteryCapacityKwh: 0,
  batteryPowerKw: 0,
  initialSocPercent: 50,
  reserveSocPercent: 20,
  roundTripEfficiency: 0.9,
})
const result = ref<OptimizationScenario | null>(null)
const loading = ref(false)
const error = ref('')
const hasBattery = computed(() => form.value.batteryCapacityKwh > 0)
const maxSchedule = computed(() => Math.max(1, ...((result.value?.schedule ?? []).map((item) => Math.max(item.baselineEnergyKwh, item.gridEnergyKwh)))))
const money = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (value: number | null | undefined, digits = 1) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits })
const hourLabel = (hour: number) => String(hour).padStart(2, '0') + ':00'

function togglePeakHour(hour: number, checked: boolean) {
  form.value.peakHours = checked
    ? [...form.value.peakHours, hour].sort((a, b) => a - b)
    : form.value.peakHours.filter((item) => item !== hour)
}
async function simulate() {
  if (!props.organizationId) return
  loading.value = true
  error.value = ''
  try {
    result.value = await optimizationApi.simulate(props.organizationId, { ...form.value, peakHours: [...form.value.peakHours] })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to run optimization scenario.'
    result.value = null
  } finally { loading.value = false }
}
watch(() => props.organizationId, () => { result.value = null; error.value = '' })
</script>

<template>
  <section class="optimization-module">
    <div class="optimization-heading">
      <div><label class="eyebrow">FLEXIBILITY &amp; COST INTELLIGENCE</label><h2>Energy optimization</h2><p>Model time-of-use tariffs and battery flexibility against your organization's observed load profile. Costs use the same currency unit as your tariff inputs.</p></div>
      <span class="optimization-mode">SCENARIO SIMULATOR</span>
    </div>
    <div class="optimization-layout">
      <article class="optimization-panel">
        <div class="optimization-panel-head"><div><h3>Scenario configuration</h3><p>Use your utility tariff and planned storage specifications.</p></div></div>
        <form class="optimization-form" @submit.prevent="simulate">
          <div class="optimization-field-grid">
            <label>Telemetry history
              <select v-model.number="form.historyDays"><option :value="7">7 days</option><option :value="14">14 days</option><option :value="30">30 days</option><option :value="60">60 days</option><option :value="90">90 days</option></select>
            </label>
            <label>Off-peak rate / kWh
              <input v-model.number="form.offPeakRatePerKwh" type="number" min="0" max="100000" step="0.01" required>
            </label>
            <label>Peak rate / kWh
              <input v-model.number="form.peakRatePerKwh" type="number" min="0.01" max="100000" step="0.01" required>
            </label>
            <label>Battery capacity (kWh)
              <input v-model.number="form.batteryCapacityKwh" type="number" min="0" max="1000000" step="0.1">
            </label>
            <label>Battery charge / discharge power (kW)
              <input v-model.number="form.batteryPowerKw" type="number" min="0" max="1000000" step="0.1" :disabled="!hasBattery">
            </label>
            <label>Round-trip efficiency
              <input v-model.number="form.roundTripEfficiency" type="number" min="0.5" max="1" step="0.01">
            </label>
            <label>Initial state of charge (%)
              <input v-model.number="form.initialSocPercent" type="number" min="0" max="100" step="1" :disabled="!hasBattery">
            </label>
            <label>Minimum reserve (%)
              <input v-model.number="form.reserveSocPercent" type="number" min="0" max="100" step="1" :disabled="!hasBattery">
            </label>
          </div>
          <div class="optimization-hours">
            <div><b>Peak tariff hours (UTC)</b><small>Choose 1–12 hours that use the peak rate.</small></div>
            <div class="hour-grid">
              <label v-for="hour in 24" :key="hour-1" :class="{chosen:form.peakHours.includes(hour-1)}">
                <input type="checkbox" :checked="form.peakHours.includes(hour-1)" @change="togglePeakHour(hour-1, ($event.target as HTMLInputElement).checked)">
                {{String(hour-1).padStart(2,'0')}}
              </label>
            </div>
          </div>
          <p v-if="error" class="optimization-error" role="alert">{{error}}</p>
          <button class="optimization-run" type="submit" :disabled="loading || form.peakHours.length===0 || form.peakHours.length>12 || form.peakRatePerKwh<form.offPeakRatePerKwh || (hasBattery && form.batteryPowerKw<=0) || form.reserveSocPercent>form.initialSocPercent">{{loading ? 'Running simulation…' : 'Run optimization scenario →'}}</button>
        </form>
      </article>
      <article class="optimization-panel optimization-results">
        <div class="optimization-panel-head"><div><h3>Scenario impact</h3><p>Estimated representative-day performance.</p></div><span v-if="result" class="optimization-live">SIMULATED</span></div>
        <div v-if="!result" class="optimization-empty"><span>↗</span><b>Awaiting scenario</b><p>Configure tariff rates and optional battery parameters, then run the simulation to compare baseline and optimized operations.</p></div>
        <template v-else-if="result.dataCoverage.hoursWithReadings===0">
          <div class="optimization-empty"><span>!</span><b>No telemetry available</b><p>No valid or estimated energy readings were found in this history window. Add meter readings before evaluating optimization scenarios.</p></div>
        </template>
        <template v-else>
          <div class="optimization-kpis">
            <div><small>DAILY COST SAVINGS</small><strong>{{money(result.impact.dailyCostSavings)}}</strong><em>{{result.impact.costSavingsPercent == null ? 'No baseline cost' : fmt(result.impact.costSavingsPercent)+'% estimated'}}</em></div>
            <div><small>PEAK DEMAND REDUCTION</small><strong>{{fmt(result.impact.peakReductionKw)}} <i>kW</i></strong><em>{{result.impact.peakReductionPercent == null ? 'No demand baseline' : fmt(result.impact.peakReductionPercent)+'% estimated'}}</em></div>
            <div><small>BATTERY DISCHARGE</small><strong>{{fmt(result.optimized.batteryDischargeKwh)}} <i>kWh</i></strong><em>{{fmt(result.optimized.batteryChargeKwh)}} kWh charged</em></div>
          </div>
          <div class="optimization-compare">
            <div><span>BASELINE DAILY COST</span><b>{{money(result.baseline.dailyCost)}}</b></div>
            <div><span>OPTIMIZED DAILY COST</span><b>{{money(result.optimized.dailyCost)}}</b></div>
            <div><span>BASELINE PEAK</span><b>{{fmt(result.baseline.peakDemandKw)}} kW</b></div>
            <div><span>OPTIMIZED PEAK</span><b>{{fmt(result.optimized.peakDemandKw)}} kW</b></div>
          </div>
          <div class="optimization-schedule">
            <div class="optimization-panel-head"><div><h3>24-hour dispatch profile</h3><p>Baseline load vs modeled grid energy · UTC</p></div></div>
            <div class="schedule-bars">
              <div v-for="item in result.schedule" :key="item.hourUtc" class="schedule-hour" :title="hourLabel(item.hourUtc)+': '+fmt(item.gridEnergyKwh)+' kWh grid energy'">
                <div class="schedule-bar-track"><i class="schedule-baseline" :style="{height:(item.baselineEnergyKwh/maxSchedule*100)+'%'}"></i><i class="schedule-grid" :class="{peak:item.period==='peak'}" :style="{height:(item.gridEnergyKwh/maxSchedule*100)+'%'}"></i></div>
                <small v-if="item.hourUtc%3===0">{{String(item.hourUtc).padStart(2,'0')}}</small>
              </div>
            </div>
            <div class="schedule-legend"><span><i></i> Baseline</span><span><i></i> Grid after dispatch</span></div>
          </div>
          <div class="optimization-coverage"><b>{{result.dataCoverage.observedDays}} observed days</b><span>{{result.dataCoverage.hoursWithReadings}} / 24 hourly buckets · {{result.range.requestedDays}}-day requested window</span></div>
          <p class="optimization-assumptions"><b>MODEL ASSUMPTIONS</b><span v-for="(value,key) in result.assumptions" :key="key">{{value}}</span></p>
        </template>
      </article>
    </div>
    <p class="optimization-disclaimer"><b>ADVISORY SIMULATION</b><span>Results are estimates based on observed telemetry, configured tariff inputs and idealized battery constraints. Tariff periods are interpreted in UTC; actual savings depend on utility billing rules, interval granularity, degradation, inverter limits, taxes and operational constraints. This module does not control equipment.</span></p>
  </section>
</template>
