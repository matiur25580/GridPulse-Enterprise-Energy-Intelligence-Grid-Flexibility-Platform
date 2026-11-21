<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { assetApi, type Facility, type Meter, type Reading } from './services/assets'

const props = defineProps<{ organizationId: string; role: string }>()
const canWrite = computed(() => ['owner', 'admin', 'operator'].includes(props.role))
const facilities = ref<Facility[]>([])
const meters = ref<Meter[]>([])
const readings = ref<Reading[]>([])
const selectedFacility = ref('')
const selectedMeter = ref('')
const activeTab = ref<'facilities' | 'meters' | 'readings'>('facilities')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const facilityForm = ref({ name: '', code: '', facilityType: 'industrial', timezone: 'Asia/Kolkata', city: '', region: '', country: 'India' })
const meterForm = ref({ facilityId: '', name: '', serialNumber: '', meterType: 'main', ratedPowerKw: '' })
const readingForm = ref({ recordedAt: new Date().toISOString().slice(0, 16), energyKwh: '', demandKw: '', powerFactor: '', source: 'manual', quality: 'valid' })

const selectedMeterName = computed(() => meters.value.find((m) => m._id === selectedMeter.value)?.name ?? '')
function clearMessages() { error.value = ''; success.value = '' }
async function loadFacilities() {
  facilities.value = await assetApi.facilities(props.organizationId)
  if (!facilities.value.some((f) => f._id === selectedFacility.value)) selectedFacility.value = facilities.value[0]?._id ?? ''
}
async function loadMeters() {
  meters.value = await assetApi.meters(props.organizationId, selectedFacility.value || undefined)
  if (!meters.value.some((m) => m._id === selectedMeter.value)) selectedMeter.value = meters.value[0]?._id ?? ''
}
async function loadReadings() {
  if (!selectedMeter.value) { readings.value = []; return }
  readings.value = await assetApi.readings(props.organizationId, selectedMeter.value)
}
async function refresh() {
  if (!props.organizationId) return
  loading.value = true; clearMessages()
  try { await loadFacilities(); await loadMeters(); await loadReadings() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to load asset inventory.' }
  finally { loading.value = false }
}
async function createFacility() {
  saving.value = true; clearMessages()
  try {
    const f = facilityForm.value
    await assetApi.createFacility(props.organizationId, { name: f.name, code: f.code, facilityType: f.facilityType, timezone: f.timezone, address: { city: f.city || undefined, region: f.region || undefined, country: f.country || undefined } })
    facilityForm.value = { name: '', code: '', facilityType: 'industrial', timezone: 'Asia/Kolkata', city: '', region: '', country: 'India' }
    await loadFacilities(); success.value = 'Facility created successfully.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to create facility.' }
  finally { saving.value = false }
}
async function createMeter() {
  saving.value = true; clearMessages()
  try {
    const f = meterForm.value
    await assetApi.createMeter(props.organizationId, { facilityId: f.facilityId, name: f.name, serialNumber: f.serialNumber, meterType: f.meterType, ratedPowerKw: f.ratedPowerKw ? Number(f.ratedPowerKw) : undefined })
    meterForm.value = { facilityId: f.facilityId, name: '', serialNumber: '', meterType: 'main', ratedPowerKw: '' }
    await loadMeters(); success.value = 'Meter registered successfully.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to register meter.' }
  finally { saving.value = false }
}
async function submitReading() {
  if (!selectedMeter.value) return
  saving.value = true; clearMessages()
  try {
    const f = readingForm.value
    const result = await assetApi.ingest(props.organizationId, selectedMeter.value, [{
      externalId: 'manual-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString()),
      recordedAt: new Date(f.recordedAt).toISOString(),
      energyKwh: Number(f.energyKwh),
      ...(f.demandKw ? { demandKw: Number(f.demandKw) } : {}),
      ...(f.powerFactor ? { powerFactor: Number(f.powerFactor) } : {}),
      source: f.source as 'manual' | 'gateway' | 'import' | 'simulation',
      quality: f.quality as 'valid' | 'estimated' | 'flagged',
    }])
    success.value = result.inserted ? 'Energy reading accepted and stored.' : 'Reading was recognized as a duplicate.'
    readingForm.value = { recordedAt: new Date().toISOString().slice(0, 16), energyKwh: '', demandKw: '', powerFactor: '', source: 'manual', quality: 'valid' }
    await loadReadings()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to ingest reading.' }
  finally { saving.value = false }
}
watch(() => props.organizationId, () => { selectedFacility.value = ''; selectedMeter.value = ''; void refresh() })
watch(selectedFacility, async () => { if (props.organizationId) { try { await loadMeters(); await loadReadings() } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to filter meters.' } } })
watch(selectedMeter, () => { if (selectedMeter.value) void loadReadings() })
onMounted(refresh)
</script>

<template>
  <section class="assets-module">
    <div class="assets-heading"><div><label class="eyebrow">ASSET OPERATIONS</label><h2>Facilities &amp; meters</h2><p>Manage operating sites, meter inventory and incoming energy measurements.</p></div><button class="asset-refresh" @click="refresh" :disabled="loading">{{ loading ? 'Loading…' : '↻ Refresh' }}</button></div>
    <div v-if="error" class="asset-message asset-error" role="alert">{{ error }}</div>
    <div v-if="success" class="asset-message asset-success" role="status">{{ success }}</div>
    <div class="asset-tabs" role="tablist" aria-label="Asset management sections">
      <button :class="{active:activeTab==='facilities'}" @click="activeTab='facilities'">Facilities <span>{{facilities.length}}</span></button>
      <button :class="{active:activeTab==='meters'}" @click="activeTab='meters'">Meters <span>{{meters.length}}</span></button>
      <button :class="{active:activeTab==='readings'}" @click="activeTab='readings'">Energy readings</button>
    </div>

    <div v-if="activeTab==='facilities'" class="asset-layout">
      <article class="asset-panel"><div class="asset-panel-title"><h3>Facility directory</h3><span>{{facilities.length}} sites</span></div>
        <div v-if="!facilities.length" class="asset-empty">No facilities registered yet. Create your first operating site.</div>
        <button v-for="f in facilities" :key="f._id" class="facility-item" :class="{chosen:selectedFacility===f._id}" @click="selectedFacility=f._id">
          <span class="facility-symbol">⌂</span><span class="facility-copy"><b>{{f.name}}</b><small>{{f.code}} · {{[f.address?.city,f.address?.region].filter(Boolean).join(', ') || f.facilityType}}</small></span><span class="asset-status" :class="f.status">{{f.status}}</span>
        </button>
      </article>
      <article v-if="canWrite" class="asset-panel"><div class="asset-panel-title"><h3>Add a facility</h3><span>ADMIN ACTION</span></div>
        <form class="asset-form" @submit.prevent="createFacility">
          <label>Facility name<input v-model.trim="facilityForm.name" required minlength="2" maxlength="120" placeholder="e.g. Pune Manufacturing Plant"></label>
          <label>Facility code<input v-model.trim="facilityForm.code" required minlength="2" maxlength="40" pattern="[A-Za-z0-9_-]+" placeholder="PUNE-PLANT-01"></label>
          <label>Facility type<select v-model="facilityForm.facilityType"><option value="industrial">Industrial</option><option value="office">Office</option><option value="warehouse">Warehouse</option><option value="retail">Retail</option><option value="campus">Campus</option><option value="other">Other</option></select></label>
          <div class="asset-two-col"><label>City<input v-model.trim="facilityForm.city" maxlength="80" placeholder="Pune"></label><label>Region / state<input v-model.trim="facilityForm.region" maxlength="80" placeholder="Maharashtra"></label></div>
          <label>Timezone<input v-model.trim="facilityForm.timezone" required maxlength="64" placeholder="Asia/Kolkata"></label>
          <button class="asset-primary" type="submit" :disabled="saving">{{saving ? 'Saving…' : '＋ Create facility'}}</button>
        </form>
      </article>
    </div>

    <div v-else-if="activeTab==='meters'" class="asset-layout">
      <article class="asset-panel"><div class="asset-panel-title"><h3>Meter inventory</h3><span>{{meters.length}} meters</span></div>
        <label class="asset-filter">Filter by facility<select v-model="selectedFacility"><option value="">All facilities</option><option v-for="f in facilities" :key="f._id" :value="f._id">{{f.name}}</option></select></label>
        <div v-if="!meters.length" class="asset-empty">No meters found. Register a meter for an active facility.</div>
        <div v-for="m in meters" :key="m._id" class="meter-item"><span class="meter-symbol">◉</span><span class="facility-copy"><b>{{m.name}}</b><small>{{m.serialNumber}} · {{typeof m.facility==='string' ? m.facility : m.facility?.name}}</small></span><span class="asset-status" :class="m.status">{{m.status}}</span></div>
      </article>
      <article v-if="canWrite" class="asset-panel"><div class="asset-panel-title"><h3>Register a meter</h3><span>ADMIN ACTION</span></div>
        <form class="asset-form" @submit.prevent="createMeter">
          <label>Parent facility<select v-model="meterForm.facilityId" required><option value="" disabled>Select a facility</option><option v-for="f in facilities.filter(x=>x.status==='active')" :key="f._id" :value="f._id">{{f.name}}</option></select></label>
          <label>Meter name<input v-model.trim="meterForm.name" required minlength="2" maxlength="120" placeholder="Main incoming meter"></label>
          <label>Serial number<input v-model.trim="meterForm.serialNumber" required minlength="2" maxlength="80" placeholder="MTR-0001"></label>
          <label>Meter type<select v-model="meterForm.meterType"><option value="main">Main</option><option value="submeter">Submeter</option><option value="solar">Solar</option><option value="battery">Battery</option><option value="ev_charger">EV charger</option><option value="generator">Generator</option></select></label>
          <label>Rated power (kW)<input v-model="meterForm.ratedPowerKw" type="number" min="0.001" max="1000000" step="any" placeholder="Optional"></label>
          <button class="asset-primary" type="submit" :disabled="saving || !facilities.some(x=>x._id===meterForm.facilityId && x.status==='active')">{{saving ? 'Saving…' : '＋ Register meter'}}</button>
        </form>
      </article>
    </div>

    <div v-else class="asset-layout">
      <article class="asset-panel"><div class="asset-panel-title"><h3>Recent readings</h3><span>LAST 20 EVENTS</span></div>
        <label class="asset-filter">Select meter<select v-model="selectedMeter"><option value="" disabled>Select a meter</option><option v-for="m in meters" :key="m._id" :value="m._id">{{m.name}} · {{m.serialNumber}}</option></select></label>
        <div v-if="!readings.length" class="asset-empty">Choose a meter with telemetry to inspect its recent energy readings.</div>
        <div v-for="r in readings" :key="r._id" class="reading-item"><span class="reading-kwh">{{Number(r.energyKwh).toLocaleString()}} <small>kWh</small></span><span class="facility-copy"><b>{{new Date(r.recordedAt).toLocaleString()}</b><small>{{r.externalId}} · {{r.source}}</small></span><span class="asset-status" :class="r.quality">{{r.quality}}</span></div>
      </article>
      <article v-if="canWrite" class="asset-panel"><div class="asset-panel-title"><h3>Ingest a reading</h3><span>MANUAL ENTRY</span></div>
        <form class="asset-form" @submit.prevent="submitReading">
          <label>Target meter<select v-model="selectedMeter" required><option value="" disabled>Select a meter</option><option v-for="m in meters.filter(x=>x.status==='active')" :key="m._id" :value="m._id">{{m.name}} · {{m.serialNumber}}</option></select></label>
          <label>Recorded at<input v-model="readingForm.recordedAt" type="datetime-local" required></label>
          <label>Energy consumed (kWh)<input v-model="readingForm.energyKwh" type="number" min="0" max="100000000" step="any" required placeholder="124.75"></label>
          <label>Demand (kW)<input v-model="readingForm.demandKw" type="number" min="0" max="1000000" step="any" placeholder="Optional"></label>
          <label>Power factor<input v-model="readingForm.powerFactor" type="number" min="0" max="1" step="0.001" placeholder="0 to 1"></label>
          <div class="asset-two-col"><label>Source<select v-model="readingForm.source"><option value="manual">Manual</option><option value="gateway">Gateway</option><option value="import">Import</option><option value="simulation">Simulation</option></select></label><label>Quality<select v-model="readingForm.quality"><option value="valid">Valid</option><option value="estimated">Estimated</option><option value="flagged">Flagged</option></select></label></div>
          <button class="asset-primary" type="submit" :disabled="saving || !selectedMeter || !meters.some(x=>x._id===selectedMeter && x.status==='active')">{{saving ? 'Submitting…' : '↥ Submit reading'}}</button>
        </form>
      </article>
    </div>
    <p class="asset-footnote">All actions are scoped to the selected organization. The API enforces tenant membership, role permissions, facility ownership and reading idempotency.</p>
  </section>
</template>