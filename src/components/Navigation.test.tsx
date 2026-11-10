import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { BottomNav, Sidebar } from "../App"
import type { Profile, Role } from "../lib/supabase"

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open") } })
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("exposes every manager section in the mobile menu and closes after navigating", () => {
  const setView = vi.fn()
  render(<BottomNav role="jefe" view="dashboard" setView={setView} onLogout={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Menú" }))
  const menu = within(screen.getByRole("dialog", { name: "Todas las opciones" }))
  for (const name of ["Resumen", "Mesa de ayuda", "Tecnovigilancia", "Inventario", "Mantenimiento", "Documentos", "Capacitaciones", "Notificaciones", "Usuarios y permisos", "Trazabilidad", "Cotizaciones", "Configuración", "Mi perfil", "Cerrar sesión"]) {
    expect(menu.getByRole("button", { name })).toBeTruthy()
  }
  expect(document.body.style.overflow).toBe("hidden")
  fireEvent.click(menu.getByRole("button", { name: "Usuarios y permisos" }))
  expect(setView).toHaveBeenCalledWith("usuarios")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.body.style.overflow).toBe("")
})

it.each<Role>(["jefe", "tecnico", "usuario"])("keeps mobile profile and logout functional for %s", (role) => {
  const setView = vi.fn(), logout = vi.fn()
  render(<BottomNav role={role} view="dashboard" setView={setView} onLogout={logout} />)
  fireEvent.click(screen.getByRole("button", { name: "Menú" }))
  const menu = screen.getByRole("dialog")
  if (role !== "jefe") expect(within(menu).queryByText("Usuarios y permisos")).toBeNull()
  fireEvent.click(within(menu).getByRole("button", { name: "Mi perfil" }))
  expect(setView).toHaveBeenCalledWith("perfil")
  fireEvent.click(screen.getByRole("button", { name: "Menú" }))
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar sesión" }))
  expect(logout).toHaveBeenCalledOnce()
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("keeps desktop account controls functional", () => {
  const profile = { id: "test", institutional_id: "00123456", full_name: "Nombre muy largo para comprobar el perfil", role: "jefe", department: "Ingeniería clínica", active: true } as Profile
  const logout = vi.fn(), account = vi.fn()
  render(<Sidebar profile={profile} view="dashboard" setView={vi.fn()} onProfile={account} onLogout={logout} />)
  fireEvent.click(screen.getByRole("button", { name: "Ver mi perfil" }))
  expect(account).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }))
  expect(logout).toHaveBeenCalledOnce()
})
