<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gridFlexibilityApi, type GridFlexibilityInput, type GridFlexibilityResult } from './services/api'

const props = defineProps<{ organizationId: string }>()
const form = ref<GridFlexibilityInput>({
  historyDays: 30,
  eventHours: [17, 18, 19],
  reductionPercent: 15,
  incentivePerKwh: 1.5,
  gridEmissionFactorKgPerKwh: 0.4,
})
const result = ref<GridFlexibilityResult | null>(null)
const loading = ref(false)
const error = ref('')
const maxBar = computed(() => Math.max(1, ...((result.value?.schedule ?? []).map((item) => Math.max(item.loadKwh, item.solarGenerationKwh)))))
const number = (value: number | null | undefined, digits = 1) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits })
const hourLabel = (hour: number) => String(hour).padStart(2, '0') + ':00'

function toggleHour(hour: number, checked: boolean) {
  form.value.eventHours = checked
    ? [...form.value.eventHours, hour].sort((a, b) => a - b)
    : form.value.eventHours.filter((item) => item !== hour)
}
async function simulate() {
  if (!props.organizationId) return
  loading.value = true
  error.value = ''
  try {
    result.value = await gridFlexibilityApi.simulate(props.organizationId, { ...form.value, eventHours: [...form.value.eventHours] })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to run grid flexibility scenario.'
    result.value = null
  } finally { loading.value = false }
}
watch(() => props.organizationId, () => { result.value = null; error.value = '' })
</script>

