import { t } from "../lib/i18n"
import { useState } from "react"
import { Download } from "lucide-react"
import type { MaintenanceSummary, ReportSummary } from "../lib/supabase"
import { Button } from "./ui"

export function serviceOrderSections(item: MaintenanceSummary, report?: ReportSummary | null) {
  const date = (value?: string | null) => value ? new Date(value).toLocaleString("es-MX") : "Pendiente"
  const label = (value?: string | null) => value ? ({ critica:"Crítica",alta:"Alta",ordinaria:"Ordinaria",programado:"Programado",en_proceso:"En proceso",completado:"Completado",cancelado:"Cancelado",operativo:"Operativo",en_reparacion:"En reparación",fuera_de_servicio:"Fuera de servicio" } as Record<string,string>)[value] || value : null
  return [
    { title: "Asignación confirmada", fields: [["Orden",item.maintenance_number],["Reporte",item.report_number || report?.report_number],["Técnico",item.assigned_to_name],["Prioridad",label(item.priority)],["Atención programada",date(item.scheduled_at)],["Estado",label(item.status)]] },
    { title: "Equipo y ubicación", fields: [["Inventario",item.equipment_identifier],["Equipo",item.equipment?.equipment_type || report?.equipment_snapshot?.equipment_type],["Fabricante",item.equipment?.manufacturer || report?.manufacturer],["Modelo",item.equipment?.model || report?.equipment_snapshot?.model],["Serie",item.equipment?.serial_number || report?.equipment_snapshot?.serial_number],["Área",report?.service || item.equipment?.hospital_area],["Ubicación del incidente",report?.location || item.equipment?.location]] },
    { title: "Incidente reportado", fields: [["Fecha del evento",report?.event_date],["Tipo de incidente",report?.event_type],["Problema",report?.incident_label || report?.description],["Descripción",report?.description],["Observaciones",report?.observations],["Acción inicial",report?.action_taken],["Resultado para el paciente",report?.patient_outcome]] },
    { title: "Seguimiento técnico", fields: [["Diagnóstico",item.record?.diagnosis],["Trabajo realizado",item.record?.work_performed],["Pruebas",item.record?.test_results],["Condición final",label(item.record?.equipment_condition)],["Observaciones técnicas",item.record?.technical_notes],["Validación",date(item.validated_at)],["Notas de cierre",item.closure_notes]] },
  ]
}
export async function serviceOrderPdf(item: MaintenanceSummary, report?: ReportSummary | null) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF(); let y=22
  const line = (value: string, size=10) => {
    pdf.setFontSize(size)
    for (const text of pdf.splitTextToSize(value,174) as string[]) {
      if(y>277){pdf.addPage();y=22}
      pdf.text(text,18,y);y+=6
    }
  }
  line("BioMedGest · Orden de servicio",17); y+=5
  for(const section of serviceOrderSections(item,report)) {
    if(y>250){pdf.addPage();y=22}
    y+=5;pdf.setFont("helvetica","bold");line(section.title,12);pdf.setFont("helvetica","normal");y+=2
    for(const [label,value] of section.fields) line(`${label}: ${value || "Sin registrar"}`)
  }
  y+=5;line(`Documento de consulta · Generado: ${new Date().toLocaleString("es-MX")}`,9)
  return pdf.output("blob")
}
export function ServiceOrderDocument({ item, report }: { item: MaintenanceSummary; report?: ReportSummary | null }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("")
  async function download(){setBusy(true);setError("");try{const url=URL.createObjectURL(await serviceOrderPdf(item,report));const a=document.createElement("a");a.href=url;a.download=`Orden-${item.maintenance_number.replace(/[^a-z0-9_-]/gi,"_")}.pdf`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),30000)}catch{setError("No fue posible generar el PDF. Intenta nuevamente.")}finally{setBusy(false)}}
  return <><div className="service-order-toolbar"><span className="badge badge-success">{t("Asignación confirmada")}</span><Button icon={Download} disabled={busy} onClick={() => void download()}>{busy ? t("Generando PDF...") : t("Descargar PDF")}</Button></div><div className="service-order-grid">{serviceOrderSections(item,report).map(section=><section className="panel service-order-section" key={section.title}><h3>{t(section.title)}</h3><dl>{section.fields.map(([label,value])=><div key={label}><dt>{t(label!)}</dt><dd>{value || "Sin registrar"}</dd></div>)}</dl></section>)}</div>{error && <p role="alert" className="form-error">{error}</p>}</>
}
