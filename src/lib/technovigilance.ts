import { supabase, type ReportSummary } from "./supabase"
import type { TechnovigilanceReview } from "./reportManagement"
const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
export function hasAdverseOutcome(value?: string | null) {
  return [
    "lesion temporal",
    "lesion moderada",
    "lesion grave",
    "fallecimiento",
  ].includes(normalize(value))
}
export function needsTechnovigilance(report: Partial<ReportSummary>) {
  return (
    ["alta", "critica"].includes(normalize(report.priority)) ||
    Boolean(report.potential_harm) ||
    hasAdverseOutcome(report.patient_outcome) ||
    hasAdverseOutcome(report.operator_outcome) ||
    ["incidente adverso", "incidente adverso potencial"].includes(
      normalize(report.event_type),
    )
  )
}
export async function listTechnovigilanceCandidates() {
  if (!supabase) throw new Error("Supabase no está configurado")
  const { data, error } = await supabase.rpc("list_technovigilance_candidates")
  if (error) throw error
  return (data || []) as ReportSummary[]
}
export type TechnovigilanceDocumentData = {
  report: ReportSummary
  review: TechnovigilanceReview
  reviewer: {
    full_name: string
    institutional_id: string
    department: string | null
  }
  generated_at: string
}
export async function getTechnovigilanceDocument(id: number) {
  if (!supabase) throw new Error("Supabase no está configurado")
  const { data, error } = await supabase.rpc("get_technovigilance_document", {
    target_report_id: id,
  })
  if (error) throw error
  return data as TechnovigilanceDocumentData
}
