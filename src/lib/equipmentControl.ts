import { supabase, type EquipmentStatus } from "./supabase"
export type IncidentOption = { id: number; label: string; source: "inventario" | "reporte"; report_count: number }
export type ManagedEquipment = { id?: string; inventory_code?: string; equipment_type: string; manufacturer: string; model: string; serial_number: string | null; serial_is_placeholder?: boolean; manufacture_year: number | null; acquisition_year: number | null; hospital_area_id: number; location_id: number | null; custodian_location_text: string | null; status: EquipmentStatus }
export type EquipmentAdminContext = { asset: ManagedEquipment | null; areas: { id: number; name: string }[]; locations: { id: number; name: string; hospital_area_id: number }[] }
export type ArchivedEquipment = { id: string; inventory_code: string; equipment_type: string; archive_reason: string }
async function rpc(name: string, args?: Record<string, unknown>) { if (!supabase) throw new Error("Supabase no está configurado"); const { data, error } = await supabase.rpc(name,args); if (error) throw new Error(error.message); return data }
export async function getEquipmentIncidentOptions(id: string) { return (await rpc("get_equipment_incident_options",{ target_equipment_id: id }) || []) as IncidentOption[] }
export async function equipmentAdminContext(id: string | null) { return await rpc("equipment_admin_context",{ target_equipment_id: id }) as EquipmentAdminContext }
export async function saveEquipmentAsset(id: string | null, data: ManagedEquipment, reason: string) { return await rpc("save_equipment_asset",{ target_equipment_id: id,data,reason }) as string }
export async function archiveEquipmentAsset(id: string, reason: string) { await rpc("archive_equipment_asset",{ target_equipment_id: id,reason }) }
export async function restoreEquipmentAsset(id: string, reason: string) { await rpc("restore_equipment_asset",{ target_equipment_id: id,reason }) }
export async function listArchivedEquipment() { return (await rpc("list_archived_equipment") || []) as ArchivedEquipment[] }
