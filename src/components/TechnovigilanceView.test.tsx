import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const services = vi.hoisted(() => ({ saveTechnovigilanceReview: vi.fn().mockResolvedValue({}), moveTechnovigilanceEquipment: vi.fn().mockResolvedValue(undefined) }))
vi.mock("../lib/supabase", () => ({ listReports: vi.fn().mockResolvedValue([{ id: 10, report_number: "REP-000010", equipment_id: "asset", equipment_identifier: "EQ-000001", event_type: "Falla", description: "No enciende", service: "Urgencias" }]) }))
vi.mock("../lib/reportManagement", () => ({
  ...services, listTechnovigilanceReviews: vi.fn().mockResolvedValue([]),
  getMovementLocations: vi.fn().mockResolvedValue({ areas: [{ id: 1, name: "CEYE" }], locations: [{ id: 2, name: "Sala 2", hospital_area_id: 1 }] }),
  getReportEquipmentIdentity: vi.fn().mockResolvedValue({ hospital_area: "Urgencias", location: "Sala 1" }),
  listTechnovigilanceHolidays: vi.fn().mockResolvedValue([]), saveTechnovigilanceHoliday: vi.fn(), removeTechnovigilanceHoliday: vi.fn(),
  getReportPreview: vi.fn(), editReportIncident: vi.fn(), createReportPdf: vi.fn(), remainingEditSeconds: vi.fn(),
}))
import { TechnovigilanceView } from "./TechnovigilanceView"
afterEach(cleanup)

it("lets the technician classify the case and relocate the actual equipment without editing the original report", async () => {
  render(<TechnovigilanceView role="tecnico" />)
  fireEvent.click(await screen.findByRole("button", { name: "Gestionar" }))
  await screen.findByText("Urgencias · Sala 1")
  expect((screen.getByLabelText("Riesgo para meta interna") as HTMLSelectElement).value).toBe("")
  fireEvent.change(screen.getByLabelText("Riesgo para meta interna"), { target: { value: "alto" } })
  fireEvent.change(screen.getByLabelText("Supuesto de notificación NOM-240"), { target: { value: "muerte_deterioro_grave" } })
  fireEvent.change(screen.getByLabelText("Fecha de confirmación"), { target: { value: "2026-11-09" } })
  fireEvent.click(screen.getByRole("button", { name: "Guardar seguimiento" }))
  await waitFor(() => expect(services.saveTechnovigilanceReview).toHaveBeenCalledWith(10, expect.objectContaining({ internal_risk: "alto", regulatory_case: "muerte_deterioro_grave", confirmed_on: "2026-11-09" })))
  await screen.findByText("Seguimiento guardado y auditado.")
  fireEvent.change(screen.getByLabelText("Área de destino"), { target: { value: "1" } })
  fireEvent.change(screen.getByLabelText("Ubicación de destino"), { target: { value: "2" } })
  fireEvent.change(screen.getByLabelText("Motivo del traslado"), { target: { value: "Retiro para evaluación" } })
  fireEvent.click(screen.getByRole("button", { name: "Actualizar ubicación" }))
  await waitFor(() => expect(services.moveTechnovigilanceEquipment).toHaveBeenCalledWith("asset", 1, 2, "Retiro para evaluación"))
  expect(screen.queryByText(/Calendario de días inhábiles/)).toBeNull()
})
