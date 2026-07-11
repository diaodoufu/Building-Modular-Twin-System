import api from './index'

export interface ReservationRead {
  id: string
  room_id: string
  user_id: string
  title: string | null
  start_time: string
  end_time: string
  status: string
  reviewed_by: string | null
  created_at: string
}

export interface RoomAvailability {
  room_id: string
  date: string
  slots: { start: string; end: string; status: string }[]
}

export const reservationApi = {
  list(params?: { room_id?: string; user_id?: string; status?: string }) {
    return api.get<ReservationRead[]>('/reservations', { params })
  },
  my() {
    return api.get<ReservationRead[]>('/reservations/my')
  },
  get(id: string) {
    return api.get<ReservationRead>(`/reservations/${id}`)
  },
  availability(roomId: string, date: string) {
    return api.get<RoomAvailability>(`/reservations/availability/${roomId}`, { params: { date } })
  },
  create(data: { room_id: string; title?: string; start_time: string; end_time: string }) {
    return api.post<ReservationRead>('/reservations', data)
  },
  update(id: string, data: any) {
    return api.put<ReservationRead>(`/reservations/${id}`, data)
  },
  cancel(id: string) {
    return api.post<ReservationRead>(`/reservations/${id}/cancel`)
  },
}
