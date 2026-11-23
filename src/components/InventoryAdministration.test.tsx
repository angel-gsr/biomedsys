import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InventoryAdministration, inventoryIssueLabel, type InventoryAdministrationApi } from "./InventoryAdministration"
import type { EquipmentInventoryBundle, InventoryAdministrationData } from "../lib/supabase"
afterEach(cleanup)

const bundle: EquipmentInventoryBundle = {
  equipment: {
    id: "asset-52", inventory_code: "EQ-000052", equipment_type: "Equipo médico",
    manufacturer: "Fabricante", model: "Modelo", hospital_area: "Urgencias", location: "Cubículo 1",
    status: "desconocido", serial_number: "3979000122", manufacture_year: null,
    acquisition_year: null, custodian_location_text: null, requires_review: true,
    current_risk_score: 8, current_risk_category: "medio",
  },
  risks: [], documents: [],
  programs: [{ id: 4, name: "Rutina preventiva", procedure_text: "Procedimiento validado", interval_months: null, periodicity_basis: null, requires_review: true }],
  issues: [{ id: 9, issue_code: "duplicate_serial", severity: "error", field_name: "SN", source_value: "3979000122", details: "Serie compartida", review_status: "pendiente" }],
  restricted: false,
}

const adminData: InventoryAdministrationData = {
  asset: { id: "asset-52", serial_number: "3979000122", serial_is_placeholder: false, manufacture_year: null, acquisition_year: null, hospital_area_id: 1, location_id: 2, custodian_location_text: null, status: "desconocido" },
  areas: [{ id: 1, name: "Urgencias" }],
  locations: [{ id: 2, name: "Cubículo 1", hospital_area_id: 1 }],
  programs: [{ maintenance_program_id: 4, interval_months: null, periodicity_basis: null, periodicity_notes: null, reference_date: null, last_completed_on: null, next_due_on: null }],
  issueReviews: [],
  technicians: [{ id: "tech-1", institutional_id: "T001", full_name: "Técnico Prueba", role: "tecnico", department: null, active: true }],
}

function api(): InventoryAdministrationApi {
  return {
    load: vi.fn().mockResolvedValue(adminData),
    updateAsset: vi.fn().mockResolvedValue(adminData.asset),
    configureProgram: vi.fn().mockResolvedValue(adminData.programs[0]),
    schedule: vi.fn().mockResolvedValue({}),
    reviewIssue: vi.fn().mockResolvedValue(bundle.issues[0]),
  }
}

describe("InventoryAdministration", () => {
  it("propone el intervalo del archivo sin guardar automáticamente ni cambiar las fechas existentes", async () => {
    const service = api()
    vi.mocked(service.load).mockResolvedValue({ ...adminData, programs: [{ ...adminData.programs[0], reference_date: "2026-11-01" }] })
    const enriched: EquipmentInventoryBundle = { ...bundle, enrichment: { maintenance_periodicity: "Semestral", suggested_interval_months: 6, periodicity_needs_review: false, possible_problems: null, decommission_notes: null, warranty_notes: null, regulatory_notes: null, source_sha256: "a".repeat(64), source_row: 53, updated_at: "2026-11-23", source: { source_file: "Final (2).xlsx", imported_at: "2026-11-23" } } }
    render(<InventoryAdministration bundle={enriched} enabled api={service} onChanged={() => undefined} />)
    fireEvent.click(await screen.findByRole("button", { name: "Usar intervalo de referencia (6 meses)" }))
    expect(service.configureProgram).not.toHaveBeenCalled()
    expect((screen.getByLabelText("Periodicidad (meses)") as HTMLInputElement).value).toBe("6")
    fireEvent.click(screen.getByRole("button", { name: "Guardar periodicidad" }))
    await waitFor(() => expect(service.configureProgram).toHaveBeenCalledWith("asset-52", expect.objectContaining({ interval_months: 6, reference_date: "2026-11-01", periodicity_notes: "Semestral" })))
  })
  it("mantiene las escrituras deshabilitadas antes de desplegar la migración", () => {
    const service = api()
    render(<InventoryAdministration bundle={bundle} enabled={false} api={service} onChanged={() => undefined} />)
    expect(screen.getByText(/pendiente de aprobación/i)).toBeTruthy()
    expect(service.load).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /guardar cambios/i })).toBeNull()
  })

  it("carga herramientas reales y envía la edición del activo", async () => {
    const service = api()
    render(<InventoryAdministration bundle={bundle} enabled api={service} onChanged={() => undefined} />)
    const save = await screen.findByRole("button", { name: /guardar cambios/i })
    fireEvent.click(save)
    await waitFor(() => expect(service.updateAsset).toHaveBeenCalledWith(expect.objectContaining({ id: "asset-52", serial_number: "3979000122" })))
  })

  it("requiere justificación antes de revisar una incidencia", async () => {
    const service = api()
    render(<InventoryAdministration bundle={bundle} enabled api={service} onChanged={() => undefined} />)
    const review = await screen.findByRole("button", { name: /registrar revisión/i })
    fireEvent.click(review)
    expect(await screen.findByText(/selecciona el resultado/i)).toBeTruthy()
    fireEvent.change(screen.getAllByLabelText("Resultado")[0], { target: { value: "confirmado" } })
    fireEvent.click(review)
    expect(await screen.findByText(/observaciones y la justificación son obligatorias/i)).toBeTruthy()
    expect(service.reviewIssue).not.toHaveBeenCalled()
  })

  it("traduce la serie duplicada sin afirmar que los equipos sean iguales", () => {
    expect(inventoryIssueLabel("duplicate_serial")).toBe("Número de serie compartido o duplicado, pendiente de verificar")
  })
})
