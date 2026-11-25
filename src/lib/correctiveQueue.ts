import { supabase, type MaintenanceSummary } from "./supabase"
export type AvailableCorrectiveOrder = {
  id: number
  maintenance_number: string
  equipment_identifier: string
  equipment_id: string
  source_report_id: number
  report_number: string
  description: string
  service: string
  location: string | null
  priority: string
  created_at: string
}
export async function listAvailableCorrectiveOrders() {
  if (!supabase) throw new Error("Supabase no está configurado")
  const { data, error } = await supabase.rpc("list_available_corrective_orders")
  if (error) throw error
  return (data || []) as AvailableCorrectiveOrder[]
}
export async function claimCorrectiveOrder(id: number) {
  if (!supabase) throw new Error("Supabase no está configurado")
  const { data, error } = await supabase.rpc("claim_corrective_order", {
    target_maintenance_id: id,
  })
  if (error) throw error
  return data as MaintenanceSummary
}
