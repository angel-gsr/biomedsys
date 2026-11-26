import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const load = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    {
      program_id: 1,
      program_name: "Rutina preventiva",
      periodicity: "Semestral",
      last_on: "2026-11-23",
      next_on: "2027-05-23",
      reported_last_on: "2026-08-10",
      reported_next_on: "2027-02-10",
      notes: null,
    },
  ]),
)
vi.mock("../lib/maintenanceDates", async (original) => ({
  ...(await original<typeof import("../lib/maintenanceDates")>()),
  getMaintenanceDates: load,
}))
import { EquipmentMaintenanceDates } from "./EquipmentMaintenanceDates"
afterEach(cleanup)
it("shows the effective dates and retains the older reported reference without replacing newer maintenance", async () => {
  render(<EquipmentMaintenanceDates equipmentId="asset-A" />)
  expect(await screen.findByText("23 de mayo de 2027")).toBeTruthy()
  expect(screen.getByText("23 de noviembre de 2026")).toBeTruthy()
  expect(
    screen.getByText(/Se conserva el mantenimiento más reciente/),
  ).toBeTruthy()
  expect(load).toHaveBeenCalledWith("asset-A")
})
