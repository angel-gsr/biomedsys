import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const services = vi.hoisted(() => ({ createReport: vi.fn().mockResolvedValue("REP-000099"), getReportEquipmentIdentity: vi.fn() }))
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
  fireEvent.change(screen.getByLabelText("Descripción del evento *"), { target: { value: "No enciende" } })
  fireEvent.click(screen.getByRole("button", { name: "Enviar reporte" }))
  await waitFor(() => expect(services.createReport).toHaveBeenCalledWith(expect.objectContaining({ equipmentId: "equipment-1", location: "CEYE · Sala 1", modelSerial: "Modelo real / SER-99", description: "No enciende" })))
})
