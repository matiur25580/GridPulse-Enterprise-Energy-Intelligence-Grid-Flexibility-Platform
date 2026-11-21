<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { intelligenceApi, type EnergyIntelligence } from './services/api'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])
const props = defineProps<{ organizationId: string }>()
const historyDays = ref(30)
const horizonDays = ref(7)
const result = ref<EnergyIntelligence | null>(null)
const loading = ref(false)
const error = ref('')
const updatedAt = ref('')
const format = (value: number, digits = 1) => Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
const chartData = computed(() => {
  const history = result.value?.history ?? []
  const forecast = result.value?.forecast.forecast ?? []
  const labels = [...history.map(x => x.date), ...forecast.map(x => x.date)]
  const actual = [...history.map(x => x.energyKwh), ...forecast.map(() => null)]
  const predicted = [...history.map(() => null), ...(forecast.length ? [history.length ? history[history.length - 1].energyKwh : null, ...forecast.map(x => x.energyKwh)] : [])]
  const lower = [...history.map(() => null), ...(forecast.length ? [history.length ? history[history.length - 1].energyKwh : null, ...forecast.map(x => x.lowerKwh)] : [])]
  const upper = [...history.map(() => null), ...(forecast.length ? [history.length ? history[history.length - 1].energyKwh : null, ...forecast.map(x => x.upperKwh)] : [])]
  const allLabels = forecast.length ? [...labels.slice(0, history.length), ...(history.length ? [history[history.length - 1].date] : []), ...forecast.map(x => x.date)] : labels
  return { labels: allLabels, actual: forecast.length && history.length ? [...actual.slice(0, history.length - 1), history[history.length - 1].energyKwh, ...actual.slice(history.length)] : actual, predicted, lower, upper }
})
const forecastOption = computed(() => ({
  tooltip: { trigger: 'axis', valueFormatter: (v: number | null) => v == null ? '—' : format(v, 2) + ' kWh' },
  legend: { top: 0, textStyle: { color: '#9aadb5', fontSize: 10 } },
  grid: { left: 10, right: 16, top: 34, bottom: 8, containLabel: true },
  xAxis: { type: 'category', data: chartData.value.labels, axisLabel: { color: '#8fa5af', fontSize: 9, hideOverlap: true }, axisLine: { lineStyle: { color: '#29414c' } } },
  yAxis: { type: 'value', name: 'kWh', nameTextStyle: { color: '#8fa5af' }, axisLabel: { color: '#8fa5af', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(176,204,210,.09)' } } },
  series: [
    { name: 'Observed', type: 'line', data: chartData.value.actual, smooth: true, symbolSize: 4, lineStyle: { width: 2, color: '#a3e635' }, itemStyle: { color: '#a3e635' } },
    { name: 'Forecast', type: 'line', data: chartData.value.predicted, smooth: true, symbolSize: 5, lineStyle: { width: 3, type: 'dashed', color: '#58c7d8' }, itemStyle: { color: '#58c7d8' } },
    { name: 'Upper estimate', type: 'line', data: chartData.value.upper, symbol: 'none', lineStyle: { width: 1, type: 'dotted', color: '#58c7d877' } },
    { name: 'Lower estimate', type: 'line', data: chartData.value.lower, symbol: 'none', lineStyle: { width: 1, type: 'dotted', color: '#58c7d877' } },
  ],
}))
async function load() {
  if (!props.organizationId) { result.value = null; return }
  loading.value = true
  error.value = ''
  try {
    result.value = await intelligenceApi.overview(props.organizationId, historyDays.value, horizonDays.value)
    updatedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to load energy intelligence.'
    result.value = null
  } finally { loading.value = false }
}
watch(() => props.organizationId, () => void load())
watch([historyDays, horizonDays], () => void load())
onMounted(load)
</script>

<template>
  <section class="intelligence-module">
    <div class="intelligence-heading">
      <div><label class="eyebrow">PREDICTIVE OPERATIONS</label><h2>Energy intelligence</h2><p>Understand recent consumption, anticipate demand and investigate unusual meter behavior.</p></div>
      <div class="intelligence-controls">
        <label>History <select v-model.number="historyDays"><option :value="7">7 days</option><option :value="14">14 days</option><option :value="30">30 days</option><option :value="60">60 days</option><option :value="90">90 days</option></select></label>
        <label>Forecast <select v-model.number="horizonDays"><option :value="1">1 day</option><option :value="3">3 days</option><option :value="7">7 days</option><option :value="14">14 days</option></select></label>
        <button class="asset-refresh" @click="load" :disabled="loading">{{ loading ? 'Loading…' : '↻ Refresh' }}</button>
      </div>
    </div>
    <div v-if="error" class="asset-message asset-error" role="alert">{{ error }} <button @click="load">Retry</button></div>
    <div v-else-if="loading && !result" class="intelligence-state">Calculating organization forecast and scanning meter history…</div>
    <template v-if="result">
      <div class="intelligence-kpis">
        <article class="intelligence-kpi"><span>BASELINE DAILY ENERGY</span><strong>{{ format(result.forecast.baselineDailyKwh, 2) }} <small>kWh/day</small></strong><p>Trailing seven-day average</p></article>
        <article class="intelligence-kpi"><span>DAILY TREND</span><strong>{{ result.forecast.dailyTrendKwh > 0 ? '+' : '' }}{{ format(result.forecast.dailyTrendKwh, 3) }} <small>kWh/day</small></strong><p>Linear trend, capped at ±15% of baseline</p></article>
        <article class="intelligence-kpi"><span>ANOMALIES DETECTED</span><strong>{{ result.anomalySummary.count }} <small>events</small></strong><p>{{ result.anomalySummary.high }} high · {{ result.anomalySummary.medium }} medium severity</p></article>
        <article class="intelligence-kpi"><span>FORECAST HORIZON</span><strong>{{ result.forecast.forecast.length }} <small>days</small></strong><p>{{ result.forecast.historyCount }} observed daily totals</p></article>
      </div>
      <article class="intelligence-panel">
        <div class="intelligence-panel-head"><div><h3>Observed consumption &amp; forecast</h3><p>Daily portfolio energy · UTC aggregation · estimated band shown as dotted bounds</p></div><span class="intelligence-updated">UPDATED {{ updatedAt }}</span></div>
        <VChart v-if="result.history.length || result.forecast.forecast.length" class="intelligence-chart" :option="forecastOption" autoresize />
        <div v-else class="intelligence-state">Not enough telemetry to plot a forecast. Ingest valid or estimated readings to begin.</div>
        <p class="intelligence-method">{{ result.forecast.methodology }}</p>
      </article>
      <article class="intelligence-panel">
        <div class="intelligence-panel-head"><div><h3>Consumption anomaly review</h3><p>Meter-level outliers compared with up to 14 preceding observed days</p></div><span class="anomaly-count">{{ result.anomalies.length }} CANDIDATES</span></div>
        <div v-if="!result.anomalies.length" class="intelligence-state">No consumption anomalies were detected in the available history. This is not a guarantee that all operating issues are absent.</div>
        <div v-else class="anomaly-table-wrap"><table class="anomaly-table"><thead><tr><th>DATE</th><th>METER</th><th>OBSERVED</th><th>BASELINE</th><th>THRESHOLD</th><th>DEVIATION</th><th>SEVERITY</th></tr></thead><tbody>
          <tr v-for="(item, index) in result.anomalies" :key="item.meterId + item.date + index"><td>{{ item.date }}</td><td><b>{{ item.meter?.name ?? 'Meter unavailable' }}</b><small>{{ item.meter?.serialNumber ?? item.meterId }}</small></td><td>{{ format(item.energyKwh, 2) }} kWh</td><td>{{ format(item.baselineKwh, 2) }} kWh</td><td>{{ format(item.thresholdKwh, 2) }} kWh</td><td>{{ format(item.deviationRatio, 2) }}×</td><td><span class="severity-pill" :class="item.severity">{{ item.severity }}</span></td></tr>
        </tbody></table></div>
        <p class="intelligence-method">Anomaly candidates use a rolling median and median absolute deviation (MAD). Review against schedules, weather, production and meter quality before acting.</p>
      </article>
      <div class="intelligence-disclaimer"><b>MODEL TRANSPARENCY</b><span>{{ result.forecast.model }} · {{ result.dataQuality.included }} readings included; {{ result.dataQuality.excluded }} excluded. Forecast bounds are heuristic estimates, not calibrated confidence intervals or guaranteed outcomes.</span></div>
    </template>
    <div v-else-if="!loading && !error" class="intelligence-state">Select an organization to view its energy intelligence.</div>
  </section>
</template>
