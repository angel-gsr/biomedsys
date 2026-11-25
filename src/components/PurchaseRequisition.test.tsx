import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { Quote } from "../lib/supabase"
const api = vi.hoisted(() => ({
  save: vi.fn(),
  get: vi.fn(),
  pdf: vi.fn().mockResolvedValue(new Blob(["pdf"])),
}))
vi.mock("../lib/supabase", () => ({
  getCurrentProfile: vi
    .fn()
    .mockResolvedValue({
      id: "chief",
      full_name: "Ana Biomedica",
      institutional_id: "00181000",
      department: "Ingeniería Biomédica",
    }),
  listUserDepartments: vi
    .fn()
    .mockResolvedValue(["Ingeniería Biomédica", "Urgencias"]),
}))
vi.mock("../lib/purchaseRequisition", async (original) => ({
  ...(await original<typeof import("../lib/purchaseRequisition")>()),
  savePurchaseRequisition: api.save,
  getPurchaseRequisition: api.get,
}))
vi.mock("../lib/purchaseRequisitionPdf", () => ({
  purchaseRequisitionPdf: api.pdf,
}))
import { PurchaseRequisition } from "./PurchaseRequisition"
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it("saves the completed requisition and automatically presents its printable PDF with the authenticated requester", async () => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:req"),
      revokeObjectURL: vi.fn(),
    }),
  )
  const saved = vi.fn()
  api.save.mockImplementation(async (data) => ({
    quote: { id: 12 },
    requisition: {
      id: 1,
      quote_id: 12,
      requisition_number: "REQ-000012",
      data,
      total: 208.8,
    },
  }))
  render(<PurchaseRequisition onBack={vi.fn()} onSaved={saved} />)
  await waitFor(() =>
    expect(screen.getByLabelText("Solicitante")).toHaveProperty(
      "value",
      "Ana Biomedica",
    ),
  )
  for (const [label, value] of [
    ["Hospital *", "Hospital de prueba"],
    ["Proveedor *", "Proveedor de prueba"],
    ["Equipo o servicio *", "Sensores"],
    ["Descripción * 1", "Sensor de reemplazo"],
    ["Cantidad * 1", "2"],
    ["Precio unitario * 1", "100"],
    ["Descuento (%) 1", "10"],
    ["IVA aplicable (%) *", "16"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar y generar requisición" }),
  )
  expect(
    await screen.findByRole("link", { name: "Descargar requisición PDF" }),
  ).toBeTruthy()
  expect(api.save).toHaveBeenCalledWith(
    expect.objectContaining({
      hospital: "Hospital de prueba",
      department: "Ingeniería Biomédica",
      tax_percent: "16",
    }),
    null,
    null,
    "pendiente",
  )
  expect(saved).toHaveBeenCalledOnce()
  expect(api.pdf).toHaveBeenCalledOnce()
})
it("keeps finalized quotations read-only while retaining printing", async () => {
  api.get.mockResolvedValue({
    id: 1,
    requisition_number: "REQ-12",
    data: {
      hospital: "Hospital",
      department: "Urgencias",
      supplier: "Proveedor",
      currency: "MXN",
    },
    total: 100,
  })
  render(
    <PurchaseRequisition
      quote={{ id: 12, quote_number: "COT-12", status: "aprobada" } as Quote}
      onBack={vi.fn()}
      onSaved={vi.fn()}
    />,
  )
  await screen.findByRole("link", { name: "Descargar requisición PDF" })
  expect(
    screen.queryByRole("button", { name: "Editar requisición" }),
  ).toBeNull()
  expect(screen.getByRole("button", { name: "Imprimir" })).toBeTruthy()
})
