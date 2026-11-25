import { expect, it } from "vitest"
import { needsTechnovigilance } from "./technovigilance"
it("keeps ordinary equipment failures out of the special safety workflow", () => {
  expect(
    needsTechnovigilance({
      priority: "Ordinaria",
      event_type: "Falla",
      patient_outcome: "No aplica",
      operator_outcome: "Sin lesión",
      potential_harm: false,
    }),
  ).toBe(false)
  expect(
    needsTechnovigilance({
      priority: "Ordinaria",
      patient_outcome: "Sin lesión",
      operator_outcome: "No aplica",
    }),
  ).toBe(false)
})
it("includes high and critical priority, actual patient/operator damage, and explicit potential serious harm", () => {
  for (const report of [
    { priority: "Alta" },
    { priority: "Crítica" },
    { patient_outcome: "Lesión moderada" },
    { operator_outcome: "Lesión grave" },
    { patient_outcome: "Fallecimiento" },
    { patient_outcome: "Lesión temporal" },
    { potential_harm: true },
    { event_type: "Incidente adverso potencial" },
  ])
    expect(needsTechnovigilance(report)).toBe(true)
})
