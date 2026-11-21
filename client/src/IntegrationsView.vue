<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { apiRequest, billingApi, integrationsApi, type BillingFacility, type MeterImportBatch, type TariffPlan, type UtilityInvoice } from './services/api'

const props = defineProps<{ organizationId: string; role: string }>()
type MeterOption = { _id: string; name: string; serialNumber: string; status: string; facility: string | { _id: string } }
const facilities = ref<BillingFacility[]>([])
const meters = ref<MeterOption[]>([])
const tariffs = ref<TariffPlan[]>([])
const batches = ref<MeterImportBatch[]>([])
const invoices = ref<UtilityInvoice[]>([])
const meterId = ref('')
const facilityId = ref('')
const tariffId = ref('')
const csvText = ref('')
const fileName = ref('meter-readings.csv')
const batchId = ref(crypto.randomUUID())
const invoiceNumber = ref('')
const supplier = ref('')
const from = ref(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 10))
const to = ref(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 0)).toISOString().slice(0, 10))
const currency = ref('INR')
const actualEnergy = ref('')
const actualAmount = ref('')
const actualDemand = ref('')
const tolerance = ref(2)
const loading = ref(false)
const importing = ref(false)
const reconciling = ref(false)
const error = ref('')
const success = ref('')
const latestReconciliation = ref<UtilityInvoice | null>(null)
const canImport = computed(() => ['owner', 'admin', 'operator'].includes(props.role))
const canReconcile = computed(() => ['owner', 'admin', 'operator', 'analyst'].includes(props.role))
const selectedTariff = computed(() => tariffs.value.find((item) => item._id === tariffId.value) ?? null)
const money = (value: number, code: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(value) }
  catch { return code + ' ' + value.toFixed(2) }
}
const varianceClass = (invoice: UtilityInvoice) => invoice.reconciliation.status === 'within_tolerance' ? 'integration-good' : 'integration-warn'

