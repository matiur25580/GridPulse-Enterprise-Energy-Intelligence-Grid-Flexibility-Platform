<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { reportingApi, type EnergyReport } from './services/api'

const props = defineProps<{ organizationId: string }>()
const today = new Date()
const toDate = ref(today.toISOString().slice(0, 10))
const fromDate = ref(new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10))
const emissionFactor = ref(0.4)
const report = ref<EnergyReport | null>(null)
const loading = ref(false)
const error = ref('')
const fmt = (value: number | null | undefined, digits = 2) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits })
const maxDaily = computed(() => Math.max(1, ...(report.value?.daily.map((item) => item.energyKwh) ?? [])))
const periodLabel = computed(() => report.value ? new Date(report.value.range.from).toLocaleDateString() + ' — ' + new Date(report.value.range.to).toLocaleDateString() : '')
const generatedLabel = computed(() => report.value ? new Date(report.value.generatedAt).toLocaleString() : '')

async function generateReport() {
  if (!props.organizationId) return
  loading.value = true
  error.value = ''
  try {
    report.value = await reportingApi.energy(props.organizationId, new Date(fromDate.value + 'T00:00:00.000Z').toISOString(), new Date(toDate.value + 'T23:59:59.999Z').toISOString(), emissionFactor.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to generate the energy report.'
    report.value = null
  } finally { loading.value = false }
}
function csvCell(value: unknown) {
  let text = value == null ? '' : String(value)
  if (typeof value === 'string' && (['=', '+', '-', '@', '\\t', '\\r'].some((prefix) => text.startsWith(prefix)))) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
function downloadCsv() {
  if (!report.value) return
  const rows: unknown[][] = [
    ['GridPulse energy report', report.value.organization.name],
    ['Period UTC', report.value.range.from, report.value.range.to],
    ['Generated at', report.value.generatedAt],
    [],
    ['SUMMARY', 'VALUE', 'UNIT'],
    ['Total energy', report.value.summary.totalEnergyKwh, 'kWh'],
    ['Average daily energy', report.value.summary.averageDailyEnergyKwh, 'kWh/day'],
    ['Peak demand', report.value.summary.peakDemandKw, 'kW'],
    ['Average power factor', report.value.summary.averagePowerFactor, 'ratio'],
    ['Included readings', report.value.summary.includedReadings, 'count'],
    ['Estimated readings', report.value.summary.estimatedReadings, 'count'],
    ['Flagged readings excluded', report.value.summary.flaggedReadings, 'count'],
    ['Estimated emissions', report.value.emissions.estimatedKgCo2e, 'kg CO2e'],
    ['Grid emissions factor', report.value.emissions.gridEmissionFactorKgPerKwh, 'kg CO2e/kWh'],
    [],
    ['DAILY', 'DATE', 'ENERGY KWH', 'PEAK DEMAND KW', 'READINGS'],
    ...report.value.daily.map((item) => ['Daily', item.date, item.energyKwh, item.peakDemandKw, item.readingCount]),
    [],
    ['FACILITY', 'CODE', 'ENERGY KWH', 'PEAK DEMAND KW', 'READINGS'],
    ...report.value.facilities.map((item) => [item.name, item.code, item.energyKwh, item.peakDemandKw, item.readingCount]),
    [],
    ['METER', 'SERIAL', 'TYPE', 'QUALITY', 'ENERGY KWH', 'READINGS'],
    ...report.value.meters.map((item) => [item.meterName, item.serialNumber, item.meterType, item.quality, item.energyKwh, item.readingCount]),
    [],
    ['DATA QUALITY', 'READINGS', 'ENERGY KWH'],
    ...Object.entries(report.value.dataQuality.byQuality).map(([quality, item]) => [quality, item.readingCount, item.energyKwh]),
    [],
    ['METHODOLOGY', report.value.emissions.methodology],
    ['DATA POLICY', report.value.dataQuality.included + '; ' + report.value.dataQuality.flagged],
  ]
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'gridpulse-energy-report-' + fromDate.value + '-to-' + toDate.value + '.csv'
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
}
function escapeHtml(value: unknown) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character] ?? character)
}
function printPdf() {
  if (!report.value) return
  const data = report.value
  const rows = data.daily.map((item) => '<tr><td>' + escapeHtml(item.date) + '</td><td>' + fmt(item.energyKwh) + '</td><td>' + fmt(item.peakDemandKw) + '</td><td>' + item.readingCount + '</td></tr>').join('')
  const sites = data.facilities.map((item) => '<tr><td>' + escapeHtml(item.name) + '</td><td>' + escapeHtml(item.code) + '</td><td>' + fmt(item.energyKwh) + '</td><td>' + fmt(item.peakDemandKw) + '</td></tr>').join('')
  const meters = data.meters.map((item) => '<tr><td>' + escapeHtml(item.meterName) + '</td><td>' + escapeHtml(item.serialNumber) + '</td><td>' + escapeHtml(item.meterType) + '</td><td>' + escapeHtml(item.quality) + '</td><td>' + fmt(item.energyKwh) + '</td></tr>').join('')
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) { error.value = 'Allow pop-ups to print or save the PDF report.'; return }
  win.document.write(`<!doctype html><html><head><title>GridPulse Energy Report</title><style>
    body{font:12px Arial,sans-serif;color:#17252d;margin:34px}h1{font-size:24px;margin:0 0 6px}h2{font-size:15px;margin:25px 0 9px}p{color:#53656d;line-height:1.5}.meta{font-size:10px;color:#647780}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.kpi{border:1px solid #d9e1e5;padding:12px;border-radius:6px}.kpi small{display:block;color:#63747b;font-size:9px;text-transform:uppercase}.kpi b{display:block;font-size:19px;margin-top:8px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:7px;border-bottom:1px solid #e2e8eb;text-align:left}th{background:#f1f5f6}.note{font-size:9px;color:#5e7078;margin-top:22px}@media print{body{margin:14mm}.kpi{break-inside:avoid}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}
  </style></head><body><h1>GridPulse · Energy Performance Report</h1><p>${escapeHtml(data.organization.name)}<br>Reporting period (UTC): ${escapeHtml(periodLabel.value)}<br>Generated: ${escapeHtml(generatedLabel.value)}</p>
  <div class="kpis"><div class="kpi"><small>Total energy</small><b>${fmt(data.summary.totalEnergyKwh)} kWh</b></div><div class="kpi"><small>Average daily energy</small><b>${fmt(data.summary.averageDailyEnergyKwh)} kWh</b></div><div class="kpi"><small>Peak demand</small><b>${fmt(data.summary.peakDemandKw)} kW</b></div><div class="kpi"><small>Estimated emissions</small><b>${fmt(data.emissions.estimatedKgCo2e)} kg CO₂e</b></div></div>
  <p>Included readings: ${data.summary.includedReadings} · Estimated readings: ${data.summary.estimatedReadings} · Flagged readings excluded: ${data.summary.flaggedReadings} · Average power factor: ${fmt(data.summary.averagePowerFactor,4)}</p>
  <h2>Daily performance</h2><table><thead><tr><th>Date (UTC)</th><th>Energy kWh</th><th>Peak kW</th><th>Readings</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No readings for this period.</td></tr>'}</tbody></table>
  <h2>Facility performance</h2><table><thead><tr><th>Facility</th><th>Code</th><th>Energy kWh</th><th>Peak kW</th></tr></thead><tbody>${sites || '<tr><td colspan="4">No facility data.</td></tr>'}</tbody></table>
  <h2>Meter and quality detail</h2><table><thead><tr><th>Meter</th><th>Serial</th><th>Type</th><th>Quality</th><th>Energy kWh</th></tr></thead><tbody>${meters || '<tr><td colspan="5">No meter data.</td></tr>'}</tbody></table>
  <p class="note">Emissions are indicative: included electricity consumption × configured grid emissions factor (${data.emissions.gridEmissionFactorKgPerKwh} kg CO₂e/kWh). ${escapeHtml(data.emissions.methodology)} Flagged readings are excluded from consumption, demand and emissions totals. This operational report is not a verified greenhouse-gas inventory, financial statement, or regulatory compliance attestation.</p>
  <script>window.onload=()=>window.print()<\/script></body></html>`)
  win.document.close()
}
watch(() => props.organizationId, () => { report.value = null; error.value = '' })
</script>

