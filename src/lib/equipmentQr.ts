import { listEquipmentInventory, type Role } from "./supabase"

export function parseEquipmentQr(raw: string): { id?: string; code?: string } | null {
  const value = raw.trim()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuid.test(value)) return { id: value }
  if (/^EQ-\d+$/i.test(value)) return { code: value.toUpperCase() }
  try {
    const url = new URL(value)
    const id = url.searchParams.get("equipment")
    if (["https:", "http:"].includes(url.protocol) && id && uuid.test(id)) return { id }
  } catch { /* Unrecognized QR content. */ }
  return null
}

export async function findEquipmentQr(raw: string, role: Role) {
  const target = parseEquipmentQr(raw)
  if (!target) throw new Error("Este QR no contiene un identificador de equipo válido de BioMedGest.")
  // Resolve through the role-aware directory: QR labels do not grant extra access.
  const equipment = await listEquipmentInventory(role, target.code ? { searchTerm: target.code } : {})
  const match = equipment.find((item) => target.id ? item.id === target.id.toLowerCase() : item.inventory_code.toUpperCase() === target.code)
  if (!match) throw new Error("No se encontró este equipo entre los registros disponibles para tu cuenta.")
  return match
}
