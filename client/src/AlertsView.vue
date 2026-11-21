<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { alertsApi, apiRequest, billingApi, gatewayApi, type AlertRule, type EnergyIncident, type GatewaySource } from './services/api'

const props = defineProps<{ organizationId: string; role: string }>()
type FacilityOption = { _id: string; name: string; code: string; status: string }
type MeterOption = { _id: string; name: string; serialNumber: string; status: string; facility: string | { _id: string } }
const facilities = ref<FacilityOption[]>([])
const meters = ref<MeterOption[]>([])
const gateways = ref<GatewaySource[]>([])
const rules = ref<AlertRule[]>([])
const incidents = ref<EnergyIncident[]>([])
const name = ref('')
const type = ref<AlertRule['type']>('high_consumption')
const targetType = ref<AlertRule['targetType']>('facility')
const targetId = ref('')
const thresholdKwh = ref(100)
const windowMinutes = ref(60)
const staleAfterMinutes = ref(60)
const severity = ref<AlertRule['severity']>('high')
const loading = ref(false)
const saving = ref(false)
const evaluating = ref(false)
const actionId = ref('')
const error = ref('')
const success = ref('')
const lastEvaluation = ref('')
const canManage = computed(() => ['owner', 'admin', 'operator'].includes(props.role))
const targetOptions = computed(() => targetType.value === 'facility'
  ? facilities.value.filter(item => item.status === 'active').map(item => ({ id: item._id, label: item.name + ' · ' + item.code }))
  : targetType.value === 'meter'
    ? meters.value.filter(item => item.status === 'active').map(item => ({ id: item._id, label: item.name + ' · ' + item.serialNumber }))
    : gateways.value.filter(item => item.status === 'active').map(item => ({ id: item._id, label: item.name })))
const activeIncidents = computed(() => incidents.value.filter(item => item.status !== 'resolved'))
const severityClass = (value: string) => 'alert-severity-' + value
const typeLabel = (value: string) => value === 'high_consumption' ? 'High consumption' : value === 'meter_silent' ? 'Meter silence' : 'Gateway silence'

watch(type, value => {
  targetType.value = value === 'high_consumption' ? 'facility' : value === 'meter_silent' ? 'meter' : 'gateway'
  targetId.value = ''
})
watch(targetType, () => { targetId.value = targetOptions.value[0]?.id ?? '' })
watch(targetOptions, options => { if (!options.some(item => item.id === targetId.value)) targetId.value = options[0]?.id ?? '' })

