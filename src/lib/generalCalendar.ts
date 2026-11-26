import { supabase, type Role } from "./supabase"
export type CalendarKind = "cirugia" | "mantenimiento" | "capacitacion" | "uso_equipo" | "evento"
export type CalendarEvent = { all_day?:boolean; schedule_date?:string; planned_only?:boolean; event_key: string; kind: CalendarKind; title: string; starts_at: string; ends_at: string | null; location_id: number | null; location_name: string | null; equipment_ids: string[]; status: string; blocks_resources: boolean; responsible_name?: string | null; description?: string | null; audience?: Role[] | null; can_cancel?: boolean; can_view_loan?: boolean }
export type CalendarOptions = { locations: { id: number; name: string }[]; equipment: { id: string; name: string }[]; programs: { equipment_id: string; id: number; name: string }[]; technicians: { id: string; name: string }[] }
export const calendarKindLabels: Record<CalendarKind, string> = { cirugia: "Cirugía", mantenimiento: "Mantenimiento", capacitacion: "Capacitación", uso_equipo: "Uso de equipo", evento: "Evento" }
function client() { if (!supabase) throw new Error("Supabase no está configurado"); return supabase }
export async function listGeneralCalendar(from: string, to: string) {
  const { data, error } = await client().rpc("list_role_calendar", { from_time: from, to_time: to })
  if (error) throw error
  return (data || []) as CalendarEvent[]
}
export async function generalCalendarOptions() {
  const { data, error } = await client().rpc("role_calendar_options")
  if (error) throw error
  return data as CalendarOptions
}
export async function saveOrganizedEvent(input: { id: number | null; title: string; description: string; location: string; start: string; end: string; audience: Role[] }) {
  const { error } = await client().rpc("save_organized_event", {target_id:input.id,event_title:input.title,event_description:input.description,event_location:input.location,start_time:input.start,end_time:input.end,target_roles:input.audience})
  if(error) throw error
}
export async function cancelOrganizedEvent(id: number) {
  const {error}=await client().rpc("cancel_organized_event",{target_id:id});if(error)throw error
}
export async function requestEquipmentUse(input:{equipmentId:string;start:string;end:string;location:string}) {
  const {data,error}=await client().rpc("request_equipment_use",{target_equipment:input.equipmentId,start_time:input.start,end_time:input.end,usage_location:input.location})
  if(error)throw error
  return Number(data)
}
export async function cancelEquipmentUse(id:number) {
  const {error}=await client().rpc("cancel_equipment_use",{target_booking_id:id});if(error)throw error
}
export type CalendarEventInput = { key: string | null; kind: CalendarKind; title: string; start: string; end: string; locationId: number | null; equipmentIds: string[]; programId: number | null; assigneeId: string | null }
export async function saveGeneralCalendarEvent(input: CalendarEventInput) {
  const { data, error } = await client().rpc("save_general_calendar_event", { target_key: input.key, event_kind: input.kind, event_title: input.title, start_time: input.start, end_time: input.end, target_location: input.locationId, target_equipment: input.equipmentIds, target_program: input.programId, target_assignee: input.assigneeId })
  if (error) throw error
  return data as string
}
export async function cancelGeneralCalendarEvent(key: string) {
  const { error } = await client().rpc("cancel_general_calendar_event", { target_key: key })
  if (error) throw error
}
export function calendarEventsOverlap(a: Pick<CalendarEvent, "starts_at" | "ends_at" | "location_id" | "equipment_ids">, b: CalendarEvent) {
  return b.blocks_resources && Date.parse(a.starts_at) < (b.ends_at ? Date.parse(b.ends_at) : Infinity) && Date.parse(b.starts_at) < (a.ends_at ? Date.parse(a.ends_at) : Infinity) && ((a.location_id !== null && a.location_id === b.location_id) || a.equipment_ids.some((id) => b.equipment_ids.includes(id)))
}
export function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }
export function eventOnDay(event: CalendarEvent, day: string) {
  if(event.all_day && event.schedule_date)return event.schedule_date===day
  const start = new Date(`${day}T00:00:00`), end = new Date(start)
  end.setDate(end.getDate() + 1)
  return event.ends_at ? Date.parse(event.starts_at) < end.getTime() && Date.parse(event.ends_at) > start.getTime() : localDateKey(new Date(event.starts_at)) === day
}
