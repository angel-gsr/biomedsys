import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ getCurrentProfile: vi.fn(), changeOwnPassword: vi.fn(), signOut: vi.fn(), authChanged: null as null | ((event: string) => void) }))
vi.mock("../lib/supabase", async (original) => ({ ...(await original<typeof import("../lib/supabase")>()), getCurrentProfile: state.getCurrentProfile, changeOwnPassword: state.changeOwnPassword, supabase: { auth: { onAuthStateChange: (callback: (event: string) => void) => { state.authChanged = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } }, signOut: state.signOut } } }))
vi.mock("./DashboardViews", () => ({ Dashboard: () => <div>Dashboard de prueba</div> }))
vi.mock("./HospitalAlertHub", () => ({ HospitalAlertHub: () => null }))
import App from "../App"
afterEach(cleanup)

it("keeps confirmation visible across USER_UPDATED and returns to login after local logout", async () => {
  const profile = { id: "user", institutional_id: "02123456", full_name: "Cuenta de prueba", role: "usuario", department: "Clínica", active: true, must_change_password: true }
  state.getCurrentProfile.mockResolvedValueOnce(profile).mockResolvedValue({ ...profile, must_change_password: false })
  state.changeOwnPassword.mockImplementation(async () => { state.authChanged?.("USER_UPDATED"); return { ...profile, must_change_password: false } })
  state.signOut.mockImplementation(async () => { state.authChanged?.("SIGNED_OUT"); return { error: null } })
  render(<App />)
  await screen.findByLabelText("Nueva contraseña")
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "NuevaClave12" } })
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "NuevaClave12" } })
  fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
  await screen.findByRole("dialog", { name: "Contraseña actualizada" })
  await waitFor(() => expect(state.getCurrentProfile).toHaveBeenCalledTimes(2))
  expect(screen.getByRole("button", { name: "Ir a iniciar sesión" })).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ir a iniciar sesión" })) })
  expect(await screen.findByRole("heading", { name: "Te damos la bienvenida" })).toBeTruthy()
  expect(screen.getByText("Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.")).toBeTruthy()
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" })
})
