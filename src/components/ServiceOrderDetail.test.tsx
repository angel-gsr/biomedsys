import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("../lib/supabase", async original => ({ ...(await original<typeof import("../lib/supabase")>()),
  isOperationalCompletionEnabled: true,
  listMaintenanceOverview: vi.fn().mockResolvedValue({ catalog: [], maintenances: [
    { id: 1, maintenance_number: "MC-000001", maintenance_code: "MC", status: "programado", scheduled_at: "2026-11-25T12:00:00Z", priority: "Alta", equipment_identifier: "EQ-1", assigned_to_name: "Ingeniero Demo" },
    { id: 2, maintenance_number: "MC-000002", maintenance_code: "MC", status: "programado", scheduled_at: "2026-11-25T12:00:00Z" },
  ] }),
}))
import { ServiceOrdersView } from "./OperationalViews"
afterEach(cleanup)
it("opens only the requested confirmed order in read-only mode with PDF and a return arrow", async () => {
  const back = vi.fn()
  render(<ServiceOrdersView role="tecnico" requestedOrderId={1} onBack={back} />)
  expect(await screen.findByRole("heading", { name: "Orden MC-000001" })).toBeTruthy()
  expect(screen.queryByText("MC-000002")).toBeNull()
  expect(screen.queryByLabelText("Estado de MC-000001")).toBeNull()
  expect(screen.getByText("Ingeniero Demo")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Volver a Mesa de ayuda" }))
  expect(back).toHaveBeenCalledOnce()
})
it("keeps the return action when an order is unavailable", async () => {
  render(<ServiceOrdersView role="jefe" requestedOrderId={999} onBack={vi.fn()} />)
  expect(await screen.findByRole("heading", { name: "Orden no disponible" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Volver a Mesa de ayuda" })).toBeTruthy()
})
