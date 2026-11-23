import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { Profile } from "../lib/supabase"
const services = vi.hoisted(() => ({ inbox: vi.fn(), emit: vi.fn(), update: vi.fn(), enable: vi.fn(), play: vi.fn(), stop: vi.fn(), retain: vi.fn(), event: null as null | (() => void) }))
vi.mock("../lib/hospitalAlerts", () => ({ loadHospitalInbox: services.inbox, emitHospitalAlert: services.emit, updateHospitalAlert: services.update, HospitalSound: class { enable = services.enable; play = services.play; stop = services.stop; retain = services.retain } }))
vi.mock("../lib/supabase", () => ({ supabase: { channel: () => { const channel = { on: (_event: string, _filter: unknown, callback: () => void) => { services.event = callback; return channel }, subscribe: () => channel }; return channel }, removeChannel: vi.fn() } }))
import { HospitalAlertHub } from "./HospitalAlertHub"
const code = { code: "negro", name: "Negro", description: "Amenaza de bomba", color: "#171717", audience: "todos", audible: true, sort_order: 1 }
const alert = { id: 25, code: "negro", code_name: "Negro", code_description: "Amenaza de bomba", color: "#171717", location: "Acceso principal", audible: true, status: "activa", created_at: "2026-11-23T10:00:00Z", emitter_name: "Emisor de prueba", emitter_institutional_id: "02123456", emitter_role: "usuario", audience: "todos" }
const base = { id: "user", institutional_id: "02123456", full_name: "Cuenta de prueba", department: null, active: true }
beforeEach(() => { vi.clearAllMocks(); services.inbox.mockResolvedValue({ codes: [code], alerts: [], unread: 3 }); services.emit.mockResolvedValue(25); services.update.mockResolvedValue(undefined); services.play.mockReturnValue(true) })
afterEach(cleanup)

it.each<Profile["role"]>(["jefe", "tecnico", "usuario"])("exposes top notifications and the emergency catalogue for %s", async role => {
  const open = vi.fn()
  render(<HospitalAlertHub profile={{ ...base, role }} onNotifications={open} />)
  fireEvent.click(await screen.findByRole("button", { name: "Notificaciones, 3 sin leer" }))
  expect(open).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "Códigos hospitalarios" }))
  fireEvent.click(await screen.findByRole("button", { name: /Código Negro/ }))
  expect(services.emit).not.toHaveBeenCalled()
  expect(screen.getByText("Destinatarios: todos los perfiles activos.")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("Área y ubicación de la emergencia *"), { target: { value: "Quirófano 1" } })
  fireEvent.click(screen.getByRole("button", { name: "Emitir alerta para todos" }))
  await waitFor(() => expect(services.emit).toHaveBeenCalledWith("negro", "Quirófano 1", "", expect.any(String)))
})

it("only sounds alerts after explicit audio activation and suppresses duplicate realtime deliveries", async () => {
  services.inbox.mockResolvedValue({ codes: [code], alerts: [alert], unread: 1 })
  render(<HospitalAlertHub profile={{ ...base, role: "usuario" }} onNotifications={vi.fn()} />)
  await screen.findByText(/1 alerta\(s\)/)
  expect(services.play).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Códigos hospitalarios" }))
  fireEvent.click(screen.getByRole("button", { name: "Activar sonido" }))
  await waitFor(() => expect(services.play).toHaveBeenCalledOnce())
  await act(async () => { services.event?.() })
  expect(services.play).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "Activas (1)" }))
  expect(screen.getByText("ID institucional: 02123456 | Usuario")).toBeTruthy()
  expect(services.play).toHaveBeenCalledWith(expect.objectContaining({ code: "negro", audience: "todos" }))
  expect(screen.queryByRole("button", { name: "Atender alerta" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Cerrar alerta" })).toBeNull()
})

it("allows biomedical staff to take an alert and requires a closure explanation", async () => {
  services.inbox.mockResolvedValue({ codes: [code], alerts: [alert], unread: 1 })
  render(<HospitalAlertHub profile={{ ...base, role: "tecnico" }} onNotifications={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Revisar" }))
  fireEvent.click(screen.getByRole("button", { name: "Atender alerta" }))
  await waitFor(() => expect(services.update).toHaveBeenCalledWith(25, "en_atencion", ""))
  fireEvent.click(screen.getByRole("button", { name: "Cerrar alerta" }))
  expect((screen.getByLabelText("Motivo del cierre *") as HTMLTextAreaElement).required).toBe(true)
  fireEvent.change(screen.getByLabelText("Motivo del cierre *"), { target: { value: "Atención completada" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cierre" }))
  await waitFor(() => expect(services.update).toHaveBeenCalledWith(25, "cerrada", "Atención completada"))
})
