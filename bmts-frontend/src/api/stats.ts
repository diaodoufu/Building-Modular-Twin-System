import api from './index'

export interface SpaceUsage {
  buildings: {
    building_id: string
    building_name: string
    total_rooms: number
    reserved_rooms: number
    rate: number
  }[]
  room_types: {
    type: string
    total: number
    reserved: number
    rate: number
  }[]
  summary: {
    total: number
    reserved: number
    rate: number
  }
}

export interface ReservationTrends {
  trends: {
    date: string
    total: number
    pending: number
    approved: number
    rejected: number
    cancelled: number
  }[]
  days: number
}

export interface RecommendResult {
  date: string
  duration: number
  recommendations: {
    room_id: string
    room_name: string
    room_type: string
    capacity: number
    best_time: { start: string; end: string }
    free_slots_count: number
    score: number
  }[]
}

export interface AnomalyResult {
  anomalies: {
    type: string
    description: string
    reservation_id?: string
    room_id?: string
    user_id?: string
    count?: number
    end_time?: string
    created_at?: string
  }[]
  total: number
}

export const statsApi = {
  usage(orgId: string, buildingId?: string) {
    return api.get<SpaceUsage>('/stats/usage', {
      params: { org_id: orgId, building_id: buildingId },
    })
  },
  trends(orgId: string, days: number = 7) {
    return api.get<ReservationTrends>('/stats/reservation-trends', {
      params: { org_id: orgId, days },
    })
  },
  recommend(orgId: string, date: string, duration: number = 60, roomType?: string, capacity?: number) {
    return api.get<RecommendResult>('/stats/recommend', {
      params: { org_id: orgId, date, duration, room_type: roomType, capacity },
    })
  },
  anomalies(orgId: string) {
    return api.get<AnomalyResult>('/stats/anomalies', {
      params: { org_id: orgId },
    })
  },
}