async function loadWorkspace() {
  if (!props.organizationId) return
  loading.value = true; error.value = ''
  try {
    const [facilityData, meterData, batchData, invoiceData] = await Promise.all([
      billingApi.facilities(props.organizationId),
      apiRequest<MeterOption[]>(`/organizations/${encodeURIComponent(props.organizationId)}/meters`),
      integrationsApi.imports(props.organizationId),
      integrationsApi.invoices(props.organizationId),
    ])
    facilities.value = facilityData
    meters.value = meterData
    batches.value = batchData
    invoices.value = invoiceData
    if (!facilityId.value || !facilities.value.some((item) => item._id === facilityId.value)) facilityId.value = facilities.value[0]?._id ?? ''
    if (!meterId.value || !meters.value.some((item) => item._id === meterId.value)) meterId.value = meters.value.find((item) => item.status === 'active')?._id ?? ''
    await loadFacilityTariffs()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to load integrations workspace.' }
  finally { loading.value = false }
}
async function loadFacilityTariffs() {
  if (!props.organizationId || !facilityId.value) { tariffs.value = []; tariffId.value = ''; return }
  tariffs.value = await billingApi.tariffs(props.organizationId, facilityId.value)
  if (!tariffs.value.some((item) => item._id === tariffId.value)) tariffId.value = tariffs.value.find((item) => item.status === 'active')?._id ?? ''
}
watch(() => props.organizationId, () => {
  facilities.value = []; meters.value = []; tariffs.value = []; batches.value = []; invoices.value = []
  meterId.value = ''; facilityId.value = ''; tariffId.value = ''; latestReconciliation.value = null
  void loadWorkspace()
})
watch(selectedTariff, (tariff) => { if (tariff) currency.value = tariff.currency })
watch(facilityId, () => {
  latestReconciliation.value = null
  if (selectedTariff.value) currency.value = selectedTariff.value.currency
  void loadFacilityTariffs().catch((cause) => { error.value = cause instanceof Error ? cause.message : 'Unable to load tariffs.' })
  if (props.organizationId) void integrationsApi.invoices(props.organizationId, facilityId.value).then((value) => { invoices.value = value }).catch((cause) => { error.value = cause instanceof Error ? cause.message : 'Unable to load invoices.' })
})
onMounted(loadWorkspace)

async function handleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 900_000) { error.value = 'Choose a CSV file smaller than 900 KB.'; return }
  fileName.value = file.name
  csvText.value = await file.text()
  batchId.value = crypto.randomUUID()
  error.value = ''; success.value = 'CSV loaded. Review the selected meter and import batch before submitting.'
}
function useTemplate() {
  csvText.value = 'externalId,recordedAt,energyKwh,demandKw,powerFactor,quality\nsite-meter-001,2026-11-01T10:00:00Z,124.75,48.2,0.96,valid'
  fileName.value = 'meter-readings-template.csv'
  batchId.value = crypto.randomUUID()
}
async function submitImport() {
  error.value = ''; success.value = ''
  if (!meterId.value || !csvText.value.trim()) { error.value = 'Select an active meter and load CSV content.'; return }
  if (!batchId.value.trim()) { error.value = 'An import batch ID is required.'; return }
  importing.value = true
  try {
    const result = await integrationsApi.importCsv(props.organizationId, meterId.value, { externalBatchId: batchId.value.trim(), fileName: fileName.value, csv: csvText.value })
    success.value = result.replayed ? 'This batch was already imported. No readings were duplicated.' : `Import complete: ${result.batch.inserted} inserted, ${result.batch.duplicates} duplicates.`
    batchId.value = crypto.randomUUID()
    const [newBatches] = await Promise.all([integrationsApi.imports(props.organizationId)])
    batches.value = newBatches
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'CSV import failed.' }
  finally { importing.value = false }
}
async function submitReconciliation() {
  error.value = ''; success.value = ''; latestReconciliation.value = null
  if (!facilityId.value || !tariffId.value || !invoiceNumber.value.trim() || !supplier.value.trim()) { error.value = 'Complete the facility, tariff, invoice number and supplier fields.'; return }
  if (!from.value || !to.value || from.value > to.value) { error.value = 'Choose a valid invoice period.'; return }
  if (!actualEnergy.value || !actualAmount.value || Number(actualEnergy.value) < 0 || Number(actualAmount.value) < 0) { error.value = 'Enter non-negative actual energy and invoice amount.'; return }
  if (selectedTariff.value && selectedTariff.value.currency !== currency.value) { error.value = 'Invoice currency must match the selected tariff currency.'; return }
  reconciling.value = true
  try {
    latestReconciliation.value = await integrationsApi.reconcileInvoice(props.organizationId, {
      facilityId: facilityId.value, tariffId: tariffId.value, invoiceNumber: invoiceNumber.value.trim(),
      supplier: supplier.value.trim(), from: from.value, to: to.value, currency: currency.value,
      actualEnergyKwh: Number(actualEnergy.value), actualAmount: Number(actualAmount.value),
      ...(actualDemand.value.trim() ? { actualDemandKw: Number(actualDemand.value) } : {}),
      tolerancePercent: tolerance.value,
    })
    invoices.value = [latestReconciliation.value, ...invoices.value.filter((item) => item._id !== latestReconciliation.value?._id)]
    success.value = 'Utility invoice recorded and reconciled against a fresh GridPulse estimate.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Invoice reconciliation failed.' }
  finally { reconciling.value = false }
}
</script>

