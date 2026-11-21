<script setup lang="ts">
const capabilities = [
  {
    number: '01',
    title: 'Energy observability',
    description: 'Bring facility, meter, and time-series energy data into one operational view.',
    status: 'Foundation next',
  },
  {
    number: '02',
    title: 'Demand intelligence',
    description: 'Build measurable forecasts, detect unusual loads, and explain model confidence.',
    status: 'Planned',
  },
  {
    number: '03',
    title: 'Grid flexibility',
    description: 'Model flexible loads and simulate demand-response events with approval workflows.',
    status: 'Planned',
  },
]
</script>

<template>
  <main class="shell">
    <nav class="topbar">
      <a class="brand" href="/" aria-label="GridPulse home">
        <span class="brand-mark">G</span>
        <span>GridPulse</span>
      </a>
      <span class="environment"><i /> DEVELOPMENT FOUNDATION</span>
    </nav>

    <section class="hero">
      <div class="eyebrow"><span /> ENERGY INTELLIGENCE PLATFORM</div>
      <h1>Make every<br /><span>watt count.</span></h1>
      <p class="intro">
        A unified foundation for understanding energy demand, improving operational
        decisions, and building a more flexible energy system.
      </p>
      <div class="hero-meta">
        <span>MEVN architecture</span>
        <span>Multi-facility by design</span>
        <span>Explainable intelligence</span>
      </div>
    </section>

    <section class="section-heading">
      <div>
        <p class="eyebrow">PLATFORM BUILDOUT</p>
        <h2>Designed for real operations</h2>
      </div>
      <span class="phase">PHASE 00 / FOUNDATION</span>
    </section>

    <section class="capability-grid">
      <article v-for="item in capabilities" :key="item.number" class="capability-card">
        <div class="card-top">
          <span class="card-number">{{ item.number }}</span>
          <span class="card-status">{{ item.status }}</span>
        </div>
        <h3>{{ item.title }}</h3>
        <p>{{ item.description }}</p>
      </article>
    </section>

    <footer>
      <span>GRIDPULSE <span class="muted">· ENTERPRISE ENERGY INTELLIGENCE</span></span>
      <span>Foundation scaffold · No live energy telemetry connected</span>
    </footer>
  </main>
</template>
