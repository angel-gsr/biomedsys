import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { MaintenanceSummary } from "../lib/supabase"
const services = vi.hoisted(() => ({
  get: vi.fn(),
  issue: vi.fn(),
  pdf: vi
    .fn()
    .mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" })),
}))
vi.mock("../lib/serviceOrderDocuments", () => ({
  getServiceOrderDocument: services.get,
  issueServiceOrderDocument: services.issue,
}))
vi.mock("../lib/serviceOrderPdf", () => ({
  buildServiceOrderPdf: services.pdf,
}))
vi.mock("./LoanVoucher", () => ({
  SignaturePad: ({ onChange }: { onChange: (value: string) => void }) => (
    <button onClick={() => onChange("data:image/png;base64,signature")}>
      Dibujar firma de prueba
    </button>
  ),
}))
import { ServiceOrderDocument } from "./ServiceOrderDocument"
const item = {
  id: 1,
  maintenance_number: "MC-1",
  maintenance_code: "MC",
  status: "en_proceso",
  assigned_to: "tech",
  assigned_to_name: "Ana Ingeniera",
  scheduled_at: "2026-11-25T12:00:00Z",
  record: {
    completed_at: "2026-11-25T12:15:00Z",
    updated_at: "2026-11-25T12:16:00Z",
    diagnosis: "Sensor averiado",
    work_performed: "Cambio de sensor",
    test_results: "Prueba correcta",
  },
} as MaintenanceSummary
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
function prepare() {
  services.get.mockResolvedValue(null)
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:pdf"),
      revokeObjectURL: vi.fn(),
    }),
  )
}
it("allows only the assigned technician workflow to issue a signed saved snapshot and preview it", async () => {
  prepare()
  const doc = {
    id: 7,
    issued_at: "2026-11-25T12:20:00Z",
    record_updated_at: item.record!.updated_at,
    signature_png: "data:image/png;base64,signature",
    snapshot: { item, report: null },
  }
  services.issue.mockResolvedValue(doc)
  render(<ServiceOrderDocument item={item} role="tecnico" />)
  await waitFor(() => expect(services.get).toHaveBeenCalledWith(1))
  fireEvent.click(
    screen.getByRole("button", { name: "Agregar firma del biomédico" }),
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Dibujar firma de prueba" }),
  )
  fireEvent.click(
    screen.getByRole("button", {
      name: "Guardar firma y generar informe final",
    }),
  )
  expect(
    await screen.findByRole("link", { name: "Descargar PDF" }),
  ).toBeTruthy()
  expect(services.issue).toHaveBeenCalledWith(
    1,
    "data:image/png;base64,signature",
  )
  expect(services.pdf).toHaveBeenCalledWith(
    doc.snapshot.item,
    expect.any(Array),
    expect.objectContaining({
      final: true,
      signature: doc.signature_png,
      documentId: 7,
    }),
  )
})
it("keeps chief access read-only and uses the immutable final snapshot", async () => {
  prepare()
  const old = {
    ...item,
    record: { ...item.record, diagnosis: "Diagnóstico firmado" },
  } as MaintenanceSummary
  services.get.mockResolvedValue({
    id: 8,
    issued_at: "2026-11-25T12:20:00Z",
    signature_png: null,
    snapshot: { item: old, report: null },
  })
  render(<ServiceOrderDocument item={item} role="jefe" />)
  fireEvent.click(
    await screen.findByRole("button", { name: "Ver informe final / PDF" }),
  )
  await screen.findByRole("link", { name: "Descargar PDF" })
  expect(
    screen.queryByRole("button", { name: "Generar informe final" }),
  ).toBeNull()
  expect(services.issue).not.toHaveBeenCalled()
  expect(services.pdf.mock.calls.at(-1)?.[0].record.diagnosis).toBe(
    "Diagnóstico firmado",
  )
})
it("requires completed saved follow-up and excludes technical findings from the initial PDF", async () => {
  prepare()
  render(
    <ServiceOrderDocument item={{ ...item, record: null }} role="tecnico" />,
  )
  expect(
    screen.queryByRole("button", { name: "Generar informe final" }),
  ).toBeNull()
  fireEvent.click(
    screen.getByRole("button", { name: "Ver orden inicial / PDF" }),
  )
  await screen.findByRole("link", { name: "Descargar PDF" })
  expect(
    services.pdf.mock.calls
      .at(-1)?.[1]
      .find((s: { title: string }) => s.title === "Seguimiento técnico"),
  ).toBeUndefined()
})
