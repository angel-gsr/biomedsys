import { supabase } from "./supabase"
export type MaintenanceDates = {
  program_id: number
  program_name: string
  periodicity: string | null
  interval_months: number | null
  last_on: string | null
  next_on: string | null
  reported_last_on: string | null
  reported_next_on: string | null
  notes: string | null
}
export async function getMaintenanceDates(id: string) {
  if (!supabase) throw new Error("Supabase no está configurado")
  const { data, error } = await supabase.rpc(
    "get_equipment_maintenance_dates",
    { target_equipment_id: id },
  )
  if (error) throw error
  return (data || []) as MaintenanceDates[]
}
export function maintenanceDateLabel(value: string | null) {
  return value
    ? new Date(value + "T12:00:00").toLocaleDateString("es-MX", {
        dateStyle: "long",
      })
    : "Sin fecha registrada"
}
