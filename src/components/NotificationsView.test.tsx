import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const services = vi.hoisted(() => ({ notifications: vi.fn(), codes: vi.fn(), dismiss: vi.fn() }))
vi.mock("../lib/supabase", async original => ({ ...(await original<typeof import("../lib/supabase")>()), isOperationalCompletionEnabled: true, listNotifications: services.notifications, dismissNotification: services.dismiss }))
vi.mock("../lib/hospitalAlerts", () => ({ listHospitalCodes: services.codes }))
import { NotificationsView } from "./PlatformViews"
afterEach(cleanup)
it("removes a dismissed notification after saving the account-specific dismissal", async () => {
  services.codes.mockResolvedValue([])
  services.notifications.mockResolvedValue([{ id: 9, title: "Aviso de prueba", message: "Pendiente", created_at: "2026-11-23T10:00:00Z" }])
  services.dismiss.mockImplementation(async () => { services.notifications.mockResolvedValue([]) })
  render(<NotificationsView />)
  fireEvent.click(await screen.findByRole("button", { name: "Cerrar aviso: Aviso de prueba" }))
  await screen.findByText("No hay notificaciones")
  expect(services.dismiss).toHaveBeenCalledWith(9)
  expect(screen.queryByText("Aviso de prueba")).toBeNull()
})
it("distinguishes hospital codes with their own icons from normal notifications", async () => {
  services.codes.mockResolvedValue([{ code: "negro", name: "Negro", color: "#171717" }, { code: "verde", name: "Verde", color: "#198754" }])
  services.notifications.mockResolvedValue([
    { id: 1, title: "Código Negro · Amenaza de bomba", message: "Acceso principal", entity_type: "hospital_alert", created_at: "2026-11-23T10:00:00Z" },
    { id: 2, title: "Código Verde · Cerrado", message: "Sala 1", entity_type: "hospital_alert", created_at: "2026-11-23T10:00:00Z" },
    { id: 3, title: "Mantenimiento programado", message: "Equipo pendiente", entity_type: "maintenance", created_at: "2026-11-23T10:00:00Z" },
  ])
  const { container } = render(<NotificationsView />)
  await screen.findByText("Mantenimiento programado")
  await waitFor(() => expect(container.querySelectorAll(".hospital-color")).toHaveLength(2))
  expect(container.querySelector(".lucide-bomb")).toBeTruthy()
  expect(container.querySelector(".lucide-door-open")).toBeTruthy()
  expect(container.querySelectorAll(".notification-hospital")).toHaveLength(2)
  expect(container.querySelectorAll(".notification-standard")).toHaveLength(1)
  expect(screen.getAllByText("Alerta hospitalaria")).toHaveLength(2)
})
