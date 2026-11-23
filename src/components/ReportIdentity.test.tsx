import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const services = vi.hoisted(() => ({ createReport: vi.fn().mockResolvedValue("REP-000099"), getReportEquipmentIdentity: vi.fn(), getEquipmentIncidentOptions: vi.fn().mockResolvedValue([]) }))
vi.mock("../lib/equipmentControl", () => ({ getEquipmentIncidentOptions: services.getEquipmentIncidentOptions }))
vi.mock("../lib/supabase", async (original) => ({ ...(await original<typeof import("../lib/supabase")>()), createReport: services.createReport, listEquipmentInventory: vi.fn().mockResolvedValue([]), getReportIdByNumber: vi.fn().mockResolvedValue(99) }))
vi.mock("../lib/reportManagement", async (original) => ({ ...(await original<typeof import("../lib/reportManagement")>()), getReportEquipmentIdentity: services.getReportEquipmentIdentity }))
vi.mock("./EquipmentQrScanner", () => ({ EquipmentQrScanner: ({ onSelect }: { onSelect: (equipment: unknown) => void }) => <button type="button" onClick={() => onSelect({ id: "equipment-1", inventory_code: "EQ-000001", equipment_type: "Stale name", manufacturer: "Stale brand" })}>Escanear QR</button> }))
import { ReportModal } from "../App"
afterEach(cleanup)

it("hydrates QR identity from the database and locks all equipment fields while leaving incident inputs editable", async () => {
  services.getReportEquipmentIdentity.mockResolvedValue({ id: "equipment-1", inventory_code: "EQ-000001", equipment_type: "Autoclave", model: "Modelo real", serial_number: "SER-99", manufacturer: "Marca real", hospital_area: "CEYE", location: "Sala 1" })
  render(<ReportModal role="usuario" onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Escanear QR" }))
  await screen.findByDisplayValue("Autoclave")
  for (const name of ["Nombre del equipo", "Modelo", "Número de serie", "Ubicación", "Fabricante", "Área / servicio del equipo *"]) {
    expect((screen.getByLabelText(name) as HTMLInputElement).readOnly).toBe(true)
  }
  expect((screen.getByRole("combobox", { name: "Buscar equipo registrado" }) as HTMLInputElement).readOnly).toBe(true)
  expect(screen.getByDisplayValue("CEYE · Sala 1")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("Tipo de evento *"), { target: { value: "Falla" } })
  fireEvent.change(screen.getByLabelText("Incidente del equipo *"), { target: { value: "other" } })
  fireEvent.change(screen.getByLabelText("Otro incidente del equipo *"), { target: { value: "No enciende" } })
  fireEvent.change(screen.getByLabelText("Descripción del evento *"), { target: { value: "No enciende" } })
  fireEvent.click(screen.getByRole("button", { name: "Enviar reporte" }))
  await waitFor(() => expect(services.createReport).toHaveBeenCalledWith(expect.objectContaining({ equipmentId: "equipment-1", location: "CEYE · Sala 1", modelSerial: "Modelo real / SER-99", description: "No enciende" })))
})

it("offers incident labels and recurrence counts only after selecting the equipment", async () => {
  services.getEquipmentIncidentOptions.mockResolvedValue([{ id: 20, label: "Batería agotada", source: "reporte", report_count: 2 }, { id: 21, label: "Pantalla sin imagen", source: "inventario", report_count: 0 }])
  render(<ReportModal role="usuario" onClose={vi.fn()} />)
  expect((screen.getByLabelText("Incidente del equipo *") as HTMLSelectElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Escanear QR" }))
  await screen.findByRole("option", { name: "Batería agotada · 2 reporte(s)" })
  expect(services.getEquipmentIncidentOptions).toHaveBeenCalledWith("equipment-1")
  expect(screen.getByRole("group", { name: "Reportados anteriormente en este equipo" })).toBeTruthy()
  expect(screen.getByRole("option", { name: "Pantalla sin imagen" })).toBeTruthy()
})
