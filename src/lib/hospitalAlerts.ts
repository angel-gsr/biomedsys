import { supabase } from "./supabase"
export type HospitalCode = { code: string; name: string; description: string; color: string; audience: "todos" | "biomedicos"; audible: boolean; sort_order: number }
export type HospitalAlert = HospitalCode & { id: number; code_name: string; code_description: string; emitted_by: string; emitter_name: string; location: string; details: string | null; status: "activa" | "en_atencion" | "cerrada"; created_at: string; responder_name: string | null; closure_notes: string | null }
function client() { if (!supabase) throw new Error("Supabase no está configurado."); return supabase }
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

export class HospitalSound {
  private context?: AudioContext
  async enable() {
    this.context ||= new AudioContext()
    await this.context.resume()
    if (this.context.state !== "running") throw new Error("Activa el sonido desde este botón para permitir la alerta audible.")
  }
  play() {
    const context = this.context
    if (!context || context.state !== "running") return false
    for (let i = 0; i < 3; i++) {
      const oscillator = context.createOscillator(), gain = context.createGain()
      const start = context.currentTime + i * .35
      oscillator.type = "sine"; oscillator.frequency.value = i % 2 ? 660 : 880
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.12, start + .02); gain.gain.exponentialRampToValueAtTime(.001, start + .25)
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .27)
    }
    return true
  }
  async stop() { if (this.context) { const context=this.context; this.context=undefined; await context.close() } }
}
