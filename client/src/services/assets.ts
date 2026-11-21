import { apiRequest } from './api'
export interface Facility { _id: string; name: string; code: string; facilityType: string; timezone: string; status: string; address?: { city?: string; region?: string; country?: string } }
export interface Meter { _id: string; name: string; serialNumber: string; meterType: string; status: string; ratedPowerKw?: number; facility: { _id: string; name: string; code: string } | string }
export interface ReadingInput { externalId: string; recordedAt: string; energyKwh: number; demandKw?: number; powerFactor?: number; source: 'manual' | 'gateway' | 'import' | 'simulation'; quality: 'valid' | 'estimated' | 'flagged' }
export interface Reading { _id: string; externalId: string; recordedAt: string; energyKwh: number; demandKw?: number; powerFactor?: number; source: string; quality: string }
export const assetApi = {
  facilities: (org: string) => apiRequest<Facility[]>(`/organizations/${encodeURIComponent(org)}/facilities`),
  createFacility: (org: string, body: Record<string, unknown>) => apiRequest<Facility>(`/organizations/${encodeURIComponent(org)}/facilities`, { method: 'POST', body: JSON.stringify(body) }),
  meters: (org: string, facilityId?: string) => apiRequest<Meter[]>(`/organizations/${encodeURIComponent(org)}/meters${facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ''}`),
  createMeter: (org: string, body: Record<string, unknown>) => apiRequest<Meter>(`/organizations/${encodeURIComponent(org)}/meters`, { method: 'POST', body: JSON.stringify(body) }),
  readings: (org: string, meterId: string, page = 1) => apiRequest<Reading[]>(`/organizations/${encodeURIComponent(org)}/meters/${encodeURIComponent(meterId)}/readings?page=${page}&limit=20`),
  ingest: (org: string, meterId: string, readings: ReadingInput[]) => apiRequest<{ received: number; inserted: number; duplicates: number }>(`/organizations/${encodeURIComponent(org)}/meters/${encodeURIComponent(meterId)}/readings`, { method: 'POST', body: JSON.stringify({ readings }) }),
}