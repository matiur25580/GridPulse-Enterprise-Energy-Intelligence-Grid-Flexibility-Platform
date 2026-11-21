<script setup lang="ts">
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent])

const period = ref('7D')
const datasets = {
  '7D': { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], energy: [2840,3120,2960,3380,3210,2480,2310], demand: [412,438,426,471,455,362,341] },
  '30D': { labels: ['W1','W2','W3','W4'], energy: [18420,20110,19380,21840], demand: [471,493,462,518] },
  '90D': { labels: ['Sep','Oct','Nov'], energy: [74200,78150,79640], demand: [548,572,518] },
}
const data = computed(() => datasets[period.value as keyof typeof datasets])
const total = computed(() => period.value === '7D' ? '20,300' : period.value === '30D' ? '79,750' : '232,000')
const peak = computed(() => period.value === '7D' ? '471' : period.value === '30D' ? '518' : '572')
const energyOption = computed(() => ({
  tooltip: { trigger: 'axis', valueFormatter: (v: number) => v.toLocaleString() + ' kWh' },
  grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
  xAxis: { type: 'category', data: data.value.labels, axisLabel: { color: '#8fa5af' }, axisLine: { lineStyle: { color: '#29414c' } } },
  yAxis: { type: 'value', axisLabel: { color: '#8fa5af' }, splitLine: { lineStyle: { color: 'rgba(176,204,210,.09)' } } },
  series: [{ type: 'bar', data: data.value.energy, barMaxWidth: 34, itemStyle: { color: '#a3e635', borderRadius: [5,5,0,0] } }],
}))
const demandOption = computed(() => ({
  tooltip: { trigger: 'axis', valueFormatter: (v: number) => v + ' kW' },
  grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: data.value.labels, axisLabel: { color: '#8fa5af' }, axisLine: { lineStyle: { color: '#29414c' } } },
  yAxis: { type: 'value', axisLabel: { color: '#8fa5af' }, splitLine: { lineStyle: { color: 'rgba(176,204,210,.09)' } } },
  series: [{ type: 'line', smooth: true, data: data.value.demand, symbolSize: 7, lineStyle: { width: 3, color: '#58c7d8' }, itemStyle: { color: '#58c7d8' }, areaStyle: { color: 'rgba(88,199,216,.12)' } }],
}))
const facilities = [
  { name: 'Pune Manufacturing Plant', city: 'Pune, Maharashtra', type: 'Industrial', energy: '8,420 kWh', share: 41, status: 'Normal' },
  { name: 'Mumbai Distribution Hub', city: 'Mumbai, Maharashtra', type: 'Warehouse', energy: '5,180 kWh', share: 26, status: 'Watch' },
  { name: 'Bengaluru Technology Campus', city: 'Bengaluru, Karnataka', type: 'Campus', energy: '4,260 kWh', share: 21, status: 'Normal' },
  { name: 'Hyderabad Operations Center', city: 'Hyderabad, Telangana', type: 'Office', energy: '2,440 kWh', share: 12, status: 'Normal' },
]
</script>

