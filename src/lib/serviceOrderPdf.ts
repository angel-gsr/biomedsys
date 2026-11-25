import type { MaintenanceSummary } from "./supabase"
export type ServiceOrderPdfOptions = {
  title?: string
  subtitle?: string
  footerNote?: string
  compact?: boolean
  final?: boolean
  signature?: string | null
  issuedAt?: string
  documentId?: number
}
export async function buildServiceOrderPdf(
  item: MaintenanceSummary,
  sections: {
    title: string
    fields: (string | null | undefined)[][]
  }[],
  options: ServiceOrderPdfOptions = {},
) {
  const { jsPDF } = await import("jspdf"),
    pdf = new jsPDF({ unit: "mm", format: "a4" })
  let y = 64
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
    pdf.text("Ingeniería Biomédica · Gestión de equipo médico", 31, 26)
    pdf.setFillColor(...blue)
    pdf.roundedRect(14, 35, 182, 14, 2, 2, "F")
    pdf.setFontSize(13)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(255, 255, 255)
    pdf.text(
      options.title ||
        (options.final
          ? "ORDEN DE SERVICIO · INFORME TÉCNICO FINAL"
          : "ORDEN DE SERVICIO · ATENCIÓN PROGRAMADA"),
      18,
      44,
    )
    pdf.setTextColor(...ink)
    pdf.setFontSize(10)
    pdf.text(item.maintenance_number, 14, 57)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text(
      options.subtitle ||
        (options.final
          ? `Documento ${options.documentId || "final"}`
          : "Seguimiento pendiente / en elaboración"),
      196,
      57,
      { align: "right" },
    )
  }
  function room(height: number) {
    if (y + height > 273) {
      pdf.addPage()
      header()
      y = 64
    }
  }
  header()
  for (const section of sections) {
    if (options.final && section.title === "Seguimiento técnico") {
      pdf.addPage()
      header()
      y = 64
    }
    room(25)
    pdf.setFillColor(232, 240, 248)
    pdf.rect(14, y, 182, 8, "F")
    pdf.setTextColor(...blue)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text(section.title.toLocaleUpperCase("es-MX"), 18, y + 5.5)
    y += options.compact?10:14
    if (
      section.title !== "Seguimiento técnico" &&
      section.fields.every(([, value]) => !value || value.length < 1000)
    ) {
      for (let index = 0; index < section.fields.length; index += 2) {
        const pair = section.fields.slice(index, index + 2)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9)
        const lines = pair.map(
          ([, value]) =>
            pdf.splitTextToSize(
              value?.trim() || "Pendiente / no registrado",
              80,
            ) as string[],
        )
        const height = (options.compact?4.5:7) + Math.max(...lines.map((value) => value.length)) * 4.5
        room(height)
        pair.forEach(([label], column) => {
          const x = 18 + column * 90
          pdf.setFont("helvetica", "bold")
          pdf.setFontSize(8)
          pdf.setTextColor(77, 99, 118)
          pdf.text(label || "", x, y)
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(9)
          pdf.setTextColor(...ink)
          pdf.text(lines[column], x, y + 5)
        })
        y += height
      }
      continue
    }
    for (const [label, value] of section.fields) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      const lines = pdf.splitTextToSize(
        value?.trim() || "Pendiente / no registrado",
        170,
      ) as string[]
      room(14)
      pdf.setTextColor(77, 99, 118)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      pdf.text(label || "", 18, y)
      y += 5
      pdf.setTextColor(...ink)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      for (const line of lines) {
        room(5)
        pdf.text(line, 18, y)
        y += 4.5
      }
      y += 4
    }
  }
  if (options.final) {
    room(48)
    pdf.setDrawColor(160, 179, 196)
    pdf.setLineWidth(0.3)
    if (options.signature)
      pdf.addImage(options.signature, "PNG", 20, y + 2, 80, 21)
    pdf.line(18, y + 25, 117, y + 25)
    pdf.setFontSize(9)
    pdf.setTextColor(...ink)
    pdf.text("Firma del ingeniero biomédico responsable", 18, y + 30)
    pdf.setFontSize(8)
    for (const line of pdf.splitTextToSize(
      item.assigned_to_name || "Por asignar",
      170,
    ) as string[]) {
      pdf.text(line, 18, y + 35)
      y += 4
    }
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(92, 110, 125)
    pdf.text(
      `${item.maintenance_number} · BioMedGest · ${page}/${pdf.getNumberOfPages()}`,
      14,
      282,
    )
    pdf.text(
      `Emitido: ${new Date(options.issuedAt || Date.now()).toLocaleString("es-MX")}`,
      14,
      287,
    )
    pdf.text(
      options.footerNote ||
        (options.final
          ? item.validated_at
            ? "Cierre validado por jefatura."
            : "Informe técnico final. Validación administrativa pendiente."
          : "Documento inicial de la orden; el seguimiento corresponde al ingeniero asignado."),
      14,
      292,
    )
  }
  pdf.setProperties({
    title:
      options.title ||
      `Orden ${item.maintenance_number}${
        options.final ? " · Informe final" : ""
      }`,
    author: "BioMedGest",
    subject: options.title || "Orden de servicio de equipo médico",
  })
  return pdf.output("blob")
}
