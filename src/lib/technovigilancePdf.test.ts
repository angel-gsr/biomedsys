import { expect, it } from "vitest"
import { technovigilancePdf } from "./technovigilancePdf"
import type { TechnovigilanceDocumentData } from "./technovigilance"
it("creates a distinct branded safety PDF with saved assessment, operator harm and reviewer identity", async () => {
  const data = {
    generated_at: "2026-11-25T12:00:00Z",
    report: {
      report_number: "REP-99",
      equipment_identifier: "EQ-1",
      operator_outcome: "Lesión grave",
      priority: "Alta",
      event_date: "2026-11-25",
    },
    review: {
      event_classification: "incidente_adverso",
      affected_person: "operador",
      impact_description: "Consecuencia grave documentada",
      safety_actions: "Retiro y resguardo del dispositivo",
      failure_type: "Falla de aislamiento",
      internal_risk: "alto",
      regulatory_case: "pendiente",
      notes: "Seguimiento completo ".repeat(300),
    },
    reviewer: {
      full_name: "Ana Biomedica",
      institutional_id: "01181000",
      department: "Ingenieria Clinica",
    },
  } as TechnovigilanceDocumentData
  const blob = await technovigilancePdf(data),
    text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(blob)
    })
  for (const value of [
    "%PDF-",
    "TV-REP-99",
    "Consecuencia grave documentada",
    "Retiro y resguardo",
    "01181000",
    "Ana Biomedica",
  ])
    expect(text).toContain(value)
  expect(text).toMatch(/\/Count [2-9]/)
})
