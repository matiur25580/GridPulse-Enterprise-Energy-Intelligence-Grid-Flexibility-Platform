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

export interface User { id: string; name: string; email: string }
export interface Organization { id: string; name: string; slug: string; role: string }
export interface EnergyOverview {
  range: { from: string; to: string }
  summary: { totalEnergyKwh: number; peakDemandKw: number | null; averagePowerFactor: number | null; readingCount: number; activeFacilities: number; totalFacilities: number; activeMeters: number; totalMeters: number; flaggedReadings: number; estimatedReadings: number }
  daily: { _id: string; energyKwh: number; peakDemandKw: number | null; readingCount: number }[]
  facilities: { facilityId: string; name: string; code: string; energyKwh: number; peakDemandKw: number | null; readingCount: number }[]
}
