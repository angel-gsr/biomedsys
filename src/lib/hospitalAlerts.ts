import { supabase } from "./supabase"
export type HospitalCode = { code: string; name: string; description: string; color: string; audience: "todos" | "biomedicos"; audible: boolean; sort_order: number }
export type HospitalAlert = HospitalCode & { id: number; code_name: string; code_description: string; emitted_by: string; emitter_name: string; emitter_institutional_id: string | null; emitter_role: string | null; emitter_department: string | null; location: string; details: string | null; status: "activa" | "en_atencion" | "cerrada"; created_at: string; responder_name: string | null; closure_notes: string | null }
function client() { if (!supabase) throw new Error("Supabase no está configurado."); return supabase }
export async function listHospitalCodes() {
  const { data, error } = await client().from("hospital_codes").select("*").order("sort_order")
  if (error) throw error
  return (data || []) as HospitalCode[]
}
export async function loadHospitalInbox() {
  const db = client()
  const [codes, alerts, unread] = await Promise.all([
    db.from("hospital_codes").select("*").order("sort_order"),
    db.rpc("list_hospital_alerts", { include_closed: false }),
    db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ])
  if (codes.error || alerts.error || unread.error) throw new Error("No fue posible actualizar las alertas. Reintentando la conexión.")
  return { codes: (codes.data || []) as HospitalCode[], alerts: (alerts.data || []) as HospitalAlert[], unread: unread.count || 0 }
}
export async function emitHospitalAlert(code: string, location: string, details: string, requestId: string) {
  const { data, error } = await client().rpc("emit_hospital_alert", { target_code: code, target_location: location, alert_details: details, client_request_id: requestId })
  if (error) throw new Error(error.message)
  return Number(data)
}
export async function updateHospitalAlert(id: number, status: "en_atencion" | "cerrada", resolution = "") {
  const { error } = await client().rpc("update_hospital_alert", { target_alert_id: id, target_status: status, resolution })
  if (error) throw new Error(error.message)
}

export { HospitalSound } from "./hospitalSound"