<template>
  <section class="integrations-module">
    <div class="integrations-heading"><div><label class="eyebrow">DATA CONNECTIVITY</label><h2>Meter imports &amp; utility reconciliation</h2><p>Bring external meter files into the telemetry pipeline and check modeled bills against actual utility invoices.</p></div><button class="integration-refresh" @click="loadWorkspace" :disabled="loading">{{ loading ? 'Loading…' : '↻ Refresh' }}</button></div>
    <div v-if="error" class="integration-message integration-error" role="alert">{{ error }}</div>
    <div v-if="success" class="integration-message integration-success" role="status">{{ success }}</div>
    <div class="integration-grid">
      <article class="integration-panel">
        <div class="integration-panel-head"><div><h3>CSV meter ingestion</h3><p>Idempotent batches · maximum 1,000 readings · 900 KB</p></div><span class="integration-chip">TELEMETRY</span></div>
        <div v-if="canImport" class="integration-form">
          <label>Target meter<select v-model="meterId"><option value="">Select active meter</option><option v-for="meter in meters.filter(item=>item.status==='active')" :key="meter._id" :value="meter._id">{{ meter.name }} · {{ meter.serialNumber }}</option></select></label>
          <label>CSV file<input type="file" accept=".csv,text/csv" @change="handleFile"></label>
          <label>Batch ID<input v-model="batchId" maxlength="120"></label>
          <label>CSV content<textarea v-model="csvText" rows="7" placeholder="externalId,recordedAt,energyKwh,demandKw,powerFactor,quality&#10;meter-001,2026-11-01T10:00:00Z,124.75,48.2,0.96,valid"></textarea></label>
          <div class="integration-actions"><button class="integration-secondary" @click="useTemplate">Load example</button><button class="integration-primary" @click="submitImport" :disabled="importing || !meterId || !csvText.trim()">{{ importing ? 'Importing…' : '↥ Import readings' }}</button></div>
        </div>
        <div v-else class="integration-empty">Your organization role is read-only for meter imports.</div>
        <p class="integration-note">Required columns: externalId, recordedAt, energyKwh. Optional: demandKw, voltageV, currentA, powerFactor, quality. Timestamps must include a timezone. Reuse the same batch ID to safely retry a completed import.</p>
      </article>
      <article class="integration-panel">
        <div class="integration-panel-head"><div><h3>Utility invoice reconciliation</h3><p>Actual invoice vs modeled estimate · same tariff and period</p></div><span class="integration-chip">COST CONTROL</span></div>
        <div v-if="canReconcile" class="integration-form">
          <label>Facility<select v-model="facilityId"><option value="">Select facility</option><option v-for="facility in facilities" :key="facility._id" :value="facility._id">{{ facility.name }}</option></select></label>
          <label>Tariff version<select v-model="tariffId"><option value="">Select tariff</option><option v-for="tariff in tariffs" :key="tariff._id" :value="tariff._id">{{ tariff.name }} · {{ tariff.currency }}</option></select></label>
          <div class="integration-two"><label>Invoice number<input v-model.trim="invoiceNumber" maxlength="120"></label><label>Utility supplier<input v-model.trim="supplier" maxlength="160" placeholder="Electricity provider"></label></div>
          <div class="integration-two"><label>Period from<input v-model="from" type="date"></label><label>Period to<input v-model="to" type="date"></label></div>
          <div class="integration-two"><label>Currency<select v-model="currency"><option v-for="code in ['INR','USD','EUR','GBP','AED','SGD','AUD','CAD','JPY']" :key="code">{{ code }}</option></select></label><label>Variance tolerance (%)<input v-model.number="tolerance" type="number" min="0" max="25" step="0.1"></label></div>
          <div class="integration-two"><label>Actual invoice energy (kWh)<input v-model="actualEnergy" type="number" min="0" step="any"></label><label>Actual invoice total<input v-model="actualAmount" type="number" min="0" step="any"></label></div>
          <label>Actual billed peak demand (kW) · optional<input v-model="actualDemand" type="number" min="0" step="any"></label>
          <button class="integration-primary" @click="submitReconciliation" :disabled="reconciling || !facilityId || !tariffId">{{ reconciling ? 'Reconciling…' : 'Compare utility invoice' }}</button>
        </div>
        <div v-else class="integration-empty">Your organization role is read-only for invoice reconciliation.</div>
        <p class="integration-note">A discrepancy is flagged when the absolute amount variance exceeds your tolerance. This is an operational screening result, not a formal accounting adjustment or dispute filing.</p>
      </article>
    </div>
    <article v-if="latestReconciliation" class="integration-panel integration-result">
      <div class="integration-panel-head"><div><h3>Latest reconciliation · {{ latestReconciliation.invoiceNumber }}</h3><p>{{ latestReconciliation.supplier }} · {{ latestReconciliation.periodStart.slice(0,10) }} to {{ latestReconciliation.periodEnd.slice(0,10) }}</p></div><span class="integration-chip" :class="varianceClass(latestReconciliation)">{{ latestReconciliation.reconciliation.status.replace('_',' ').toUpperCase() }}</span></div>
      <div class="integration-kpis">
        <div><small>ACTUAL INVOICE</small><b>{{ money(latestReconciliation.reconciliation.actualAmount, latestReconciliation.currency) }}</b></div>
        <div><small>GRIDPULSE ESTIMATE</small><b>{{ money(latestReconciliation.reconciliation.estimatedAmount, latestReconciliation.currency) }}</b></div>
        <div><small>AMOUNT VARIANCE</small><b :class="latestReconciliation.reconciliation.amountVariance > 0 ? 'integration-warn' : 'integration-good'">{{ money(latestReconciliation.reconciliation.amountVariance, latestReconciliation.currency) }} <i>({{ latestReconciliation.reconciliation.amountVariancePercent ?? '—' }}%)</i></b></div>
        <div><small>ENERGY VARIANCE</small><b>{{ latestReconciliation.reconciliation.energyVarianceKwh.toLocaleString() }} kWh</b></div>
      </div>
      <p v-for="note in latestReconciliation.reconciliation.notes" :key="note" class="integration-note">{{ note }}</p>
    </article>
    <div class="integration-history-grid">
      <article class="integration-panel"><div class="integration-panel-head"><div><h3>Import batch history</h3><p>Auditable ingestion activity</p></div><b>{{ batches.length }} batches</b></div>
        <div v-if="!batches.length" class="integration-empty">No CSV meter imports recorded yet.</div>
        <div v-for="batch in batches" :key="batch._id" class="integration-history-row"><span><b>{{ batch.fileName }}</b><small>{{ batch.externalBatchId }} · {{ new Date(batch.startedAt).toLocaleString() }}</small></span><span class="integration-counts">{{ batch.inserted }} inserted · {{ batch.duplicates }} duplicates</span><span class="integration-chip" :class="batch.status==='completed'?'integration-good':batch.status==='failed'?'integration-warn':''">{{ batch.status }}</span><small v-if="batch.errorSummary" class="integration-warn">{{ batch.errorSummary }}</small></div>
      </article>
      <article class="integration-panel"><div class="integration-panel-head"><div><h3>Utility invoice register</h3><p>Recorded actual bills and comparison outcomes</p></div><b>{{ invoices.length }} invoices</b></div>
        <div v-if="!invoices.length" class="integration-empty">No utility invoices reconciled yet.</div>
        <div v-for="invoice in invoices" :key="invoice._id" class="integration-history-row"><span><b>{{ invoice.invoiceNumber }} · {{ invoice.supplier }}</b><small>{{ invoice.facility.name }} · {{ invoice.periodStart.slice(0,10) }} – {{ invoice.periodEnd.slice(0,10) }}</small></span><span class="integration-counts">{{ money(invoice.reconciliation.amountVariance, invoice.currency) }} variance</span><span class="integration-chip" :class="varianceClass(invoice)">{{ invoice.reconciliation.status.replace('_',' ') }}</span></div>
      </article>
    </div>
    <p class="integration-footnote">All imports, invoices and estimates are organization-scoped. CSV retries use stable batch identifiers; invoice numbers are unique per facility. Actual invoice values are retained as submitted and are never silently substituted for meter telemetry.</p>
  </section>
</template>
