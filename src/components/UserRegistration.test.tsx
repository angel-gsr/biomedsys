import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined), manage: vi.fn() }))
vi.mock("../lib/supabase", async original => ({
  ...(await original<typeof import("../lib/supabase")>()),
  isOperationalCompletionEnabled: true,
  listUserPresence: vi.fn().mockResolvedValue([{ profile_id: "active", online: false }]),
  listProfiles: vi.fn().mockResolvedValue([{ id: "inactive", institutional_id: "02181000", full_name: "Cuenta Inactiva", active: false, role: "usuario" }, { id: "active", institutional_id: "02181001", full_name: "Cuenta Activa", active: true, first_name: "Cuenta", last_name: "Activa", age: 28, role: "usuario" }]),
  listAccessRequests: vi.fn().mockResolvedValue([]),
  listUserDepartments: vi.fn().mockResolvedValue(["Urgencias", "CEYE"]),
  createAccessRequest: mocks.create,
  deleteInactiveUser: mocks.remove,
  manageProfile: mocks.manage,
}))
import { UserPermissionsView } from "./AdminViews"
afterEach(() => { cleanup(); vi.clearAllMocks() })
it("registers separated personal data with a catalogue and without a client identifier", async () => {
  render(<UserPermissionsView />)
  fireEvent.click(screen.getByRole("button", { name: "Alta de usuario" }))
  await screen.findByRole("option", { name: "Urgencias" })
  fireEvent.change(screen.getByLabelText("Rol *"), { target: { value: "tecnico" } })
  expect(screen.queryByRole("note")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Información del identificador automático" }))
  expect(screen.getByRole("note").textContent).toContain("01 + consecutivo desde 181000")
  expect(screen.queryByRole("textbox", { name: "ID institucional" })).toBeNull()
  fireEvent.change(screen.getByLabelText("Nombres *"), { target: { value: "Ángel José" } })
  fireEvent.change(screen.getByLabelText("Apellidos *"), { target: { value: "García López" } })
  fireEvent.change(screen.getByLabelText("Edad *"), { target: { value: "28" } })
  fireEvent.change(screen.getByLabelText("Teléfono (opcional)"), { target: { value: "55123456789" } })
  expect((screen.getByLabelText("Teléfono (opcional)") as HTMLInputElement).value).toBe("5512345678")
  fireEvent.change(screen.getByLabelText("Departamento *"), { target: { value: "Urgencias" } })
  fireEvent.submit(screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!)
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ firstName: "Ángel José", lastName: "García López", age: "28", phone: "5512345678", department: "Urgencias", role: "tecnico" }))
})
it("shows the new login identifier after a role change", async () => {
  mocks.manage.mockImplementation(async profile => ({ ...profile, institutional_id: "01181001" }))
  render(<UserPermissionsView />)
  const row=(await screen.findByText("Cuenta Activa")).closest("tr")!
  fireEvent.click(within(row).getByRole("button",{name:"Editar"}))
  const modal=screen.getByRole("heading",{name:"Cuenta Activa"}).closest(".modal") as HTMLElement
  fireEvent.change(within(modal).getByLabelText("Rol"),{target:{value:"tecnico"}})
  fireEvent.change(within(modal).getByLabelText("Motivo del cambio *"),{target:{value:"Cambio a biomédico"}})
  fireEvent.click(within(modal).getByRole("button",{name:"Guardar cambios"}))
  await waitFor(()=>expect(screen.getByRole("status").textContent).toContain("Nuevo ID para iniciar sesión: 01181001"))
  expect(mocks.manage).toHaveBeenCalledWith(expect.objectContaining({id:"active",role:"tecnico"}),"Cambio a biomédico")
})
it("only offers deletion for inactive accounts and requires confirmation", async () => {
  render(<UserPermissionsView />)
  const remove = await screen.findByRole("button", { name: "Eliminar usuario" })
  expect(screen.getAllByRole("button", { name: "Eliminar usuario" })).toHaveLength(1)
  fireEvent.click(remove)
  expect(screen.getByRole("dialog", { name: "¿Eliminar usuario?" })).toBeTruthy()
  expect(mocks.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
  expect(mocks.remove).not.toHaveBeenCalled()
  fireEvent.click(remove)
  fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }))
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("inactive"))
  await waitFor(() => expect(screen.queryByText("Cuenta Inactiva")).toBeNull())
  expect(screen.getByText("Cuenta Activa")).toBeTruthy()
  expect(screen.getByText("Habilitado")).toBeTruthy()
  // A disconnected but enabled user cannot be deleted.
  expect(screen.getByText("Inactivo")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Eliminar usuario" })).toBeNull()
})
