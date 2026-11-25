import type { PurchaseRequisition } from "./purchaseRequisition"
export async function purchaseRequisitionPdf(record: PurchaseRequisition) {
  const { jsPDF } = await import("jspdf"),
    pdf = new jsPDF({ unit: "mm", format: "a4" }),
    data = record.data
  const blue = [11, 95, 165] as const,
    ink = [28, 49, 68] as const,
    widths = [8, 14, 12, 20, 53, 23, 18, 34],
    xs = [14]
  for (let i = 0; i < widths.length; i++) xs.push(xs[i] + widths[i])
  const number = (value: number) =>
    new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  const date = (value?: string | null) => value ? value.length===10?value.split('-').reverse().join('/'):new Date(value).toLocaleDateString("es-MX",{timeZone:"America/Mexico_City"}) : "Por definir"
  let y = 60
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
  function brand() {
    logo(53, 105, 104, true)
    logo(14, 14, 13)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(18)
    pdf.setTextColor(...blue)
    pdf.text("BioMedGest", 31, 21)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(...ink)
    pdf.text("Ingeniería Biomédica · Gestión de equipo médico", 31, 26)
    pdf.setFillColor(...blue)
    pdf.roundedRect(14, 35, 182, 14, 2, 2, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(14)
    pdf.setTextColor(255, 255, 255)
    pdf.text("REQUISICIÓN DE COMPRA", 19, 44)
    pdf.setTextColor(...ink)
    pdf.setFontSize(10)
    pdf.text(record.requisition_number, 14, 56)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text(
      `Fecha: ${date(record.created_at)} · Moneda: ${data.currency}`,
      196,
      56,
      { align: "right" },
    )
    y = 63
  }
  function tableHead() {
    pdf.setFillColor(232, 240, 248)
    pdf.setDrawColor(165, 184, 202)
    pdf.setLineWidth(0.2)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7)
    pdf.setTextColor(...blue)
    const labels = [
      "No.",
      "Cantidad",
      "U/M",
      "Catálogo\nproveedor",
      "Descripción",
      "Precio\nunitario",
      "Descuento\n(%)",
      "Importe",
    ]
    for (let i = 0; i < widths.length; i++) {
      pdf.setFillColor(...blue)
      pdf.rect(xs[i], y, widths[i], 11, "FD")
      pdf.setTextColor(255,255,255)
      pdf.text(pdf.splitTextToSize(labels[i],widths[i]-3), xs[i] + 1.5, y + 4)
    }
    y += 11
    pdf.setTextColor(...ink)
    pdf.setFont("helvetica", "normal")
  }
  function nextPage(table = false) {
    pdf.addPage()
    brand()
    if (table) tableHead()
  }
  function room(height: number, table = false) {
    if (y + height > 273) nextPage(table)
  }
  function fields(
    x: number,
    top: number,
    values: [string, string][],
    width: number,
  ) {
    let pos = top
    for (const [label, value] of values) {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(7)
      pdf.setTextColor(77, 99, 118)
      pdf.text(label, x, pos)
      pos += 4
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(...ink)
      const lines = pdf.splitTextToSize(value, width) as string[]
      pdf.text(lines, x, pos)
      pos += lines.length * 3.6 + 3
    }
    return pos
  }
  brand()
  const left = fields(
    17,
    y,
    [
      ["HOSPITAL", data.hospital],
      ["DEPARTAMENTO SOLICITANTE", data.department],
      [
        "SOLICITÓ / ID INSTITUCIONAL",
        `${data.requester.full_name} · ${data.requester.institutional_id}`,
      ],
      ["EQUIPO O SERVICIO", data.purpose],
      ["FECHA REQUERIDA", date(data.required_on)],
    ],
    82,
  )
  const right = fields(
    109,
    y,
    [
      ["PROVEEDOR", data.supplier],
      [
        "TELÉFONO / CORREO",
        [data.supplier_phone, data.supplier_email]
          .filter(Boolean)
          .join(" · ") || "No proporcionado",
      ],
      ["DIRECCIÓN", data.supplier_address || "No proporcionada"],
      ["CONDICIONES DE PAGO", data.payment_terms || "Por definir"],
      ["FECHA DE ENTREGA", date(data.delivery_on)],
    ],
    83,
  )
  y = Math.max(left, right) + 1
  pdf.setDrawColor(165, 184, 202)
  pdf.setLineWidth(0.2)
  pdf.line(14, y, 196, y)
  y += 6
  pdf.setFontSize(8)
  pdf.text(
    `Activo fijo: ${data.fixed_asset ? "Sí" : "No"}     Fuera de línea: ${
      data.out_of_line ? "Sí" : "No"
    }`,
    17,
    y,
  )
  y += 7
  room(30)
  tableHead()
  for (let index = 0; index < data.items.length; index++) {
    const item = data.items[index]
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    const values = [
      String(index + 1),
      String(item.quantity),
      item.unit,
      item.supplier_catalog || "—",
      item.description,
      number(Number(item.unit_cost)),
      number(Number(item.discount_percent)),
      number(Number(item.line_total)),
    ]
    const lines = values.map(
        (text, i) => pdf.splitTextToSize(text, widths[i] - 3) as string[],
      ),
      height = Math.max(9, ...lines.map((value) => value.length * 3.6 + 4))
    room(height, true)
    pdf.setFontSize(8)
    pdf.setDrawColor(165, 184, 202)
    pdf.setLineWidth(0.2)
    pdf.setTextColor(...ink)
    for (let i = 0; i < widths.length; i++) {
      pdf.rect(xs[i], y, widths[i], height)
      pdf.text(lines[i], xs[i] + 1.5, y + 5)
    }
    y += height
  }
  if (pdf.getNumberOfPages() === 1) {
    for (let i = data.items.length; i < 6 && y + 9 + 72 <= 273; i++) {
      pdf.setDrawColor(165, 184, 202)
      for (let col = 0; col < widths.length; col++)
        pdf.rect(xs[col], y, widths[col], 9)
      y += 9
    }
  }
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  const notes = pdf.splitTextToSize(
      data.notes?.trim() || "Sin observaciones adicionales.",
      119,
    ) as string[]
  while(notes.length>40){
    room(45)
    const capacity=Math.max(1,Math.floor((269-y-13)/3.6)),chunk=notes.splice(0,Math.min(capacity,notes.length-40)),height=Math.max(20,chunk.length*3.6+13)
    y+=4;pdf.setDrawColor(165,184,202);pdf.setLineWidth(.2);pdf.rect(14,y,125,height);pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.text('OBSERVACIONES ESPECIALES · CONTINUACIÓN',18,y+6);pdf.setFont('helvetica','normal');pdf.text(chunk,18,y+12);y+=height+5
  }
  const summaryHeight = Math.max(29, notes.length * 3.6 + 13)
  room(summaryHeight + 43)
  y += 4
  pdf.setDrawColor(165, 184, 202)
  pdf.setLineWidth(0.2)
  pdf.rect(14, y, 125, summaryHeight)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("OBSERVACIONES ESPECIALES", 18, y + 6)
  pdf.setFont("helvetica", "normal")
  pdf.text(notes, 18, y + 12)
  const totals = [
    ["Subtotal", record.subtotal],
    [`IVA (${record.tax_percent}%)`, record.tax_amount],
    ["TOTAL", record.total],
  ] as const
  for (let i = 0; i < totals.length; i++) {
    pdf.setFillColor(
      i === 2 ? 232 : 248,
      i === 2 ? 240 : 250,
      i === 2 ? 248 : 252,
    )
    pdf.rect(143, y + i * 9.5, 53, 9.5, "FD")
    pdf.setFont("helvetica", i === 2 ? "bold" : "normal")
    pdf.setFontSize(8)
    pdf.text(totals[i][0], 146, y + 6 + i * 9.5)
    pdf.text(number(Number(totals[i][1])), 193, y + 6 + i * 9.5, {
      align: "right",
    })
  }
  y += summaryHeight + 8
  const signers = [
    "Jefe del área solicitante",
    "Compras",
    "Dirección de área",
    "Dirección general",
  ]
  for (let i = 0; i < signers.length; i++) {
    const x = 14 + i * 45.5
    pdf.setDrawColor(165, 184, 202)
    pdf.rect(x, y, 45.5, 31)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.text(pdf.splitTextToSize(signers[i], 40), x + 3, y + 5)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.text("Nombre y firma", x + 3, y + 19)
    pdf.line(x + 3, y + 22, x + 42, y + 22)
    pdf.text("Fecha: __________________", x + 3, y + 28)
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(92, 110, 125)
    pdf.text(
      `${record.requisition_number} · BioMedGest · ${page}/${pdf.getNumberOfPages()}`,
      14,
      284,
    )
    pdf.text(
      `Documento para revisión y firmas · Actualizado: ${new Date(record.updated_at).toLocaleString("es-MX")}`,
      14,
      290,
    )
  }
  pdf.setProperties({
    title: `Requisición de compra ${record.requisition_number}`,
    author: "BioMedGest",
    subject: "Requisición de compra de equipo, materiales o servicios",
  })
  return pdf.output("blob")
}
