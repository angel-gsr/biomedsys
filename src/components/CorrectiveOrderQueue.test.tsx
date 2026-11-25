import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const service = vi.hoisted(() => ({ list: vi.fn(), claim: vi.fn() }))
vi.mock("../lib/correctiveQueue", () => ({
  listAvailableCorrectiveOrders: service.list,
  claimCorrectiveOrder: service.claim,
}))
import { CorrectiveOrderQueue } from "./CorrectiveOrderQueue"
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const order = {
  id: 7,
  source_report_id: 8,
  maintenance_number: "MC-7",
  equipment_identifier: "EQ-1",
  report_number: "REP-8",
  description: "No enciende",
  service: "Urgencias",
  priority: "alta",
}
it("claims the exact order once and opens the assigned technical workflow", async () => {
  service.list.mockResolvedValue([order])
  service.claim.mockResolvedValue({ id: 7 })
  const open = vi.fn()
  render(<CorrectiveOrderQueue role="tecnico" onOpenOrder={open} />)
  fireEvent.click(await screen.findByRole("button", { name: "Tomar orden" }))
  await waitFor(() => expect(open).toHaveBeenCalledWith(7))
  expect(service.claim).toHaveBeenCalledTimes(1)
})
it("shows a lost-claim conflict and refreshes without claiming another order", async () => {
  service.list.mockResolvedValueOnce([order]).mockResolvedValue([])
  service.claim.mockRejectedValue({
    message: "Otro ingeniero ya tomó esta orden. Actualiza la lista.",
  })
  render(<CorrectiveOrderQueue role="tecnico" />)
  fireEvent.click(await screen.findByRole("button", { name: "Tomar orden" }))
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Otro ingeniero"),
  )
  expect(service.claim).toHaveBeenCalledWith(7)
})
it("offers the manager assignment for the source report instead of self-claim", async () => {
  service.list.mockResolvedValue([order])
  const assign = vi.fn()
  render(<CorrectiveOrderQueue role="jefe" onAssignReport={assign} />)
  fireEvent.click(
    await screen.findByRole("button", { name: "Asignar ingeniero" }),
  )
  expect(assign).toHaveBeenCalledWith(8)
  expect(screen.queryByRole("button", { name: "Tomar orden" })).toBeNull()
})
