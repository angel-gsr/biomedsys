import { supabase, type ReportSummary } from "./supabase"

export type ReportEquipmentIdentity = {
  id: string; inventory_code: string; equipment_type: string; manufacturer: string;
  model: string; serial_number: string | null; hospital_area: string; location: string | null;
}
export type ReportPreviewData = {
  report: ReportSummary; server_now: string; can_edit: boolean; editable_until: string
}
export type IncidentChanges = Pick<ReportSummary, "event_date" | "event_type" | "description" | "patient_outcome" | "action_taken">
export type TechnovigilanceReview = {
  report_id: number; internal_risk: "catastrofico" | "alto" | "medio" | "bajo";
  failure_type: string; confirmed_on: string | null;
  regulatory_case: "pendiente" | "amenaza_publica" | "muerte_deterioro_grave" | "otro_notificable" | "no_notificable";
  internal_due_on: string; regulatory_due_on: string | null;
  legal_record_reference: string | null; legal_record_completed_on: string | null;
  notification_reference: string | null; notified_on: string | null; notes: string | null;
}
function client() { if (!supabase) throw new Error("Supabase no está configurado"); return supabase }
export async function getReportEquipmentIdentity(id: string) {
  const { data, error } = await client().rpc("get_report_equipment_identity", { target_equipment_id: id })
  if (error) throw error
  return data as ReportEquipmentIdentity
}
export async function getReportPreview(id: number) {
  const { data, error } = await client().rpc("get_report_preview", { target_report_id: id })
  if (error) throw error
  return data as ReportPreviewData
}
export async function editReportIncident(report: ReportSummary, changes: IncidentChanges) {
  const { data, error } = await client().rpc("edit_report_incident", { target_report_id: report.id, changes, expected_edited_at: report.edited_at || null })
  if (error) throw error
  return data as ReportSummary
}
export async function listTechnovigilanceReviews() {
  const { data, error } = await client().from("technovigilance_reviews").select("*")
  if (error) throw error
  return (data || []) as TechnovigilanceReview[]
}
export async function listTechnovigilanceHolidays() {
  const { data, error } = await client().from("technovigilance_holidays").select("holiday,description").order("holiday")
  if (error) throw error
  return (data || []) as { holiday: string; description: string }[]
}
export async function saveTechnovigilanceHoliday(holiday: string, description: string) {
  const { error } = await client().from("technovigilance_holidays").upsert({ holiday, description })
  if (error) throw error
}
export async function removeTechnovigilanceHoliday(holiday: string) {
  const { error } = await client().from("technovigilance_holidays").delete().eq("holiday", holiday)
  if (error) throw error
}
export async function saveTechnovigilanceReview(reportId: number, review: Partial<TechnovigilanceReview>) {
  const { data, error } = await client().rpc("save_technovigilance_review", { target_report_id: reportId, data: review })
  if (error) throw error
  return data as TechnovigilanceReview
}
export async function getMovementLocations() {
  const [areas, locations] = await Promise.all([
    client().from("hospital_areas").select("id,name").eq("active", true).order("name"),
    client().from("equipment_locations").select("id,name,hospital_area_id").eq("active", true).order("name"),
  ])
  if (areas.error) throw areas.error
  if (locations.error) throw locations.error
  return { areas: areas.data as { id: number; name: string }[], locations: locations.data as { id: number; name: string; hospital_area_id: number }[] }
}
export async function moveTechnovigilanceEquipment(id: string, area: number, location: number | null, reason: string) {
  const { error } = await client().rpc("move_technovigilance_equipment", { target_equipment_id: id, target_area_id: area, target_location_id: location, reason })
  if (error) throw error
}

export function remainingEditSeconds(preview: ReportPreviewData, elapsedMs: number) {
  return preview.can_edit ? Math.max(0, Math.ceil((Date.parse(preview.editable_until) - Date.parse(preview.server_now) - elapsedMs) / 1000)) : 0
}

export async function createReportPdf(report: ReportSummary) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF()
  let y = 20
  const field = (label: string, value: string | null | undefined) => {
    const lines = pdf.splitTextToSize(`${label}: ${value || "No registrado"}`, 175) as string[]
    for (const line of lines) { if (y > 277) { pdf.addPage(); y = 20 } pdf.text(line, 18, y); y += 6 }
    y += 3
  }
  pdf.setFontSize(16); pdf.text("BioMedGest - Reporte de incidente", 18, y); y += 12
  pdf.setFontSize(10)
  field("Folio", report.report_number)
  field("Creado", report.created_at)
  field("Última corrección", report.edited_at)
  field("Equipo", report.equipment_snapshot?.equipment_type)
  field("Inventario", report.equipment_identifier)
  field("Fabricante", report.manufacturer)
  field("Modelo", report.equipment_snapshot?.model)
  field("Serie", report.equipment_snapshot?.serial_number)
  field("Modelo / serie registrado", report.model_serial)
  field("Área", report.service); field("Ubicación al reportar", report.location)
  field("Fecha del evento", report.event_date); field("Tipo", report.event_type)
  field("Descripción", report.description); field("Resultado para el paciente", report.patient_outcome)
  field("Acción tomada", report.action_taken); field("Prioridad", report.priority); field("Estado", report.status)
  field("Control de edición", "Correcciones del autor permitidas durante 10 minutos desde el registro. Este PDF refleja el estado consultado.")
  return pdf.output("blob")
}
