<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { billingApi, type BillingFacility, type EnergyBill, type TariffPlan } from './services/api'

const props = defineProps<{ organizationId: string; role: string }>()
const facilities = ref<BillingFacility[]>([])
const tariffs = ref<TariffPlan[]>([])
const bills = ref<EnergyBill[]>([])
const selectedFacilityId = ref('')
const selectedTariffId = ref('')
const selectedBill = ref<EnergyBill | null>(null)
const from = ref(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const loading = ref(false)
const savingTariff = ref(false)
const estimating = ref(false)
const error = ref('')
const success = ref('')
const showTariffForm = ref(false)
const name = ref('Commercial time-of-use')
const currency = ref('INR')
const defaultRate = ref(8)
const peakRate = ref(12)
const peakHours = ref('18,19,20,21')
const peakDays = ref('0,1,2,3,4,5,6')
const offPeakRate = ref(5)
const offPeakHours = ref('0,1,2,3,4,5')
const offPeakDays = ref('0,1,2,3,4,5,6')
const demandRate = ref(0)
const fixedCharge = ref(0)
const taxRate = ref(0)
const effectiveFrom = ref(new Date().toISOString().slice(0, 10))
const effectiveTo = ref('')

const canManage = computed(() => ['owner', 'admin', 'operator'].includes(props.role))
const canEstimate = computed(() => ['owner', 'admin', 'operator', 'analyst'].includes(props.role))
const facilityName = computed(() => facilities.value.find((item) => item._id === selectedFacilityId.value)?.name ?? '')
const formatMoney = (amount: number | null | undefined, code = selectedBill.value?.currency ?? currency.value) => {
  if (amount == null) return '—'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(amount) }
  catch { return code + ' ' + amount.toFixed(2) }
}
const formatNumber = (amount: number | null | undefined, digits = 2) => amount == null ? '—' : amount.toLocaleString(undefined, { maximumFractionDigits: digits })
const periodLabel = (bill: EnergyBill) => bill.periodStart.slice(0, 10) + ' – ' + bill.periodEnd.slice(0, 10)

