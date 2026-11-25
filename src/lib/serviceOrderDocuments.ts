import {
  supabase,
  type MaintenanceSummary,
  type ReportSummary,
} from "./supabase"
export type IssuedServiceOrder = {
  id: number
  maintenance_id: number
  issued_by: string
  issued_at: string
  record_updated_at: string
  signature_png: string | null
  snapshot: {
    item: MaintenanceSummary
    report: ReportSummary | null
  }
}
export async function getServiceOrderDocument(id: number) {
  if (!supabase) throw new Error("Supabase no está configurado")
  const { data, error } = await supabase.rpc("get_service_order_document", {
    target_maintenance_id: id,
  })
  if (error) throw error
  return data as IssuedServiceOrder | null
}
export async function issueServiceOrderDocument(
  id: number,
  signature?: string,
) {
  if (!supabase) throw new Error("Supabase no está configurado")
  const { data, error } = await supabase.rpc("issue_service_order_document", {
    target_maintenance_id: id,
    signature_data: signature || null,
  })
  if (error) throw error
  return data as IssuedServiceOrder
}
