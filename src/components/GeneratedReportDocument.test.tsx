import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const service = vi.hoisted(() => ({
  get: vi
    .fn()
    .mockResolvedValue({
      report: { id: 10, report_number: "REP-10", maintenance_number: "MC-7" },
    }),
  pdf: vi
    .fn()
    .mockResolvedValue(new Blob(["%PDF-QA"], { type: "application/pdf" })),
}))
vi.mock("../lib/reportManagement", () => ({
  getReportPreview: service.get,
  createReportPdf: service.pdf,
}))
import { GeneratedReportDocument } from "./GeneratedReportDocument"
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it("automatically generates the saved report PDF and releases the preview URL on close", async () => {
  const revoke = vi.fn()
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => "blob:report-preview",
    revokeObjectURL: revoke,
  })
  const view = render(<GeneratedReportDocument reportId={10} />)
  await screen.findByRole("link", { name: "Descargar reporte PDF" })
  expect(service.get).toHaveBeenCalledWith(10)
  expect(service.pdf).toHaveBeenCalledWith(
    expect.objectContaining({
      report_number: "REP-10",
      maintenance_number: "MC-7",
    }),
  )
  expect(
    screen.getByTitle("Documento PDF del reporte").getAttribute("src"),
  ).toBe("blob:report-preview")
  view.unmount()
  await waitFor(() =>
    expect(revoke).toHaveBeenCalledWith("blob:report-preview"),
  )
  vi.unstubAllGlobals()
})