async function loadWorkspace() {
  if (!props.organizationId) return
  loading.value = true; error.value = ''
  try {
    facilities.value = await billingApi.facilities(props.organizationId)
    if (!selectedFacilityId.value || !facilities.value.some((item) => item._id === selectedFacilityId.value)) selectedFacilityId.value = facilities.value[0]?._id ?? ''
    await loadFacilityData()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to load billing workspace.' }
  finally { loading.value = false }
}
async function loadFacilityData() {
  if (!props.organizationId || !selectedFacilityId.value) { tariffs.value = []; bills.value = []; selectedTariffId.value = ''; return }
  const [tariffData, billData] = await Promise.all([
    billingApi.tariffs(props.organizationId, selectedFacilityId.value),
    billingApi.bills(props.organizationId, selectedFacilityId.value),
  ])
  tariffs.value = tariffData
  bills.value = billData
  if (!tariffs.value.some((item) => item._id === selectedTariffId.value)) selectedTariffId.value = tariffs.value.find((item) => item.status === 'active')?._id ?? ''
  if (selectedBill.value && !bills.value.some((item) => item._id === selectedBill.value?._id)) selectedBill.value = null
}
watch(() => props.organizationId, () => { facilities.value = []; tariffs.value = []; bills.value = []; selectedBill.value = null; selectedFacilityId.value = ''; loadWorkspace() })
watch(selectedFacilityId, () => { selectedBill.value = null; loadFacilityData().catch((cause) => { error.value = cause instanceof Error ? cause.message : 'Unable to load facility billing data.' }) })
onMounted(loadWorkspace)

function parseHours(value: string) {
  if (!value.trim()) return []
  const parsed = value.split(',').map((part) => Number(part.trim()))
  if (parsed.some((hour) => !Number.isInteger(hour) || hour < 0 || hour > 23)) return []
  return [...new Set(parsed)]
}
function parseDays(value: string) {
  if (!value.trim()) return []
  const parsed = value.split(',').map((part) => Number(part.trim()))
  if (parsed.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return []
  return [...new Set(parsed)]
}
async function saveTariff() {
  error.value = ''; success.value = ''
  const peak = parseHours(peakHours.value)
  const offPeak = parseHours(offPeakHours.value)
  const peakWeekdays = parseDays(peakDays.value)
  const offPeakWeekdays = parseDays(offPeakDays.value)
  if (!selectedFacilityId.value || !name.value.trim()) { error.value = 'Choose a facility and enter a tariff name.'; return }
  if (peak.some((hour) => offPeak.includes(hour))) { error.value = 'Peak and off-peak hours cannot overlap.'; return }
  if (peakHours.value.trim() && !peak.length || offPeakHours.value.trim() && !offPeak.length) { error.value = 'Enter valid comma-separated hours from 0 to 23.'; return }
  if (peakDays.value.trim() && !peakWeekdays.length || offPeakDays.value.trim() && !offPeakWeekdays.length) { error.value = 'Enter valid comma-separated weekdays from 0 (Sunday) to 6 (Saturday).'; return }
  savingTariff.value = true
  try {
    const energyRates = [
      ...(peak.length ? [{ label: 'Peak', ratePerKwh: peakRate.value, hours: peak, daysOfWeek: peakWeekdays }] : []),
      ...(offPeak.length ? [{ label: 'Off-peak', ratePerKwh: offPeakRate.value, hours: offPeak, daysOfWeek: offPeakWeekdays }] : []),
    ]
    const created = await billingApi.createTariff(props.organizationId, {
      facilityId: selectedFacilityId.value, name: name.value.trim(), currency: currency.value,
      defaultRatePerKwh: defaultRate.value, energyRates, demandChargePerKw: demandRate.value,
      fixedCharge: fixedCharge.value, taxRatePercent: taxRate.value,
      effectiveFrom: effectiveFrom.value, effectiveTo: effectiveTo.value || null,
    })
    tariffs.value = [created, ...tariffs.value]
    selectedTariffId.value = created._id
    showTariffForm.value = false
    success.value = 'Tariff version created. Existing tariff versions were preserved.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to create tariff.' }
  finally { savingTariff.value = false }
}
async function generateEstimate() {
  error.value = ''; success.value = ''
  if (!selectedFacilityId.value || !selectedTariffId.value) { error.value = 'Select a facility and tariff before estimating.'; return }
  if (from.value > to.value) { error.value = 'Billing start must be before billing end.'; return }
  estimating.value = true
  try {
    selectedBill.value = await billingApi.estimate(props.organizationId, { facilityId: selectedFacilityId.value, tariffId: selectedTariffId.value, from: from.value, to: to.value })
    await loadFacilityData()
    success.value = 'Bill estimate generated and saved to the billing history.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to calculate the bill estimate.' }
  finally { estimating.value = false }
}
function exportCsv(bill: EnergyBill) {
  const rows: unknown[][] = [
    ['GridPulse estimated energy bill'],
    ['Facility', bill.facility.name], ['Tariff', bill.tariff.name],
    ['Period', periodLabel(bill)], ['Currency', bill.currency], ['Status', 'ESTIMATE — NOT A UTILITY INVOICE'],
    [],
    ['CHARGE', 'AMOUNT', 'CURRENCY'],
    ...bill.charges.map((item) => [item.label, item.amount, bill.currency]),
    ['Total estimated bill', bill.summary.total, bill.currency],
    [],
    ['DAILY BREAKDOWN', 'ENERGY KWH', 'ENERGY CHARGE', 'PEAK DEMAND KW', 'READINGS'],
    ...bill.daily.map((item) => [item.date, item.energyKwh, item.energyCharge, item.demandKw, item.readingCount]),
    [],
    ['COMPARISON', 'VALUE'],
    ['Previous comparable estimate', bill.comparison?.previousEstimatedCost ?? 'Unavailable'],
    ['Estimated cost change', bill.comparison?.estimatedCostChange ?? 'Unavailable'],
    ['Comparison basis', bill.comparison?.methodology ?? 'Insufficient prior-period telemetry'],
    [],
    ['DATA COVERAGE', 'VALUE'],
    ['Meter source', bill.coverage.meterSource], ['Observed hours', bill.coverage.observedHours],
    ['Observed days', bill.coverage.observedDays], ['Readings', bill.coverage.readingCount],
    ['Estimated-quality readings', bill.coverage.estimatedReadings], ['Timezone', bill.coverage.timezone],
    [],
    ['DISCLAIMER', 'Planning estimate from meter telemetry and configured tariff. Not a utility-issued or tax invoice.'],
  ]
  const csv = '\uFEFF' + rows.map((row) => row.map((value) => {
    let text = value == null ? '' : String(value)
    if (typeof value === 'string' && ['=', '+', '-', '@', '\t', '\r'].some((prefix) => text.startsWith(prefix))) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url
  anchor.download = 'gridpulse-bill-estimate-' + bill.periodStart.slice(0, 10) + '.csv'
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
}
</script>

<template>
  <section id="billing" class="billing-module">
    <div class="billing-heading"><div><label class="eyebrow">FINANCIAL INTELLIGENCE</label><h2>Tariffs &amp; energy cost intelligence</h2><p>Build facility-specific tariff versions, calculate transparent bill estimates and compare usage with the previous period.</p></div><span class="billing-status">COST ENGINE · V1</span></div>
    <article class="billing-panel">
      <div class="billing-toolbar">
        <label>Facility<select v-model="selectedFacilityId"><option value="">Select facility</option><option v-for="facility in facilities" :key="facility._id" :value="facility._id">{{facility.name}} · {{facility.code}}</option></select></label>
        <label>Tariff plan<select v-model="selectedTariffId"><option value="">Select tariff</option><option v-for="tariff in tariffs" :key="tariff._id" :value="tariff._id">{{tariff.name}} · {{tariff.currency}} · from {{tariff.effectiveFrom.slice(0,10)}}</option></select></label>
        <button v-if="canManage" type="button" @click="showTariffForm = !showTariffForm">{{showTariffForm ? 'Close tariff form' : '+ Create tariff version'}}</button>
      </div>
      <div v-if="showTariffForm && canManage" class="billing-tariff-form">
        <div class="billing-form-title"><div><b>New tariff version</b><p>Rates are applied using the facility's local timezone. A new later version automatically closes an open-ended previous version at the prior day.</p></div></div>
        <div class="billing-form-grid">
          <label>Tariff name<input v-model="name" maxlength="120"></label>
          <label>Currency<select v-model="currency"><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option><option>SGD</option><option>AUD</option><option>CAD</option><option>JPY</option></select></label>
          <label>Default rate / kWh<input v-model.number="defaultRate" type="number" min="0" step="0.001"></label>
          <label>Peak rate / kWh<input v-model.number="peakRate" type="number" min="0" step="0.001"></label>
          <label>Peak hours (0–23)<input v-model="peakHours" placeholder="18,19,20,21"></label>
          <label>Peak weekdays (0–6)<input v-model="peakDays" placeholder="1,2,3,4,5"></label>
          <label>Off-peak rate / kWh<input v-model.number="offPeakRate" type="number" min="0" step="0.001"></label>
          <label>Off-peak hours (0–23)<input v-model="offPeakHours" placeholder="0,1,2,3,4,5"></label>
          <label>Off-peak weekdays (0–6)<input v-model="offPeakDays" placeholder="0,1,2,3,4,5,6"></label>
          <label>Demand charge / kW<input v-model.number="demandRate" type="number" min="0" step="0.01"></label>
          <label>Fixed service charge<input v-model.number="fixedCharge" type="number" min="0" step="0.01"></label>
          <label>Tax / surcharge (%)<input v-model.number="taxRate" type="number" min="0" max="100" step="0.01"></label>
          <label>Effective from<input v-model="effectiveFrom" type="date" required></label>
          <label>Effective to (optional)<input v-model="effectiveTo" type="date"></label>
        </div>
        <p class="billing-hint">Unmatched hours use the default rate. Demand charges require actual kW telemetry. Tax is a configurable estimate, not a jurisdiction-specific tax calculation.</p>
        <button class="billing-primary" type="button" :disabled="savingTariff" @click="saveTariff">{{savingTariff ? 'Saving…' : 'Save tariff version →'}}</button>
      </div>
      <div v-if="canEstimate" class="billing-estimate-form">
        <div><b>Generate bill estimate</b><p>Use observed facility meter data and a tariff valid for the entire period.</p></div>
        <label>Period from<input v-model="from" type="date" :max="to"></label>
        <label>Period to<input v-model="to" type="date" :min="from"></label>
        <button class="billing-primary" :disabled="estimating || !selectedFacilityId || !selectedTariffId" @click="generateEstimate">{{estimating ? 'Calculating…' : 'Calculate estimate →'}}</button>
      </div>
      <p v-if="error" class="billing-error" role="alert">{{error}}</p><p v-if="success" class="billing-success" role="status">{{success}}</p>
      <p v-if="!facilities.length && !loading" class="billing-empty">Add an active facility and meter before setting up energy billing.</p>
      <p v-if="!tariffs.length && facilities.length" class="billing-empty">No tariff versions exist for this facility yet. {{canManage ? 'Create a tariff to begin cost calculations.' : 'Ask an organization administrator to configure a tariff.'}}</p>
    </article>
    <template v-if="selectedBill">
      <div class="billing-result-head"><div><b>{{selectedBill.facility.name}} · {{selectedBill.tariff.name}}</b><span>{{periodLabel(selectedBill)}} · {{selectedBill.coverage.timezone}} · ESTIMATE</span></div><button type="button" class="billing-export" @click="exportCsv(selectedBill)">↓ Export bill CSV</button></div>
      <div class="billing-kpis">
        <article><small>ESTIMATED BILL TOTAL</small><strong>{{formatMoney(selectedBill.summary.total,selectedBill.currency)}}</strong><span>Includes configured charges and tax</span></article>
        <article><small>ENERGY CONSUMPTION</small><strong>{{formatNumber(selectedBill.summary.totalEnergyKwh)}} <i>kWh</i></strong><span>Average rate {{formatNumber(selectedBill.summary.averageRatePerKwh,4)}} / kWh</span></article>
        <article><small>PEAK DEMAND</small><strong>{{formatNumber(selectedBill.summary.peakDemandKw)}} <i>kW</i></strong><span>{{formatMoney(selectedBill.summary.demandCharge,selectedBill.currency)}} demand charge</span></article>
        <article><small>ENERGY CHARGE</small><strong>{{formatMoney(selectedBill.summary.energyCharge,selectedBill.currency)}}</strong><span>{{selectedBill.summary.readingCount}} readings · {{selectedBill.summary.estimatedReadings}} estimated</span></article>
      </div>
      <div class="billing-detail-grid">
        <article class="billing-panel"><div class="billing-panel-head"><div><h3>Bill breakdown</h3><p>Transparent charge components</p></div><b>{{selectedBill.currency}}</b></div><div v-for="charge in selectedBill.charges" :key="charge.code" class="billing-charge"><span>{{charge.label}}</span><b>{{formatMoney(charge.amount,selectedBill.currency)}}</b></div><div class="billing-charge billing-subtotal"><span>Subtotal</span><b>{{formatMoney(selectedBill.summary.subtotal,selectedBill.currency)}}</b></div><div class="billing-charge"><span>Tax / surcharge ({{selectedBill.summary.taxRatePercent}}%)</span><b>{{formatMoney(selectedBill.summary.tax,selectedBill.currency)}}</b></div><div class="billing-charge billing-total"><span>Estimated total</span><b>{{formatMoney(selectedBill.summary.total,selectedBill.currency)}}</b></div></article>
        <article class="billing-panel"><div class="billing-panel-head"><div><h3>Period comparison</h3><p>Same tariff applied to previous equal-length period</p></div></div><template v-if="selectedBill.comparison"><div class="billing-compare-value"><small>PREVIOUS PERIOD ESTIMATE</small><strong>{{formatMoney(selectedBill.comparison.previousEstimatedCost,selectedBill.currency)}}</strong></div><div class="billing-compare-row"><span>Estimated cost change</span><b :class="selectedBill.comparison.estimatedCostChange > 0 ? 'billing-negative' : 'billing-positive'">{{formatMoney(selectedBill.comparison.estimatedCostChange,selectedBill.currency)}} <small>({{formatNumber(selectedBill.comparison.estimatedCostChangePercent)}}%)</small></b></div><div class="billing-compare-row"><span>Energy change</span><b>{{formatNumber(selectedBill.comparison.energyChangeKwh)}} kWh <small>({{formatNumber(selectedBill.comparison.energyChangePercent)}}%)</small></b></div><p class="billing-hint">{{selectedBill.comparison.methodology}}</p></template><p v-else class="billing-empty">Not enough previous-period telemetry to make a like-for-like comparison.</p></article>
      </div>
      <article class="billing-panel billing-daily"><div class="billing-panel-head"><div><h3>Daily cost and consumption</h3><p>Facility-local dates · measured demand where available</p></div><b>{{selectedBill.daily.length}} days</b></div><div class="billing-table-wrap"><table><thead><tr><th>Date</th><th>Energy kWh</th><th>Energy charge</th><th>Peak kW</th><th>Readings</th></tr></thead><tbody><tr v-for="day in selectedBill.daily" :key="day.date"><td>{{day.date}}</td><td>{{formatNumber(day.energyKwh)}}</td><td>{{formatMoney(day.energyCharge,selectedBill.currency)}}</td><td>{{formatNumber(day.demandKw)}}</td><td>{{day.readingCount}}</td></tr><tr v-if="!selectedBill.daily.length"><td colspan="5">No eligible readings in the selected period.</td></tr></tbody></table></div></article>
      <article class="billing-panel billing-insights"><div class="billing-panel-head"><div><h3>Cost optimization &amp; data coverage</h3><p>Actionable context, with assumptions exposed</p></div></div><p v-for="insight in selectedBill.insights" :key="insight">↗ {{insight}}</p><p v-if="!selectedBill.insights.length">No additional tariff or data-quality alerts for this estimate.</p><div class="billing-coverage"><span><b>{{selectedBill.coverage.observedHours}}</b> observed hour buckets</span><span><b>{{selectedBill.coverage.observedDays}}</b> observed days</span><span><b>{{selectedBill.coverage.meterSource}}</b> meter source</span><span><b>{{selectedBill.coverage.timezone}}</b> facility timezone</span></div><small>{{selectedBill.coverage.dataQuality}}. Generated {{new Date(selectedBill.generatedAt).toLocaleString()}}.</small></article>
    </template>
    <article class="billing-panel billing-history"><div class="billing-panel-head"><div><h3>Saved bill estimates</h3><p>Reusable calculation snapshots for this facility</p></div><b>{{bills.length}} records</b></div><div v-if="bills.length" class="billing-history-list"><button v-for="bill in bills" :key="bill._id" type="button" :class="{active:selectedBill?._id===bill._id}" @click="selectedBill=bill"><span><b>{{periodLabel(bill)}}</b><small>{{bill.tariff.name}} · {{bill.status.toUpperCase()}}</small></span><strong>{{formatMoney(bill.summary.total,bill.currency)}}</strong></button></div><p v-else class="billing-empty">Generated estimates will be saved here for later review.</p></article>
    <p class="billing-disclaimer">Billing estimates are calculated from valid and estimated telemetry using configured tariff inputs. Main-meter readings are preferred; submeters are used only when no eligible main-meter data exists. Demand charges require measured demand kW. This is not a utility-issued invoice, tax invoice, settlement statement, or guaranteed savings calculation.</p>
  </section>
</template>
