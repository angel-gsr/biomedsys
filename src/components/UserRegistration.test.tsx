import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue(undefined) }))
vi.mock("../lib/supabase", async original => ({
  ...(await original<typeof import("../lib/supabase")>()),
  isOperationalCompletionEnabled: true,
  listProfiles: vi.fn().mockResolvedValue([]),
  listAccessRequests: vi.fn().mockResolvedValue([]),
  listUserDepartments: vi.fn().mockResolvedValue(["Urgencias", "CEYE"]),
  createAccessRequest: mocks.create,
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
  fireEvent.change(screen.getByLabelText("Departamento *"), { target: { value: "Urgencias" } })
  fireEvent.submit(screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!)
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ firstName: "Ángel José", lastName: "García López", age: "28", phone: "", department: "Urgencias", role: "tecnico" }))
})
