import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { EquipmentDocument } from "../lib/supabase"
const api = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(7),
  remove: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("../lib/equipmentDocuments", async (original) => ({
  ...(await original<typeof import("../lib/equipmentDocuments")>()),
  saveEquipmentDocument: api.save,
  removeEquipmentDocument: api.remove,
}))
vi.mock("./PrivateAttachmentPanel", () => ({
  PrivateAttachmentPanel: () => <div>Archivos del equipo</div>,
}))
import { EquipmentDocumentsPanel } from "./EquipmentDocumentsPanel"
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const doc = {
  id: 7,
  title: "Manual original",
  document_type: "manual_usuario",
  url: "https://example.com/manual.pdf",
  review_status: "pendiente",
} as EquipmentDocument
it("prefills the selected equipment link for editing and refreshes after saving only that association", async () => {
  const changed = vi.fn()
  render(
    <EquipmentDocumentsPanel
      equipmentId="asset-A"
      documents={[doc]}
      role="jefe"
      onChanged={changed}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Editar enlace" }))
  expect(screen.getByLabelText("Título del documento")).toHaveProperty(
    "value",
    "Manual original",
  )
  fireEvent.change(screen.getByLabelText("Título del documento"), {
    target: { value: "Manual de este equipo" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Guardar enlace" }))
  await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  expect(api.save).toHaveBeenCalledWith(
    "asset-A",
    expect.objectContaining({ title: "Manual de este equipo" }),
    7,
  )
})
it("confirms unlinking, and keeps clinical access read-only", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true)
  render(
    <EquipmentDocumentsPanel
      equipmentId="asset-A"
      documents={[doc]}
      role="jefe"
      onChanged={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Quitar enlace" }))
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith("asset-A", 7))
  cleanup()
  render(
    <EquipmentDocumentsPanel
      equipmentId="asset-A"
      documents={[doc]}
      role="usuario"
      onChanged={vi.fn()}
    />,
  )
  expect(screen.getByRole("link", { name: "Abrir vínculo" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Editar enlace" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Agregar enlace" })).toBeNull()
})