async function load() {
  if (!props.organizationId) return
  loading.value = true
  error.value = ''
  try {
    const [ruleData, incidentData, facilityData, meterData, gatewayData] = await Promise.all([
      alertsApi.rules(props.organizationId),
      alertsApi.incidents(props.organizationId),
      billingApi.facilities(props.organizationId),
      apiRequest<MeterOption[]>(`/organizations/${encodeURIComponent(props.organizationId)}/meters`),
      gatewayApi.list(props.organizationId),
    ])
    rules.value = ruleData
    incidents.value = incidentData
    facilities.value = facilityData
    meters.value = meterData
    gateways.value = gatewayData
    if (!targetId.value) targetId.value = targetOptions.value[0]?.id ?? ''
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to load alert operations.' }
  finally { loading.value = false }
}
watch(() => props.organizationId, () => { rules.value = []; incidents.value = []; targetId.value = ''; void load() })
onMounted(load)

async function createRule() {
  error.value = ''; success.value = ''
  if (!name.value.trim() || !targetId.value) { error.value = 'Enter a rule name and select a target.'; return }
  saving.value = true
  try {
    const created = await alertsApi.createRule(props.organizationId, {
      name: name.value.trim(), type: type.value, targetId: targetId.value, targetType: targetType.value,
      ...(type.value === 'high_consumption' ? { thresholdKwh: thresholdKwh.value } : {}),
      windowMinutes: windowMinutes.value, staleAfterMinutes: staleAfterMinutes.value, severity: severity.value,
    })
    rules.value = [created, ...rules.value]
    name.value = ''
    success.value = 'Alert rule created.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to create alert rule.' }
  finally { saving.value = false }
}
async function evaluate() {
  error.value = ''; success.value = ''; evaluating.value = true
  try {
    const result = await alertsApi.evaluate(props.organizationId)
    lastEvaluation.value = new Date().toLocaleTimeString()
    success.value = `Evaluation complete: ${result.created} new, ${result.updated} updated, ${result.recovered} recovered across ${result.evaluatedRules} rules.`
    await load()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Alert evaluation failed.' }
  finally { evaluating.value = false }
}
async function toggleRule(rule: AlertRule) {
  actionId.value = rule._id; error.value = ''
  try {
    const updated = await alertsApi.setRuleStatus(props.organizationId, rule._id, rule.status === 'active' ? 'disabled' : 'active')
    rules.value = rules.value.map(item => item._id === rule._id ? updated : item)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to update rule.' }
  finally { actionId.value = '' }
}
async function updateIncident(incident: EnergyIncident, status: 'acknowledged' | 'resolved') {
  actionId.value = incident._id; error.value = ''
  try {
    const updated = await alertsApi.updateIncident(props.organizationId, incident._id, status)
    incidents.value = incidents.value.map(item => item._id === incident._id ? updated : item)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to update incident.' }
  finally { actionId.value = '' }
}
</script>

<template>
  <section class="alerts-workspace" id="alerts">
    <div class="alerts-heading"><div><label class="eyebrow">OPERATIONAL RELIABILITY</label><h2>Alerts &amp; incidents</h2><p>Threshold monitoring, telemetry freshness and incident response for this organization.</p></div><div class="alerts-heading-actions"><span class="alerts-count">{{ activeIncidents.length }} active</span><button v-if="canManage" class="alerts-primary" @click="evaluate" :disabled="evaluating || loading">{{ evaluating ? 'Evaluating…' : '▶ Run evaluation' }}</button></div></div>
    <div v-if="error" class="notice error-notice" role="alert"><b>!</b><span>{{ error }}</span></div>
    <div v-if="success" class="notice"><b>✓</b><span>{{ success }} <small v-if="lastEvaluation">Last run {{ lastEvaluation }}</small></span></div>
    <div class="alerts-grid">
      <article class="alerts-panel">
        <div class="alerts-panel-head"><div><h3>Alert rules</h3><p>Facility consumption and data-source silence</p></div><span class="alerts-count">{{ rules.length }} configured</span></div>
        <form v-if="canManage" class="alerts-form" @submit.prevent="createRule">
          <label>Rule name<input v-model.trim="name" required minlength="2" maxlength="120" placeholder="e.g. Main facility peak watch"></label>
          <div class="alerts-form-two"><label>Condition<select v-model="type"><option value="high_consumption">High consumption</option><option value="meter_silent">Meter not reporting</option><option value="gateway_silent">Gateway not reporting</option></select></label><label>Severity<select v-model="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
          <label>Target<select v-model="targetId"><option value="">Select target</option><option v-for="item in targetOptions" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
          <div v-if="type==='high_consumption'" class="alerts-form-two"><label>Energy threshold (kWh)<input v-model.number="thresholdKwh" type="number" min="0.01" step="0.01" required></label><label>Observation window (minutes)<input v-model.number="windowMinutes" type="number" min="5" max="10080" required></label></div>
          <label v-else>Silence threshold (minutes)<input v-model.number="staleAfterMinutes" type="number" min="5" max="10080" required></label>
          <button class="alerts-primary" type="submit" :disabled="saving || !targetId">{{ saving ? 'Saving…' : '＋ Create alert rule' }}</button>
        </form>
        <div v-else class="alerts-empty">Your role has read-only alert access.</div>
        <div class="alerts-rule-list">
          <div v-for="rule in rules" :key="rule._id" class="alerts-rule">
            <div><b>{{ rule.name }}</b><span class="alerts-severity" :class="severityClass(rule.severity)">{{ rule.severity }}</span></div>
            <small>{{ typeLabel(rule.type) }} · {{ rule.targetType }} · {{ rule.type==='high_consumption' ? rule.thresholdKwh + ' kWh / ' + rule.windowMinutes + ' min' : rule.staleAfterMinutes + ' min silence' }}</small>
            <div class="alerts-rule-footer"><span :class="rule.status==='active'?'alerts-active':'alerts-muted'">● {{ rule.status }}</span><button v-if="canManage" class="alerts-link" @click="toggleRule(rule)" :disabled="actionId===rule._id">{{ rule.status==='active'?'Disable':'Enable' }}</button></div>
          </div>
          <div v-if="!rules.length && !loading" class="alerts-empty">No alert rules configured yet.</div>
        </div>
      </article>
      <article class="alerts-panel">
        <div class="alerts-panel-head"><div><h3>Incident queue</h3><p>Deduplicated conditions with recovery tracking</p></div><span class="alerts-count">{{ activeIncidents.length }} open / acknowledged</span></div>
        <div class="alerts-incident-list">
          <div v-for="incident in incidents" :key="incident._id" class="alerts-incident" :class="{ 'alerts-incident-resolved': incident.status==='resolved' }">
            <div class="alerts-incident-top"><span class="alerts-severity" :class="severityClass(incident.severity)">{{ incident.severity }}</span><span class="alerts-status">{{ incident.status }}</span></div>
            <b>{{ incident.title }}</b><p>{{ incident.description }}</p>
            <small>{{ new Date(incident.lastSeenAt).toLocaleString() }} · {{ incident.occurrences }} evaluation{{ incident.occurrences===1?'':'s' }}</small>
            <div v-if="canManage && incident.status!=='resolved'" class="alerts-incident-actions">
              <button v-if="incident.status==='open'" class="alerts-secondary" @click="updateIncident(incident,'acknowledged')" :disabled="actionId===incident._id">Acknowledge</button>
              <button class="alerts-secondary" @click="updateIncident(incident,'resolved')" :disabled="actionId===incident._id">Resolve</button>
            </div>
            <small v-if="incident.status==='resolved'">Resolved {{ incident.resolutionReason==='condition_cleared'?'automatically after recovery':'by an operator' }}</small>
          </div>
          <div v-if="!incidents.length && !loading" class="alerts-empty">No incidents recorded. Run an evaluation to inspect active rules.</div>
        </div>
      </article>
    </div>
    <p class="alerts-footnote">Evaluations run on demand in this release; no background scheduler or outbound email/SMS delivery is configured. High-consumption checks sum valid and estimated readings inside the configured window. Silence checks use the latest received meter reading or successful gateway delivery.</p>
  </section>
</template>
