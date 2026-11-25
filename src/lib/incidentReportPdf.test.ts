import { expect, it } from "vitest"
import { incidentReportPdf } from "./incidentReportPdf"
import { type ReportSummary } from "./supabase"
it("generates a branded report PDF with the linked order, actual author identity and all observations", async () => {
  const report = {
    report_number: "REP-000123",
    status: "Recibido",
    equipment_identifier: "EQ-000001",
    equipment_snapshot: {
      equipment_type: "Monitor",
      model: "M1",
      serial_number: "SER-123",
    },
    manufacturer: "Fabricante",
    service: "Urgencias",
    location: "Sala 1",
    event_date: "2026-11-25",
    event_type: "Falla",
    incident_label: "No enciende",
    observations: "Observación completa ".repeat(100),
    patient_outcome: "No aplica",
    action_taken: "No aplica",
    created_at: "2026-11-25T12:00:00Z",
    priority: "Alta",
    maintenance_number: "MT-2026-MC-0012",
    reporter_snapshot: {
      full_name: "María García",
      institutional_id: "02181001",
      department: "Enfermería",
    },
  } as ReportSummary
  const blob = await incidentReportPdf(report)
  expect(blob.type).toBe("application/pdf")
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })
  for (const value of [
    "%PDF-",
    "REP-000123",
    "MT-2026-MC-0012",
    "02181001",
    "SER-123",
    "No enciende",
  ])
    expect(text).toContain(value)
  expect(text).toContain("/Count 2")
})
