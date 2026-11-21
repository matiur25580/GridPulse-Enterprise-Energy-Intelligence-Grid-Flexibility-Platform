<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { useAuthStore } from './stores/auth'
import { organizationApi, type EnergyOverview } from './services/api'
import AssetsView from './AssetsView.vue'
import IntelligenceView from './IntelligenceView.vue'
import OptimizationView from './OptimizationView.vue'
import GridFlexibilityView from './GridFlexibilityView.vue'
import ReportingView from './ReportingView.vue'
import BillingView from './BillingView.vue'
import IntegrationsView from './IntegrationsView.vue'
import AlertsView from './AlertsView.vue'
use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent])

const auth = useAuthStore()
const { user, organizations, activeOrganizationId, activeOrganization, ready, busy } = storeToRefs(auth)
const period = ref('7D')
const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const organizationName = ref('')
const formError = ref('')
const overview = ref<EnergyOverview | null>(null)
const analyticsLoading = ref(false)
const analyticsError = ref('')
const lastUpdated = ref('')

const rangeDays = computed(() => period.value === '7D' ? 7 : period.value === '30D' ? 30 : 90)
const rangeStart = computed(() => new Date(Date.now() - (rangeDays.value - 1) * 86400000))
const rangeEnd = computed(() => new Date())
const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const dateLabel = computed(() => `${formatDate(rangeStart.value)} – ${formatDate(rangeEnd.value)}, ${rangeEnd.value.getFullYear()}`)
const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits })
const daily = computed(() => overview.value?.daily ?? [])
const chartLabels = computed(() => daily.value.map((item) => new Date(item._id + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })))
const energyValues = computed(() => daily.value.map((item) => Math.round(item.energyKwh * 100) / 100))
const demandValues = computed(() => daily.value.map((item) => item.peakDemandKw ?? 0))
const totalEnergy = computed(() => number(overview.value?.summary.totalEnergyKwh ?? 0, 2))
const peakDemand = computed(() => number(overview.value?.summary.peakDemandKw, 2))
const facilityRows = computed(() => overview.value?.facilities ?? [])
const energyOption = computed(() => ({
  tooltip: { trigger: 'axis', valueFormatter: (v: number) => number(v, 2) + ' kWh' },
  grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
  xAxis: { type: 'category', data: chartLabels.value, axisLabel: { color: '#8fa5af' }, axisLine: { lineStyle: { color: '#29414c' } } },
  yAxis: { type: 'value', axisLabel: { color: '#8fa5af' }, splitLine: { lineStyle: { color: 'rgba(176,204,210,.09)' } } },
  series: [{ type: 'bar', data: energyValues.value, barMaxWidth: 34, itemStyle: { color: '#a3e635', borderRadius: [5,5,0,0] } }],
}))
const demandOption = computed(() => ({
  tooltip: { trigger: 'axis', valueFormatter: (v: number) => number(v, 2) + ' kW' },
  grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: chartLabels.value, axisLabel: { color: '#8fa5af' }, axisLine: { lineStyle: { color: '#29414c' } } },
  yAxis: { type: 'value', axisLabel: { color: '#8fa5af' }, splitLine: { lineStyle: { color: 'rgba(176,204,210,.09)' } } },
  series: [{ type: 'line', smooth: true, data: demandValues.value, symbolSize: 6, lineStyle: { width: 3, color: '#58c7d8' }, itemStyle: { color: '#58c7d8' }, areaStyle: { color: 'rgba(88,199,216,.12)' } }],
}))

