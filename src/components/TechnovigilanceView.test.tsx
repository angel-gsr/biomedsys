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
vi.mock("../lib/technovigilance",async original=>({...await original<typeof import("../lib/technovigilance")>(),listTechnovigilanceCandidates:vi.fn().mockResolvedValue([{id:10,report_number:"REP-000010",equipment_id:"asset",equipment_identifier:"EQ-000001",event_type:"Falla",description:"No enciende",service:"Urgencias",priority:"Alta"},{id:11,report_number:"REP-000011",priority:"Ordinaria",event_type:"Falla",patient_outcome:"Sin lesión"}])}))
import { TechnovigilanceView } from "./TechnovigilanceView"
afterEach(cleanup)

it("opens the requested report directly in its technovigilance editor", async () => {
  render(<TechnovigilanceView role="tecnico" requestedReportId={10} />)
  expect(await screen.findByRole("heading", { name: "Gestión de REP-000010" })).toBeTruthy()
  expect(screen.getByLabelText("Tipo de falla / incidente")).toHaveProperty("value", "Falla")
})

it("lets the technician classify the case and relocate the actual equipment without editing the original report", async () => {
  render(<TechnovigilanceView role="tecnico" />)
  fireEvent.click(await screen.findByRole("button", { name: "Gestionar" }))
  await screen.findByText("Urgencias · Sala 1")
  expect((screen.getByLabelText("Riesgo para meta interna") as HTMLSelectElement).value).toBe("")
  fireEvent.change(screen.getByLabelText("Riesgo para meta interna"), { target: { value: "alto" } })
  fireEvent.change(screen.getByLabelText("Supuesto de notificación NOM-240"), { target: { value: "muerte_deterioro_grave" } })
  fireEvent.change(screen.getByLabelText("Fecha de confirmación"), { target: { value: "2026-11-09" } })
  fireEvent.change(screen.getByLabelText("Persona afectada o en riesgo"),{target:{value:"paciente"}})
  fireEvent.change(screen.getByLabelText("Daño ocurrido o consecuencias potenciales"),{target:{value:"Riesgo grave durante su uso"}})
  fireEvent.change(screen.getByLabelText("Medidas de seguridad y acciones preventivas"),{target:{value:"Equipo retirado y evaluación"}})
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

it("excludes ordinary failures and refuses direct navigation to their special form",async()=>{
 render(<TechnovigilanceView role="tecnico" requestedReportId={11}/>)
 await screen.findByRole("button",{name:"Gestionar"})
 expect(screen.queryByText("REP-000011")).toBeNull()
 expect(screen.queryByRole("heading",{name:"Gestión de REP-000011"})).toBeNull()
 expect(screen.getByText("Este reporte no cumple los criterios de Tecnovigilancia. Consulta su atención en Mesa de ayuda.")).toBeTruthy()
})
