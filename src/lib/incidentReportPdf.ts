import { type ReportSummary } from "./supabase"
export async function incidentReportPdf(report: ReportSummary) {
  const { jsPDF } = await import("jspdf"),
    pdf = new jsPDF({ unit: "mm", format: "a4" })
  let y = 65
  const blue = [11, 95, 165] as const,
    ink = [28, 49, 68] as const
  function logo(x: number, top: number, size: number, pale = false) {
    pdf.setFillColor(pale ? 244 : 11, pale ? 247 : 95, pale ? 250 : 165)
    pdf.roundedRect(x, top, size, size, size * 0.2, size * 0.2, "F")
    pdf.setDrawColor(pale ? 230 : 255, pale ? 237 : 255, pale ? 244 : 255)
    pdf.setLineWidth(size * 0.07)
    const points = [
      [10, 33],
      [22, 33],
      [28, 21],
      [37, 46],
      [43, 33],
      [54, 33],
    ]
    for (let i = 1; i < points.length; i++)
      pdf.line(
        x + (points[i - 1][0] / 64) * size,
        top + (points[i - 1][1] / 64) * size,
        x + (points[i][0] / 64) * size,
        top + (points[i][1] / 64) * size,
      )
  }
  function header() {
    logo(53, 105, 104, true)
    logo(14, 14, 13)
    pdf.setTextColor(...blue)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(18)
    pdf.text("BioMedGest", 31, 21)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(...ink)
    pdf.setFontSize(9)
    pdf.text("Gestión de equipo médico", 31, 26)
    pdf.setFillColor(...blue)
    pdf.roundedRect(14, 36, 182, 14, 2, 2, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(13)
    pdf.setTextColor(255, 255, 255)
    pdf.text("REPORTE DE FALLA DE EQUIPO MÉDICO", 19, 45)
    pdf.setTextColor(...ink)
    pdf.setFontSize(10)
    pdf.text(report.report_number, 14, 58)
    pdf.setFont("helvetica", "normal")
    pdf.text(report.status, 196, 58, { align: "right" })
  }
  header()
  function room(height: number) {
    if (y + height > 275) {
      pdf.addPage()
      header()
      y = 65
    }
  }
  function section(text: string) {
    room(12)
    pdf.setFillColor(232, 240, 248)
    pdf.rect(14, y, 182, 8, "F")
    pdf.setTextColor(...blue)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text(text, 18, y + 5.5)
    y += 11
  }
  function field(label: string, value?: string | null) {
    const text = value?.trim() || "No registrado"
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    const lines = pdf.splitTextToSize(text, 172) as string[]
    room(12)
    pdf.setTextColor(77, 99, 118)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.text(label, 18, y)
    y += 5
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(...ink)
    for (const line of lines) {
      room(5)
      pdf.text(line, 18, y)
      y += 4.5
    }
    y += 4
  }
  const equipment = report.equipment_snapshot,
    author = report.reporter_snapshot
  section("IDENTIFICACIÓN DEL EQUIPO")
  field(
    "EQUIPO / INVENTARIO",
    `${equipment?.equipment_type || "Equipo registrado"} · ${report.equipment_identifier}`,
  )
  field(
    "FABRICANTE / MODELO / SERIE",
    [report.manufacturer, equipment?.model, equipment?.serial_number]
      .filter(Boolean)
      .join(" · ") || report.model_serial,
  )
  field(
    "ÁREA Y UBICACIÓN AL REPORTAR",
    [report.service, report.location].filter(Boolean).join(" · "),
  )
  section("INCIDENTE REPORTADO")
  field(
    "FECHA DEL EVENTO / TIPO",
    `${report.event_date} · ${report.event_type}`,
  )
  field("FALLA SELECCIONADA", report.incident_label || report.description)
  field(
    "OBSERVACIONES ADICIONALES",
    report.observations || "Sin observaciones adicionales",
  )
  field(
    "RESULTADO PARA EL PACIENTE / ACCIÓN TOMADA",
    [
      report.patient_outcome || "No aplica",
      report.action_taken || "No aplica",
    ].join(" · "),
  )
  section("REGISTRO Y SEGUIMIENTO")
  field(
    "AUTOR / ID INSTITUCIONAL / DEPARTAMENTO",
    author
      ? [author.full_name, author.institutional_id, author.department]
          .filter(Boolean)
          .join(" · ")
      : "Autor registrado en el sistema",
  )
  field(
    "REGISTRADO / PRIORIDAD",
    `${new Date(report.created_at).toLocaleString("es-MX")} · ${report.priority}`,
  )
  field(
    "ORDEN CORRECTIVA",
    report.maintenance_number ||
      (report.maintenance_id
        ? "Orden vinculada al reporte"
        : "Pendiente de vinculación"),
  )
  if (report.edited_at)
    field(
      "ÚLTIMA CORRECCIÓN",
      new Date(report.edited_at).toLocaleString("es-MX"),
    )
  room(28)
  pdf.setFontSize(8)
  pdf.setTextColor(...ink)
  pdf.text(
    "Nombre y firma del reportante: __________________________________________________",
    14,
    y + 12,
  )
  y += 23
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(92, 110, 125)
    pdf.text(
      `${report.report_number} · BioMedGest · ${page}/${pdf.getNumberOfPages()}`,
      14,
      286,
    )
    pdf.text(
      "Documento del estado consultado. Las correcciones del autor se permiten durante 10 minutos.",
      14,
      291,
    )
  }
  pdf.setProperties({
    title: `Reporte ${report.report_number}`,
    author: "BioMedGest",
    subject: "Falla de equipo médico",
  })
  return pdf.output("blob")
}