<template>
  <main class="dashboard">
    <aside class="sidebar">
      <a class="brand" href="/"><span class="brand-mark">G</span>GridPulse</a>
      <p class="nav-caption">WORKSPACE</p>
      <div class="workspace"><span class="workspace-icon">N</span><span><b>Northstar Energy</b><small>Enterprise workspace</small></span><i>⌄</i></div>
      <p class="nav-caption section-caption">ENERGY OPERATIONS</p>
      <nav><a class="active" href="#"><span>◫</span>Overview</a><a href="#"><span>⌂</span>Facilities</a><a href="#"><span>◉</span>Meters</a><a href="#"><span>⌁</span>Energy data</a><a href="#"><span>↗</span>Demand intelligence <small>SOON</small></a></nav>
      <div class="sidebar-bottom"><div class="system-status"><i></i><span><b>Systems nominal</b><small>Demo environment</small></span></div><div class="profile"><span class="avatar">MA</span><span><b>Workspace Admin</b><small>Administrator</small></span></div></div>
    </aside>
    <section class="main">
      <header class="topbar"><span>Workspace <i>/</i> <b>Overview</b></span><div><label class="demo-tag"><i></i> DEMO DATA</label><span class="avatar">MA</span></div></header>
      <div class="content">
        <section class="welcome"><div><label class="eyebrow">ENERGY INTELLIGENCE</label><h1>Good morning, Admin</h1><p>Here’s what’s happening across your energy portfolio.</p></div><div class="date-range">▦ &nbsp; Nov 15 – Nov 21, 2026 &nbsp;⌄</div></section>
        <div class="notice"><b>i</b><span><strong>Preview workspace</strong> — Illustrative sample data is displayed. Connect an organization and meter telemetry to see live operational metrics.</span></div>
        <section class="metrics">
          <article class="metric"><label>TOTAL ENERGY CONSUMPTION <i class="lime">ϟ</i></label><strong>{{ total }} <small>kWh</small></strong><p><em>↓ 4.8%</em> vs previous period</p><div class="spark lime-spark"><i v-for="n in [32,45,39,62,50,72,57,82,68,90,75,96]" :key="n" :style="{height:n+'%'}"></i></div></article>
          <article class="metric"><label>PEAK DEMAND <i class="cyan">⌁</i></label><strong>{{ peak }} <small>kW</small></strong><p><em>↓ 2.1%</em> vs previous period</p><div class="spark cyan-spark"><i v-for="n in [65,48,58,39,55,44,72,52,68,48,61,35]" :key="n" :style="{height:n+'%'}"></i></div></article>
          <article class="metric"><label>ACTIVE FACILITIES <i class="violet">⌂</i></label><strong>4 <small>/ 4</small></strong><p><em>100%</em> portfolio availability</p><div class="progress"><i style="width:100%"></i></div></article>
          <article class="metric"><label>METER HEALTH <i class="amber">◉</i></label><strong>98.6<small>%</small></strong><p><em>↑ 0.6%</em> data availability</p><div class="progress amber-progress"><i style="width:98.6%"></i></div></article>
        </section>
        <section class="charts">
          <article class="panel"><div class="panel-head"><div><h2>Energy consumption</h2><p>Portfolio usage over time</p></div><div class="tabs"><button v-for="v in ['7D','30D','90D']" :key="v" :class="{selected:period===v}" @click="period=v">{{v}}</button></div></div><div class="legend"><span><i class="lime-dot"></i> Energy consumed</span><b>{{total}} kWh</b></div><VChart class="chart" :option="energyOption" autoresize /></article>
          <article class="panel"><div class="panel-head"><div><h2>Peak demand</h2><p>Maximum interval demand</p></div><label class="trend-tag">● TREND</label></div><div class="legend"><span><i class="cyan-dot"></i> Peak demand</span><b>{{peak}} kW</b></div><VChart class="chart" :option="demandOption" autoresize /></article>
        </section>
        <section class="panel facility-panel"><div class="panel-head"><div><h2>Facility performance</h2><p>Energy consumption by operating site</p></div><a href="#">View all facilities →</a></div><div class="table-scroll"><table><thead><tr><th>FACILITY</th><th>TYPE</th><th>ENERGY CONSUMPTION</th><th>PORTFOLIO SHARE</th><th>STATUS</th></tr></thead><tbody><tr v-for="f in facilities" :key="f.name"><td><b>{{f.name}}</b><small>{{f.city}}</small></td><td><span class="type-pill">{{f.type}}</span></td><td class="energy">{{f.energy}}</td><td><div class="share"><i><span :style="{width:f.share+'%'}"></span></i>{{f.share}}%</div></td><td><span class="health" :class="f.status.toLowerCase()">● {{f.status}}</span></td></tr></tbody></table></div></section>
        <footer>GRIDPULSE <span>· ENTERPRISE ENERGY INTELLIGENCE</span><small>Demo data · API analytics foundation available</small></footer>
      </div>
    </section>
  </main>
</template>