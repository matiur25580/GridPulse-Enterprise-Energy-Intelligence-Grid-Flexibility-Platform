import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const baseUrl = process.env.DEMO_APP_URL || 'http://127.0.0.1:5173'
const email = process.env.DEMO_SEED_EMAIL || 'demo@gridpulse.local'
const password = process.env.DEMO_SEED_PASSWORD
const outputDirectory = process.env.SCREENSHOT_OUTPUT_DIR || 'artifacts/gridpulse-dashboard-screenshots'

if (!password) throw new Error('DEMO_SEED_PASSWORD is required to authenticate the screenshot browser.')

const captures = [
  ['01-portfolio-overview.png', '.welcome'],
  ['02-portfolio-kpis.png', '.metrics'],
  ['03-consumption-and-demand-trends.png', '.charts'],
  ['04-facility-and-meter-operations.png', '.assets-module'],
  ['05-forecasting-and-anomaly-intelligence.png', '.intelligence-module'],
  ['06-energy-optimization-scenarios.png', '.optimization-module'],
  ['07-renewable-and-grid-flexibility.png', '.flexibility-module'],
  ['08-sustainability-reporting.png', '.reporting-module'],
  ['09-tariff-and-billing-intelligence.png', '.billing-module'],
  ['10-integrations-and-reconciliation.png', '.integrations-module'],
  ['11-alerts-and-incident-command.png', '.alerts-workspace'],
  ['12-incident-evaluation-history.png', '.alerts-run-history'],
]

await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const reportResponses = []
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1.5,
    colorScheme: 'dark',
  })
  page.setDefaultTimeout(30000)
  page.on('response', async (response) => {
    if (response.url().includes('/reports/energy')) {
      const body = await response.text().catch(() => '')
      reportResponses.push({ status: response.status(), body })
      process.stdout.write('REPORT_RESPONSE ' + response.status() + ' ' + body.slice(0, 1200) + '\\n')
    }
  })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in securely' }).click()
  await page.locator('.dashboard').waitFor({ state: 'visible' })
  await page.locator('.charts .chart').first().waitFor({ state: 'visible' })
  await page.locator('.assets-module').waitFor({ state: 'visible' })
  await page.locator('.alerts-workspace').waitFor({ state: 'visible' })
  await page.waitForTimeout(1800)

  // Populate scenario and report panels through their real UI actions before capturing.
  await page.getByRole('button', { name: /Run optimization scenario/ }).click()
  await page.getByRole('button', { name: /Evaluate demand response/ }).click()
  await page.getByRole('button', { name: /Generate report/ }).click()
  await page.getByRole('button', { name: /Calculate estimate/ }).click()
  await page.getByRole('button', { name: /Run evaluation/ }).click()
  await Promise.race([
    page.locator('.reporting-result-head').waitFor({ state: 'visible' }),
    page.locator('.reporting-error').waitFor({ state: 'visible' }),
  ])
  if (await page.locator('.reporting-error').isVisible()) {
    throw new Error('Demo report generation failed: ' + (reportResponses.at(-1)?.body || await page.locator('.reporting-error').innerText()))
  }
  if (!(await page.locator('.reporting-result-head').isVisible())) {
    throw new Error('Demo report did not render successfully.')
  }
  await Promise.race([
    page.locator('.reporting-result-head').waitFor({ state: 'visible' }),
    page.locator('.reporting-error').waitFor({ state: 'visible' }),
  ])
  if (await page.locator('.reporting-error').isVisible()) {
    throw new Error('Demo report generation failed: ' + (reportResponses.at(-1)?.body || await page.locator('.reporting-error').innerText()))
  }
  if (!(await page.locator('.reporting-result-head').isVisible())) {
    throw new Error('Demo report did not render successfully.')
  }
  await page.waitForTimeout(1200)

  for (const [fileName, selector] of captures) {
    const section = page.locator(selector).first()
    await section.waitFor({ state: 'visible' })
    await section.scrollIntoViewIfNeeded()
    await page.waitForTimeout(250)
    if (fileName === '01-portfolio-overview.png') {
      await page.screenshot({ path: outputDirectory + '/' + fileName, fullPage: false, animations: 'disabled', caret: 'hide' })
      process.stdout.write('Captured ' + fileName + '\\n')
      continue
    }
    if (fileName === '01-portfolio-overview.png') {
      await page.screenshot({ path: outputDirectory + '/' + fileName, fullPage: false, animations: 'disabled', caret: 'hide' })
      process.stdout.write('Captured ' + fileName + '\\n')
      continue
    }
    await section.screenshot({
      path: outputDirectory + '/' + fileName,
      animations: 'disabled',
      caret: 'hide',
    })
    process.stdout.write('Captured ' + fileName + '\n')
  }
  process.stdout.write('Captured ' + captures.length + ' authentic dashboard screenshots in ' + outputDirectory + '\n')
} finally {
  await browser.close()
}