<template>
  <section class="reporting-module" id="reports">
    <div class="reporting-heading"><div><label class="eyebrow">PERFORMANCE &amp; SUSTAINABILITY</label><h2>Enterprise energy reports</h2><p>Generate organization-scoped operational reports with daily, facility, meter, data-quality and indicative emissions detail.</p></div><span class="reporting-status">AUDIT-READY DATA DETAIL</span></div>
    <article class="reporting-panel">
      <form class="reporting-controls" @submit.prevent="generateReport">
        <label>Report from<input v-model="fromDate" type="date" required :max="toDate"></label>
        <label>Report to<input v-model="toDate" type="date" required :min="fromDate"></label>
        <label>Grid emissions factor<input v-model.number="emissionFactor" type="number" min="0" max="5" step="0.001" required><small>kg CO₂e per kWh</small></label>
        <button type="submit" :disabled="loading || !organizationId">{{loading ? 'Generating…' : 'Generate report →'}}</button>
      </form>
      <p v-if="error" class="reporting-error" role="alert">{{error}}</p>
    </article>
    <template v-if="report">
      <div class="reporting-result-head"><div><b>{{report.organization.name}}</b><span>{{periodLabel}} · UTC · Generated {{generatedLabel}}</span></div><div class="reporting-actions"><button type="button" @click="downloadCsv">↓ Export CSV</button><button type="button" @click="printPdf">↗ Print / Save PDF</button></div></div>
      <div class="reporting-kpis">
        <article><small>TOTAL ENERGY</small><strong>{{fmt(report.summary.totalEnergyKwh)}} <i>kWh</i></strong><span>{{fmt(report.summary.averageDailyEnergyKwh)}} kWh average / day</span></article>
        <article><small>PEAK DEMAND</small><strong>{{fmt(report.summary.peakDemandKw)}} <i>kW</i></strong><span>Maximum measured interval demand</span></article>
        <article><small>ESTIMATED EMISSIONS</small><strong>{{fmt(report.emissions.estimatedKgCo2e)}} <i>kg CO₂e</i></strong><span>Factor: {{report.emissions.gridEmissionFactorKgPerKwh}} kg/kWh</span></article>
        <article><small>READING QUALITY</small><strong>{{fmt(report.summary.includedReadings,0)}} <i>included</i></strong><span>{{report.summary.flaggedReadings}} flagged excluded · {{report.summary.estimatedReadings}} estimated</span></article>
      </div>
      <article class="reporting-panel"><div class="reporting-section-head"><div><h3>Daily energy performance</h3><p>Measured and estimated readings · UTC</p></div><b>{{report.daily.length}} days</b></div>
        <div v-if="report.daily.length" class="reporting-bars"><div v-for="item in report.daily" :key="item.date" class="reporting-day" :title="item.date+': '+fmt(item.energyKwh)+' kWh'"><i :style="{height:(item.energyKwh/maxDaily*100)+'%'}"></i><small>{{item.date.slice(5)}}</small></div></div><div v-else class="reporting-empty">No energy readings were recorded in this reporting period.</div>
      </article>
      <div class="reporting-tables">
        <article class="reporting-panel"><div class="reporting-section-head"><div><h3>Facility performance</h3><p>Ranked by included energy consumption</p></div></div><div class="reporting-table-wrap"><table><thead><tr><th>Facility</th><th>Energy kWh</th><th>Peak kW</th></tr></thead><tbody><tr v-for="item in report.facilities" :key="item.facilityId"><td><b>{{item.name}}</b><small>{{item.code}}</small></td><td>{{fmt(item.energyKwh)}}</td><td>{{fmt(item.peakDemandKw)}}</td></tr><tr v-if="!report.facilities.length"><td colspan="3">No facility data.</td></tr></tbody></table></div></article>
        <article class="reporting-panel"><div class="reporting-section-head"><div><h3>Meter quality detail</h3><p>Energy grouped by meter and reading quality</p></div></div><div class="reporting-table-wrap"><table><thead><tr><th>Meter</th><th>Quality</th><th>kWh</th></tr></thead><tbody><tr v-for="(item,index) in report.meters" :key="item.meterId+item.quality"><td><b>{{item.meterName}}</b><small>{{item.serialNumber}} · {{item.meterType}}</small></td><td>{{item.quality}}</td><td>{{fmt(item.energyKwh)}}</td></tr><tr v-if="!report.meters.length"><td colspan="3">No meter data.</td></tr></tbody></table></div></article>
      </div>
      <article class="reporting-panel reporting-quality"><div class="reporting-section-head"><div><h3>Reporting methodology &amp; data quality</h3><p>Traceable assumptions for internal review</p></div></div><p>{{report.dataQuality.included}} are included in energy, demand and emissions totals. {{report.dataQuality.flagged}}.</p><p>{{report.emissions.methodology}}</p><div class="reporting-quality-counts"><span v-for="(item,quality) in report.dataQuality.byQuality" :key="quality"><b>{{quality}}</b>{{item.readingCount}} readings · {{fmt(item.energyKwh)}} kWh</span></div><small>Report ID: {{report.organization.id}} · {{report.range.from}} — {{report.range.to}}</small></article>
    </template>
    <div v-else class="reporting-empty reporting-placeholder"><span>▤</span><b>Your reporting workspace is ready</b><p>Select a date range and generate a report. Export the result as CSV or use your browser's print dialog to save a PDF.</p></div>
    <p class="reporting-disclaimer">Emissions are indicative calculations using the configured factor. This report is designed for operational management and internal review; it is not a verified GHG inventory, audited financial statement, or regulatory compliance certificate.</p>
  </section>
</template>
