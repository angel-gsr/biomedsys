import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReportSummary } from "../lib/supabase"
const services = vi.hoisted(() => ({ getReportPreview: vi.fn(), editReportIncident: vi.fn(), createReportPdf: vi.fn() }))
vi.mock("../lib/reportManagement", async (original) => ({ ...(await original<typeof import("../lib/reportManagement")>()), ...services }))
import { ReportPreview } from "./ReportPreview"
import { remainingEditSeconds } from "../lib/reportManagement"

const report = { id: 10, report_number: "REP-000010", equipment_identifier: "EQ-000001", description: "Incidente inicial", event_date: "2026-11-09", event_type: "Falla", service: "CEYE", location: "CEYE · Sala 1", manufacturer: "Marca", model_serial: "Modelo / Serie", patient_outcome: "Sin lesión", action_taken: "Aislado", priority: "Ordinaria", status: "Recibido", created_at: "2026-11-09T12:00:00Z", edited_at: null } as ReportSummary
const preview = { report, server_now: "2026-11-09T12:01:00Z", editable_until: "2026-11-09T12:10:00Z", can_edit: true }
afterEach(() => { cleanup(); vi.restoreAllMocks(); services.getReportPreview.mockReset(); services.editReportIncident.mockReset(); services.createReportPdf.mockReset() })
describe("report preview and author correction", () => {
  it("uses the server deadline and expires exactly at ten minutes", () => {
    expect(remainingEditSeconds(preview, 0)).toBe(540)
    expect(remainingEditSeconds(preview, 540000)).toBe(0)
    expect(remainingEditSeconds({ ...preview, can_edit: false }, 0)).toBe(0)
  })
  it("previews the report before exposing PDF download", async () => {
    services.getReportPreview.mockResolvedValue(preview)
    services.createReportPdf.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }))
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test-report") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
    render(<ReportPreview reportId={10} onClose={vi.fn()} onChanged={vi.fn()} />)
    await screen.findByText("Incidente inicial")
    expect(screen.queryByRole("link", { name: "Descargar PDF" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Vista previa PDF" }))
    expect(await screen.findByTitle("Vista previa PDF del reporte")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Descargar PDF" }).getAttribute("href")).toBe("blob:test-report")
    expect(services.getReportPreview).toHaveBeenCalledTimes(2)
  })
  it("allows only incident correction and disables correction for a frozen report", async () => {
    services.getReportPreview.mockResolvedValue(preview)
    services.editReportIncident.mockResolvedValue(report)
    const changed = vi.fn()
    render(<ReportPreview reportId={10} onClose={vi.fn()} onChanged={changed} />)
    fireEvent.click(await screen.findByRole("button", { name: "Corregir incidente" }))
    expect(screen.queryByRole("textbox", { name: "Ubicación" })).toBeNull()
    fireEvent.change(screen.getByLabelText("Descripción del incidente"), { target: { value: "Corrección del autor" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar corrección" }))
    await screen.findByRole("button", { name: "Vista previa PDF" })
    expect(services.editReportIncident).toHaveBeenCalledWith(report, expect.objectContaining({ description: "Corrección del autor" }))
    expect(changed).toHaveBeenCalled()
    cleanup()
    services.getReportPreview.mockResolvedValue({ ...preview, can_edit: false })
    render(<ReportPreview reportId={10} onClose={vi.fn()} onChanged={vi.fn()} />)
    await screen.findByText(/Edición cerrada/)
    expect(screen.queryByRole("button", { name: "Corregir incidente" })).toBeNull()
  })
})