<template>
  <section class="flexibility-module">
    <div class="flexibility-heading">
      <div><label class="eyebrow">RENEWABLES &amp; GRID SERVICES</label><h2>Grid flexibility intelligence</h2><p>Understand onsite solar utilization and evaluate a demand-response event against observed facility load.</p></div>
      <span class="flexibility-mode">ADVISORY SCENARIO</span>
    </div>
    <div class="flexibility-layout">
      <article class="flexibility-panel">
        <div class="flexibility-panel-head"><div><h3>Demand-response event</h3><p>Configure a hypothetical event and commercial assumptions.</p></div></div>
        <form class="flexibility-form" @submit.prevent="simulate">
          <div class="flexibility-fields">
            <label>Telemetry history
              <select v-model.number="form.historyDays"><option :value="7">7 days</option><option :value="14">14 days</option><option :value="30">30 days</option><option :value="60">60 days</option><option :value="90">90 days</option></select>
            </label>
            <label>Target grid-import reduction (%)
              <input v-model.number="form.reductionPercent" type="number" min="1" max="50" step="1" required>
            </label>
            <label>Incentive per curtailed kWh
              <input v-model.number="form.incentivePerKwh" type="number" min="0" max="100000" step="0.01" required>
            </label>
            <label>Grid emission factor (kg CO₂e/kWh)
              <input v-model.number="form.gridEmissionFactorKgPerKwh" type="number" min="0" max="5" step="0.001" required>
            </label>
          </div>
          <div class="flexibility-hours">
            <div><b>Demand-response event hours (UTC)</b><small>Select 1–8 hours for the event window.</small></div>
            <div class="flexibility-hour-grid">
              <label v-for="hour in 24" :key="hour-1" :class="{chosen:form.eventHours.includes(hour-1)}">
                <input type="checkbox" :checked="form.eventHours.includes(hour-1)" @change="toggleHour(hour-1, ($event.target as HTMLInputElement).checked)">
                {{String(hour-1).padStart(2,'0')}}
              </label>
            </div>
          </div>
          <p v-if="error" class="flexibility-error" role="alert">{{error}}</p>
          <button class="flexibility-run" type="submit" :disabled="loading || form.eventHours.length===0 || form.eventHours.length>8">{{loading ? 'Evaluating scenario…' : 'Evaluate demand response →'}}</button>
        </form>
      </article>
      <article class="flexibility-panel">
        <div class="flexibility-panel-head"><div><h3>Renewable performance</h3><p>Solar generation and modeled onsite utilization.</p></div><span v-if="result" class="flexibility-live">OBSERVED PROFILE</span></div>
        <div v-if="!result" class="flexibility-empty"><span>☀</span><b>Awaiting telemetry analysis</b><p>Solar generation is sourced from meters classified as solar. Register solar meters and ingest readings to unlock renewable utilization metrics.</p></div>
        <template v-else-if="result.dataCoverage.hoursWithLoad===0 && result.dataCoverage.hoursWithSolar===0">
          <div class="flexibility-empty"><span>!</span><b>No eligible telemetry</b><p>No valid main, submeter, or solar readings were found in the selected history window.</p></div>
        </template>
        <template v-else>
          <div class="flexibility-kpis">
            <div><small>SOLAR GENERATION / DAY</small><strong>{{number(result.renewable.dailyGenerationKwh)}} <i>kWh</i></strong><em>Average observed profile</em></div>
            <div><small>SOLAR SELF-CONSUMPTION</small><strong>{{number(result.renewable.selfConsumptionPercent)}} <i>%</i></strong><em>{{number(result.renewable.dailySelfConsumedKwh)}} kWh used onsite</em></div>
            <div><small>ESTIMATED SURPLUS</small><strong>{{number(result.renewable.dailyEstimatedExportKwh)}} <i>kWh</i></strong><em>Potential export proxy, not metered export</em></div>
          </div>
          <div class="flexibility-compare">
            <div><span>DEMAND RESPONSE / DAY</span><b>{{number(result.demandResponse.dailyCurtailedKwh)}} kWh</b></div>
            <div><span>POST-EVENT GRID IMPORT</span><b>{{number(result.demandResponse.dailyPostEventGridImportKwh)}} kWh</b></div>
            <div><span>ESTIMATED EVENT INCENTIVE</span><b>{{number(result.demandResponse.estimatedIncentive,2)}}</b></div>
            <div><span>AVOIDED EMISSIONS / DAY</span><b>{{number(result.emissions.dailyAvoidedKgCo2e)}} kg CO₂e</b></div>
            <div><span>ANNUALIZED AVOIDED EMISSIONS</span><b>{{number(result.emissions.annualizedAvoidedTonnesCo2e,3)}} t CO₂e</b></div>
            <div><span>SOLAR COVERAGE OF LOAD</span><b>{{number(result.renewable.solarCoveragePercent)}}%</b></div>
          </div>
          <div class="flexibility-schedule">
            <div class="flexibility-panel-head"><div><h3>Hourly energy profile</h3><p>Facility load vs solar generation · UTC</p></div></div>
            <div class="flexibility-bars">
              <div v-for="item in result.schedule" :key="item.hourUtc" class="flexibility-hour" :title="hourLabel(item.hourUtc)+': load '+number(item.loadKwh)+' kWh · solar '+number(item.solarGenerationKwh)+' kWh'">
                <div class="flexibility-track"><i class="flexibility-load" :style="{height:(item.loadKwh/maxBar*100)+'%'}"></i><i class="flexibility-solar" :style="{height:(item.solarGenerationKwh/maxBar*100)+'%'}"></i></div>
                <small v-if="item.hourUtc%3===0">{{String(item.hourUtc).padStart(2,'0')}}</small>
              </div>
            </div>
            <div class="flexibility-legend"><span><i></i> Facility load</span><span><i></i> Solar generation</span></div>
          </div>
          <div class="flexibility-coverage"><b>{{result.dataCoverage.observedDays}} observed days</b><span>{{result.dataCoverage.hoursWithLoad}} load hours ({{result.dataCoverage.observedLoadDays}} days) · {{result.dataCoverage.hoursWithSolar}} solar hours ({{result.dataCoverage.observedSolarDays}} days) · {{result.dataCoverage.loadSource}} load source</span></div>
          <p class="flexibility-assumptions"><b>MODEL ASSUMPTIONS</b><span v-for="(value,key) in result.assumptions" :key="key">{{value}}</span></p>
        </template>
      </article>
    </div>
    <p class="flexibility-disclaimer"><b>PLANNING ESTIMATES</b><span>Solar self-consumption and surplus exports are inferred from hourly load/generation profiles, not measured at a bidirectional grid meter. Demand response is a percentage-based scenario, not a verified flexible-load commitment. Emissions use the configured factor. Incentives are illustrative and exclude program qualification, baselines, penalties, taxes and settlement rules. UTC event hours are used. No equipment is controlled.</span></p>
  </section>
</template>