async function loadAnalytics() {
  if (!activeOrganizationId.value) { overview.value = null; return }
  analyticsLoading.value = true
  analyticsError.value = ''
  try {
    overview.value = await organizationApi.analytics(
      activeOrganizationId.value,
      rangeStart.value.toISOString(),
      rangeEnd.value.toISOString(),
    )
    lastUpdated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (cause) {
    analyticsError.value = cause instanceof Error ? cause.message : 'Unable to load energy analytics.'
    overview.value = null
  } finally { analyticsLoading.value = false }
}
async function submitAuth() {
  formError.value = ''
  try {
    if (mode.value === 'login') await auth.signIn(email.value, password.value)
    else await auth.signUp({ name: name.value, email: email.value, password: password.value, organizationName: organizationName.value })
  } catch (cause) { formError.value = cause instanceof Error ? cause.message : 'Authentication failed.' }
}
async function signOut() { await auth.signOut(); overview.value = null }
onMounted(() => auth.restore())
watch([activeOrganizationId, period, user], () => { if (user.value) void loadAnalytics() })
</script>

<template>
  <main v-if="!ready" class="auth-loading"><span class="brand-mark">G</span><p>Restoring secure workspace…</p></main>
  <main v-else-if="!user" class="auth-screen">
    <section class="auth-brand-panel"><a class="brand" href="/"><span class="brand-mark">G</span>GridPulse</a><div class="auth-pitch"><label class="eyebrow">ENERGY INTELLIGENCE PLATFORM</label><h1>Clarity for every<br>kilowatt-hour.</h1><p>Unify facilities, understand demand, and make confident energy decisions with one operational view.</p><div class="auth-points"><span>✓ Multi-site energy visibility</span><span>✓ Secure organization workspaces</span><span>✓ Operational analytics</span></div></div><small class="auth-foot">GRIDPULSE · ENTERPRISE ENERGY INTELLIGENCE</small></section>
    <section class="auth-form-panel"><form class="auth-card" @submit.prevent="submitAuth"><label class="eyebrow">{{ mode === 'login' ? 'WELCOME BACK' : 'GET STARTED' }}</label><h2>{{ mode === 'login' ? 'Sign in to GridPulse' : 'Create your workspace' }}</h2><p class="auth-subtitle">{{ mode === 'login' ? 'Enter your credentials to access your energy workspace.' : 'Set up your administrator account and organization.' }}</p>
      <label v-if="mode === 'register'" class="field">Full name<input v-model.trim="name" autocomplete="name" minlength="2" maxlength="80" required placeholder="Your full name"></label>
      <label class="field">Work email<input v-model.trim="email" type="email" autocomplete="email" required placeholder="you@company.com"></label>
      <label class="field">Password<input v-model="password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :minlength="mode === 'register' ? 12 : 1" maxlength="128" required placeholder="Enter your password"><small v-if="mode === 'register'">At least 12 characters, with uppercase, lowercase and a number.</small></label>
      <label v-if="mode === 'register'" class="field">Organization name<input v-model.trim="organizationName" autocomplete="organization" minlength="2" maxlength="120" required placeholder="Your company or facility group"></label>
      <p v-if="formError || auth.error" class="form-error" role="alert">{{ formError || auth.error }}</p><button class="auth-submit" type="submit" :disabled="busy">{{ busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create account' }}</button>
      <p class="auth-switch">{{ mode === 'login' ? 'New to GridPulse?' : 'Already have an account?' }} <button type="button" @click="mode = mode === 'login' ? 'register' : 'login'; formError = ''">{{ mode === 'login' ? 'Create an account' : 'Sign in' }}</button></p>
    </form><small class="auth-legal">Protected by organization-scoped access controls and secure session cookies.</small></section>
  </main>
  <main v-else class="dashboard">
    <aside class="sidebar">
      <a class="brand" href="/"><span class="brand-mark">G</span>GridPulse</a>
      <p class="nav-caption">WORKSPACE</p>
      <div class="workspace"><span class="workspace-icon">{{ activeOrganization?.name?.slice(0,1) ?? 'G' }}</span><span><b>{{ activeOrganization?.name ?? 'Select organization' }}</b><small>{{ activeOrganization?.role ?? 'No role' }} workspace</small></span><select v-if="organizations.length > 1" v-model="activeOrganizationId" aria-label="Select organization"><option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option></select></div>
      <p class="nav-caption section-caption">ENERGY OPERATIONS</p>
      <nav><a class="active" href="#"><span>◫</span>Overview</a><a href="#facilities"><span>⌂</span>Facilities</a><a href="#facilities"><span>◉</span>Meters</a><a href="#energy"><span>⌁</span>Energy data</a><a href="#intelligence"><span>↗</span>Demand intelligence</a><a href="#optimization"><span>⌁</span>Energy optimization</a><a href="#grid-flexibility"><span>☀</span>Renewables &amp; grid services</a><a href="#reports"><span>▤</span>Energy reports</a><a href="#billing"><span>₹</span>Tariffs &amp; billing</a><a href="#integrations"><span>⇅</span>Integrations &amp; reconciliation</a><a href="#alerts"><span>⚑</span>Alerts &amp; incidents</a></nav>
      <div class="sidebar-bottom"><div class="system-status"><i></i><span><b>Secure session active</b><small>{{ activeOrganization?.role ?? 'Member' }} access</small></span></div><div class="profile"><span class="avatar">{{ user.name.slice(0,2).toUpperCase() }}</span><span><b>{{ user.name }}</b><small>{{ user.email }}</small></span><button class="logout" @click="signOut">Log out</button></div></div>
    </aside>
    <section class="main">
      <header class="topbar"><span>{{ activeOrganization?.name ?? 'Workspace' }} <i>/</i> <b>Overview</b></span><div><label class="session-tag"><i></i> CONNECTED</label><span class="avatar">{{ user.name.slice(0,2).toUpperCase() }}</span></div></header>
      <div class="content">
        <section class="welcome"><div><label class="eyebrow">ENERGY INTELLIGENCE</label><h1>Welcome, {{ user.name.split(' ')[0] }}</h1><p>Live energy performance across your organization.</p></div><div class="date-range">▦ &nbsp; {{ dateLabel }} &nbsp;<select v-model="period" aria-label="Analytics time range"><option>7D</option><option>30D</option><option>90D</option></select></div></section>
        <div v-if="analyticsError" class="notice error-notice" role="alert"><b>!</b><span><strong>Analytics unavailable</strong> — {{ analyticsError }}</span><button @click="loadAnalytics">Retry</button></div>
        <div v-else-if="!analyticsLoading && overview && overview.summary.readingCount === 0" class="notice"><b>i</b><span><strong>No telemetry in this period.</strong> Add facilities, meters and energy readings to populate your live dashboard.</span></div>
        <div v-else-if="analyticsLoading" class="notice"><b>…</b><span>Loading organization analytics…</span></div>
        <section class="metrics">
          <article class="metric"><label>TOTAL ENERGY CONSUMPTION <i class="lime">ϟ</i></label><strong>{{ overview ? totalEnergy : '—' }} <small>kWh</small></strong><p><em>{{ overview?.summary.readingCount ?? 0 }}</em> readings in selected period</p></article>
          <article class="metric"><label>PEAK DEMAND <i class="cyan">⌁</i></label><strong>{{ overview ? peakDemand : '—' }} <small>kW</small></strong><p><em>{{ overview?.summary.averagePowerFactor == null ? '—' : number(overview.summary.averagePowerFactor, 3) }}</em> average power factor</p></article>
          <article class="metric"><label>ACTIVE FACILITIES <i class="violet">⌂</i></label><strong>{{ overview?.summary.activeFacilities ?? '—' }} <small>/ {{ overview?.summary.totalFacilities ?? '—' }}</small></strong><p><em>{{ overview?.summary.activeMeters ?? 0 }}</em> active meters</p></article>
          <article class="metric"><label>DATA QUALITY FLAGS <i class="amber">◉</i></label><strong>{{ overview?.summary.flaggedReadings ?? '—' }} <small>flagged</small></strong><p><em>{{ overview?.summary.estimatedReadings ?? 0 }}</em> estimated readings</p></article>
        </section>
        <section id="energy" class="charts">
          <article class="panel"><div class="panel-head"><div><h2>Energy consumption</h2><p>Daily portfolio usage · UTC aggregation</p></div><div class="tabs"><button v-for="v in ['7D','30D','90D']" :key="v" :class="{selected:period===v}" @click="period=v">{{v}}</button></div></div><div class="legend"><span><i class="lime-dot"></i> Energy consumed</span><b>{{ totalEnergy }} kWh</b></div><VChart class="chart" :option="energyOption" autoresize v-if="daily.length"/><div v-else class="chart-empty">Energy readings will appear here once ingested.</div></article>
          <article class="panel"><div class="panel-head"><div><h2>Peak demand</h2><p>Maximum interval demand per day</p></div><label class="trend-tag">● LIVE DATA</label></div><div class="legend"><span><i class="cyan-dot"></i> Peak demand</span><b>{{ peakDemand }} kW</b></div><VChart class="chart" :option="demandOption" autoresize v-if="daily.length"/><div v-else class="chart-empty">Demand readings will appear here once available.</div></article>
        </section>
        <IntelligenceView id="intelligence" :organization-id="activeOrganizationId" />
        <OptimizationView id="optimization" :organization-id="activeOrganizationId" />
        <GridFlexibilityView id="grid-flexibility" :organization-id="activeOrganizationId" />
        <ReportingView :organization-id="activeOrganizationId" />
        <BillingView :organization-id="activeOrganizationId" :role="activeOrganization?.role ?? ''" />
        <IntegrationsView id="integrations" :organization-id="activeOrganizationId" :role="activeOrganization?.role ?? ''" />
        <AlertsView :organization-id="activeOrganizationId" :role="activeOrganization?.role ?? ''" />
        <AssetsView id="facilities" :organization-id="activeOrganizationId" :role="activeOrganization?.role ?? ''" />
        <footer>GRIDPULSE <span>· ENTERPRISE ENERGY INTELLIGENCE</span><small>{{ activeOrganization?.name }} · {{ lastUpdated ? 'Updated ' + lastUpdated : 'Awaiting data' }} · <button @click="loadAnalytics">Refresh</button> · <button @click="signOut">Sign out</button></small></footer>
      </div>
    </section>
  </main>
</template>