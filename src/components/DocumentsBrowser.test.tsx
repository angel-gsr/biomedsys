import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../lib/supabase", () => ({
  listEquipmentInventory: vi.fn().mockResolvedValue([
    { id: "a", inventory_code: "EQ-001", equipment_type: "Máquina de anestesia", manufacturer: "Marca", model: "A1", hospital_area: "Quirófano", location: "Sala 1", serial_number: "SER001" },
    { id: "b", inventory_code: "EQ-002", equipment_type: "Autoclave", manufacturer: "Marca", model: "B2", hospital_area: "CEYE", location: null, serial_number: "SER002" },
    { id: "c", inventory_code: "EQ-003", equipment_type: "Monitor", manufacturer: "Marca", model: "C3", hospital_area: null, location: null, serial_number: null },
  ]),
  listDocumentLibrary: vi.fn().mockResolvedValue([
    { id: 1, title: "Manual de anestesia", url: "https://example.org/manual", document_type: "manual_usuario", review_status: "pendiente", equipmentIds: ["a"], linkedEquipment: 1 },
    { id: 2, title: "Servicio autoclave", url: "javascript:alert(1)", document_type: "manual_servicio", review_status: "pendiente", equipmentIds: ["b"], linkedEquipment: 1 },
  ]),
}))

import { DocumentsBrowser } from "./DocumentsBrowser"
afterEach(cleanup)

describe("documents by equipment and area", () => {
  it("filters by area, shows only the chosen equipment documents and clears selection on filter changes", async () => {
    render(<DocumentsBrowser role="jefe" />)
    await screen.findByRole("button", { name: /EQ-001/ })
    fireEvent.change(screen.getByLabelText("Área hospitalaria"), { target: { value: "Quirófano" } })
    expect(screen.queryByRole("button", { name: /EQ-002/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /EQ-001/ }))
    expect(screen.getByRole("link", { name: /Abrir documento/ }).getAttribute("href")).toBe("https://example.org/manual")
    expect(screen.queryByText("Servicio autoclave")).toBeNull()
    fireEvent.change(screen.getByLabelText("Área hospitalaria"), { target: { value: "CEYE" } })
    expect(screen.queryByText("Manual de anestesia")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /EQ-002/ }))
    expect(screen.getByText("Servicio autoclave")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByText("Enlace por revisar")).toBeTruthy()
  })

  it("searches without accents and by serial and handles equipment without documents", async () => {
    render(<DocumentsBrowser role="tecnico" />)
    await screen.findByRole("button", { name: /EQ-001/ })
    const input = screen.getByRole("textbox", { name: "Buscar equipo para documentos" })
    fireEvent.change(input, { target: { value: "maquina" } })
    expect(screen.getByRole("button", { name: /EQ-001/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /EQ-002/ })).toBeNull()
    fireEvent.change(input, { target: { value: "SER002" } })
    expect(screen.getByRole("button", { name: /EQ-002/ })).toBeTruthy()
    fireEvent.change(input, { target: { value: "Monitor" } })
    fireEvent.click(within(screen.getByRole("region", { name: "Sin área" })).getByRole("button"))
    expect(screen.getByText("Este equipo no tiene documentos vinculados")).toBeTruthy()
    fireEvent.change(input, { target: { value: "inexistente" } })
    expect(screen.getByText("No se encontraron equipos")).toBeTruthy()
  })
})
