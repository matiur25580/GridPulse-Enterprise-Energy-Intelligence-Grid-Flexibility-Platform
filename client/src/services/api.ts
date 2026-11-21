const API_BASE = '/api/v1'
let accessToken: string | null = null
let refreshing: Promise<string | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }).then(async (response) => {
      if (!response.ok) return null
      const payload = await response.json()
      const token = payload.data?.accessToken ?? null
      setAccessToken(token)
      return token
    }).catch(() => null).finally(() => { refreshing = null })
  }
  return refreshing
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && !path.endsWith('/auth/refresh')) {
    const token = await refreshAccessToken()
    if (token) return apiRequest<T>(path, options, false)
  }
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.error?.message ?? payload.message ?? 'Request failed.', response.status, payload.error?.code)
  return payload.data as T
}

export const authApi = {
  login: (input: { email: string; password: string }) => apiRequest<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  register: (input: { name: string; email: string; password: string; organizationName: string }) => apiRequest<{ user: User; organization: Organization; accessToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  me: () => apiRequest<{ user: User; organizations: Organization[] }>('/auth/me'),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', body: '{}' }),
  refresh: refreshAccessToken,
}
export const organizationApi = {
  list: () => apiRequest<Organization[]>('/organizations'),
  analytics: (organizationId: string, from: string, to: string) =>
    apiRequest<EnergyOverview>(`/organizations/${encodeURIComponent(organizationId)}/analytics/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
}

export interface IntelligenceHistoryPoint { date: string; energyKwh: number; readingCount: number }
export interface IntelligenceForecastPoint { date: string; energyKwh: number; lowerKwh: number; upperKwh: number }
export interface EnergyAnomaly {
  meterId: string
  facilityId: string
  date: string
  energyKwh: number
  baselineKwh: number
  thresholdKwh: number
  severity: 'high' | 'medium'
  deviationRatio: number
  method: string
  meter: { id: string; name: string; serialNumber: string } | null
}
export interface ForecastBacktest {
  method: string
  minimumTrainingDays: number
  evaluatedDays: number
  requestedDays: number
  metrics: { maeKwh: number | null; rmseKwh: number | null; mapePercent: number | null; weightedAbsolutePercentageError: number | null; meanErrorKwh: number | null }
  predictions: Array<{ date: string; actualKwh: number; predictedKwh: number; errorKwh: number; absoluteErrorKwh: number; absolutePercentageError: number | null }>
  note: string
}
export interface EnergyIntelligence {
  range: { from: string; to: string }
  generatedAt: string
  history: IntelligenceHistoryPoint[]
  forecast: { model: string; methodology: string; historyCount: number; baselineDailyKwh: number; dailyTrendKwh: number; forecast: IntelligenceForecastPoint[] }
  backtest: ForecastBacktest
  facilityBacktests: Array<ForecastBacktest & { facilityId: string; facility: { name: string; code: string } | null }>
  anomalies: EnergyAnomaly[]
  anomalySummary: { count: number; high: number; medium: number }
  dataQuality: { included: string; excluded: string; historyDays: number; horizonDays: number; backtestDays: number }
}
export const intelligenceApi = {
  overview: (organizationId: string, historyDays = 30, horizonDays = 7, backtestDays = 14) =>
    apiRequest<EnergyIntelligence>(`/organizations/${encodeURIComponent(organizationId)}/analytics/intelligence?historyDays=${historyDays}&horizonDays=${horizonDays}&backtestDays=${backtestDays}`),
}


export interface OptimizationScenarioInput {
  historyDays: number
  offPeakRatePerKwh: number
  peakRatePerKwh: number
  peakHours: number[]
  batteryCapacityKwh: number
  batteryPowerKw: number
  initialSocPercent: number
  reserveSocPercent: number
  roundTripEfficiency: number
}
export interface OptimizationScenario {
  generatedAt: string
  range: { from: string; to: string; requestedDays: number }
  dataCoverage: { hoursWithReadings: number; observedDays: number; readingQuality: string }
  assumptions: Record<string, string>
  baseline: { dailyEnergyKwh: number; dailyCost: number; peakDemandKw: number }
  optimized: { dailyGridEnergyKwh: number; dailyCost: number; peakDemandKw: number; batteryChargeKwh: number; batteryDischargeKwh: number; endingStateOfChargeKwh: number }
  impact: { dailyCostSavings: number; costSavingsPercent: number | null; peakReductionKw: number; peakReductionPercent: number | null }
  schedule: Array<{ hourUtc: number; observed: boolean; baselineEnergyKwh: number; gridEnergyKwh: number; chargeKwh: number; dischargeKwh: number; tariffRate: number; period: 'peak' | 'off-peak' }>
}
export const optimizationApi = {
  simulate: (organizationId: string, input: OptimizationScenarioInput) =>
    apiRequest<OptimizationScenario>(`/organizations/${encodeURIComponent(organizationId)}/optimization/simulate`, {
      method: 'POST', body: JSON.stringify(input),
    }),
}


export interface GridFlexibilityInput {
  historyDays: number
  eventHours: number[]
  reductionPercent: number
  incentivePerKwh: number
  gridEmissionFactorKgPerKwh: number
}
export interface GridFlexibilityResult {
  generatedAt: string
  range: { from: string; to: string; requestedDays: number }
  dataCoverage: { loadSource: 'main' | 'submeter'; hoursWithLoad: number; hoursWithSolar: number; observedDays: number; observedLoadDays: number; observedSolarDays: number; includedQuality: string }
  assumptions: Record<string, string>
  renewable: { dailyGenerationKwh: number; dailySelfConsumedKwh: number; dailyEstimatedExportKwh: number; selfConsumptionPercent: number | null; solarCoveragePercent: number | null }
  demandResponse: { eventHours: number[]; dailyBaselineGridImportKwh: number; dailyCurtailedKwh: number; dailyPostEventGridImportKwh: number; reductionPercent: number; estimatedIncentive: number; incentiveRatePerKwh: number }
  emissions: { gridEmissionFactorKgPerKwh: number; dailyAvoidedKgCo2e: number; annualizedAvoidedTonnesCo2e: number }
  schedule: Array<{ hourUtc: number; observedLoad: boolean; observedSolar: boolean; loadKwh: number; solarGenerationKwh: number; selfConsumedSolarKwh: number; estimatedExportKwh: number; baselineGridImportKwh: number; demandResponseKwh: number; postEventGridImportKwh: number; event: boolean }>
}
export const gridFlexibilityApi = {
  simulate: (organizationId: string, input: GridFlexibilityInput) =>
    apiRequest<GridFlexibilityResult>(`/organizations/${encodeURIComponent(organizationId)}/grid-flexibility/simulate`, {
      method: 'POST', body: JSON.stringify(input),
    }),
}


export interface EnergyReport {
  organization: { id: string; name: string }
  generatedAt: string
  range: { from: string; to: string; timezone: string; dayCount: number }
  summary: { totalEnergyKwh: number; averageDailyEnergyKwh: number; peakDemandKw: number | null; averagePowerFactor: number | null; includedReadings: number; estimatedReadings: number; flaggedReadings: number; excludedFlaggedEnergyKwh: number; estimatedEmissionsKgCo2e: number }
  emissions: { gridEmissionFactorKgPerKwh: number; estimatedKgCo2e: number; methodology: string }
  dataQuality: { included: string; flagged: string; byQuality: Record<string, { readingCount: number; energyKwh: number }> }
  daily: Array<{ date: string; energyKwh: number; peakDemandKw: number | null; readingCount: number }>
  facilities: Array<{ facilityId: string; name: string; code: string; energyKwh: number; peakDemandKw: number | null; readingCount: number }>
  meters: Array<{ meterId: string; meterName: string; serialNumber: string; meterType: string; quality: string; energyKwh: number; readingCount: number }>
}
export const reportingApi = {
  energy: (organizationId: string, from: string, to: string, gridEmissionFactorKgPerKwh = 0.4) =>
    apiRequest<EnergyReport>(`/organizations/${encodeURIComponent(organizationId)}/reports/energy?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&gridEmissionFactorKgPerKwh=${gridEmissionFactorKgPerKwh}`),
}


export interface BillingFacility { _id: string; name: string; code: string; timezone: string; status: string }
export interface TariffRateInput { label: string; ratePerKwh: number; hours: number[]; daysOfWeek: number[] }
export interface TariffPlan {
  _id: string
  facility: BillingFacility | string
  name: string
  currency: string
  defaultRatePerKwh: number
  energyRates: TariffRateInput[]
  demandChargePerKw: number
  fixedCharge: number
  taxRatePercent: number
  effectiveFrom: string
  effectiveTo: string | null
  status: string
}
export interface EnergyBill {
  _id: string
  facility: { _id: string; name: string; code: string }
  tariff: { _id: string; name: string; currency: string }
  periodStart: string
  periodEnd: string
  currency: string
  status: 'estimate'
  summary: { totalEnergyKwh: number; energyCharge: number; peakDemandKw: number | null; demandCharge: number; fixedCharge: number; subtotal: number; taxRatePercent: number; tax: number; total: number; averageRatePerKwh: number | null; averagePowerFactor: number | null; readingCount: number; estimatedReadings: number }
  charges: Array<{ code: string; label: string; amount: number }>
  daily: Array<{ date: string; energyKwh: number; energyCharge: number; demandKw: number | null; readingCount: number }>
  comparison: { previousPeriod: { from: string; to: string }; energyChangeKwh: number; energyChangePercent: number | null; estimatedCostChange: number; estimatedCostChangePercent: number | null; previousEstimatedCost: number; methodology: string } | null
  insights: string[]
  coverage: { readingCount: number; estimatedReadings: number; observedHours: number; observedDays: number; meterSource: string; timezone: string; dataQuality: string; periodDays: number }
  generatedAt: string
}
export const billingApi = {
  facilities: (organizationId: string) => apiRequest<BillingFacility[]>(`/organizations/${encodeURIComponent(organizationId)}/facilities`),
  tariffs: (organizationId: string, facilityId?: string) =>
    apiRequest<TariffPlan[]>(`/organizations/${encodeURIComponent(organizationId)}/billing/tariffs${facilityId ? '?facilityId=' + encodeURIComponent(facilityId) : ''}`),
  createTariff: (organizationId: string, input: {
    facilityId: string; name: string; currency: string; defaultRatePerKwh: number
    energyRates: TariffRateInput[]; demandChargePerKw: number; fixedCharge: number
    taxRatePercent: number; effectiveFrom: string; effectiveTo: string | null
  }) => apiRequest<TariffPlan>(`/organizations/${encodeURIComponent(organizationId)}/billing/tariffs`, { method: 'POST', body: JSON.stringify(input) }),
  estimate: (organizationId: string, input: { facilityId: string; tariffId: string; from: string; to: string }) =>
    apiRequest<EnergyBill>(`/organizations/${encodeURIComponent(organizationId)}/billing/bills/estimate`, { method: 'POST', body: JSON.stringify(input) }),
  bills: (organizationId: string, facilityId?: string) =>
    apiRequest<EnergyBill[]>(`/organizations/${encodeURIComponent(organizationId)}/billing/bills${facilityId ? '?facilityId=' + encodeURIComponent(facilityId) : ''}`),
}

export interface User { id: string; name: string; email: string }
export interface Organization { id: string; name: string; slug: string; role: string }
export interface EnergyOverview {
  range: { from: string; to: string }
  summary: { totalEnergyKwh: number; peakDemandKw: number | null; averagePowerFactor: number | null; readingCount: number; activeFacilities: number; totalFacilities: number; activeMeters: number; totalMeters: number; flaggedReadings: number; estimatedReadings: number }
  daily: { _id: string; energyKwh: number; peakDemandKw: number | null; readingCount: number }[]
  facilities: { facilityId: string; name: string; code: string; energyKwh: number; peakDemandKw: number | null; readingCount: number }[]
}
