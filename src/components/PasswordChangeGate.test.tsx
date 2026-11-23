import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const changePassword = vi.hoisted(() => vi.fn())
vi.mock("../lib/supabase", async (original) => ({ ...(await original<typeof import("../lib/supabase")>()), changeOwnPassword: changePassword }))
import { PasswordChangeGate } from "./PlatformViews"
beforeEach(() => { changePassword.mockReset(); changePassword.mockResolvedValue({ must_change_password: false }) })
afterEach(cleanup)
function fill() {
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "NuevaClaveSegura123" } })
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "NuevaClaveSegura123" } })
  fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
}
it("confirms the change before returning to login", async () => {
  const completed = vi.fn().mockResolvedValue(undefined), started = vi.fn()
  render(<PasswordChangeGate onStart={started} onCompleted={completed} />)
  fill()
  await screen.findByRole("dialog", { name: "Contraseña actualizada" })
  expect(started).toHaveBeenCalledOnce()
  expect(changePassword).toHaveBeenCalledWith("NuevaClaveSegura123")
  expect(completed).not.toHaveBeenCalled()
  expect(screen.queryByLabelText("Nueva contraseña")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Ir a iniciar sesión" }))
  await waitFor(() => expect(completed).toHaveBeenCalledOnce())
})
it("can retry logout without changing the password again", async () => {
  const completed = vi.fn().mockRejectedValueOnce(new Error("No fue posible cerrar la sesión")).mockResolvedValue(undefined)
  render(<PasswordChangeGate onCompleted={completed} />)
  fill(); await screen.findByRole("dialog", { name: "Contraseña actualizada" })
  fireEvent.click(screen.getByRole("button", { name: "Ir a iniciar sesión" }))
  await screen.findByRole("alert")
  fireEvent.click(screen.getByRole("button", { name: "Ir a iniciar sesión" }))
  await waitFor(() => expect(completed).toHaveBeenCalledTimes(2))
  expect(changePassword).toHaveBeenCalledOnce()
})
it("does not confirm a failed password change", async () => {
  changePassword.mockRejectedValue(new Error("No se pudo guardar"))
  render(<PasswordChangeGate onCompleted={vi.fn()} />)
  fill(); await screen.findByRole("alert")
  expect(screen.queryByRole("button", { name: "Ir a iniciar sesión" })).toBeNull()
})
