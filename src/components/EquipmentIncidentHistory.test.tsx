import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const get = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    {
      id: 12,
      report_number: "REP-12",
      incident: "Sensor averiado",
      created_at: "2026-11-25T12:00:00Z",
      priority: "Alta",
      status: "Cerrado",
      maintenance_number: "MC-9",
    },
  ]),
)
vi.mock("../lib/equipmentDocuments", () => ({
  getEquipmentIncidentHistory: get,
}))
vi.mock("./ReportPreview", () => ({
  ReportPreview: ({ reportId }: { reportId: number }) => (
    <div role="dialog">Reporte seleccionado {reportId}</div>
  ),
}))
import { EquipmentIncidentHistory } from "./EquipmentIncidentHistory"
afterEach(cleanup)
it("queries the selected equipment and opens its actual historical report even after closure", async () => {
  render(<EquipmentIncidentHistory equipmentId="asset-A" />)
  expect(await screen.findByText("REP-12 · Sensor averiado")).toBeTruthy()
  expect(get).toHaveBeenCalledWith("asset-A")
  expect(screen.getByText("Orden vinculada: MC-9")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Ver reporte / PDF" }))
  expect(screen.getByRole("dialog").textContent).toContain("12")
})
