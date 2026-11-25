import { supabase, type EquipmentDocument } from "./supabase"
function client() {
  if (!supabase) throw new Error("Supabase no está configurado")
  return supabase
}
export function validDocumentUrl(value: string) {
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
export async function saveEquipmentDocument(
  equipmentId: string,
  document: Pick<EquipmentDocument, "title" | "document_type" | "url">,
  id?: number,
) {
  const url = validDocumentUrl(document.url)
  if (!url)
    throw new Error("Usa una URL http o https válida, sin credenciales.")
  const { data, error } = await client().rpc("save_equipment_document_link", {
    target_equipment_id: equipmentId,
    target_document_id: id || null,
    document_title: document.title,
    document_kind: document.document_type,
    document_url: url,
  })
  if (error) throw error
  return Number(data)
}
export async function removeEquipmentDocument(equipmentId: string, id: number) {
  const { error } = await client().rpc("remove_equipment_document_link", {
    target_equipment_id: equipmentId,
    target_document_id: id,
  })
  if (error) throw error
}
export async function updateEquipmentFile(
  id: string,
  title: string,
  description: string,
) {
  const { error } = await client().rpc("update_equipment_attachment_info", {
    target_attachment_id: id,
    file_title: title,
    file_description: description,
  })
  if (error) throw error
}
export type EquipmentIncident = {
  id: number
  report_number: string
  created_at: string
  event_date: string
  incident: string
  observations: string | null
  status: string
  priority: string
  maintenance_number: string | null
}
export async function getEquipmentIncidentHistory(id: string) {
  const { data, error } = await client().rpc("get_equipment_incident_history", {
    target_equipment_id: id,
  })
  if (error) throw error
  return (data || []) as EquipmentIncident[]
}
