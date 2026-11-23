import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { InventoryEnrichmentDetails } from "./InventoryEnrichmentDetails"
import type { InventoryEnrichment } from "../lib/supabase"
afterEach(cleanup)
it("shows readable equipment details without source metadata or decommission notes", () => {
  const data: InventoryEnrichment = { maintenance_periodicity: "Cada 24 meses; batería cada 6 meses", suggested_interval_months: null, periodicity_needs_review: true, possible_problems: "No enciende", decommission_notes: "Sustitución recomendada", warranty_notes: null, regulatory_notes: "No verificado", source_sha256: "a".repeat(64), source_row: 2, updated_at: "2026-11-23", source: { source_file: "Final (2).xlsx", imported_at: "2026-11-23" } }
  render(<InventoryEnrichmentDetails data={data} />)
  expect(screen.getByText("Cada 24 meses; batería cada 6 meses")).toBeTruthy()
  expect(screen.getByText("No enciende")).toBeTruthy()
  expect(screen.queryByText("Sustitución recomendada")).toBeNull()
  expect(screen.queryByText(/Fuente:/)).toBeNull()
  expect(screen.getByText("No verificado")).toBeTruthy()
  expect(screen.getByText(/No equivale a una verificación regulatoria vigente/)).toBeTruthy()
  expect(screen.getByText("No registrada")).toBeTruthy()
})
