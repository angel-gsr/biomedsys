import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const api = vi.hoisted(() => ({ get: vi.fn(), pdf: vi.fn() }))
vi.mock("../lib/technovigilance", () => ({
  getTechnovigilanceDocument: api.get,
}))
vi.mock("../lib/technovigilancePdf", () => ({ technovigilancePdf: api.pdf }))
import { TechnovigilanceDocument } from "./TechnovigilanceDocument"
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it("requires a saved complete form, loads the latest server review, and removes stale PDF when editing", async () => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:tv"),
      revokeObjectURL: vi.fn(),
    }),
  )
  const saved = {
    report: { report_number: "REP-12" },
    review: { impact_description: "Consecuencia registrada" },
  }
  api.get.mockResolvedValue(saved)
  api.pdf.mockResolvedValue(new Blob(["pdf"]))
  const view = render(<TechnovigilanceDocument reportId={12} disabled />)
  expect(
    screen.getByRole("button", { name: "Generar PDF de Tecnovigilancia" }),
  ).toHaveProperty("disabled", true)
  view.rerender(<TechnovigilanceDocument reportId={12} disabled={false} />)
  fireEvent.click(
    screen.getByRole("button", { name: "Generar PDF de Tecnovigilancia" }),
  )
  expect(
    await screen.findByRole("link", { name: "Descargar PDF" }),
  ).toBeTruthy()
  expect(api.get).toHaveBeenCalledWith(12)
  expect(api.pdf).toHaveBeenCalledWith(saved)
  view.rerender(<TechnovigilanceDocument reportId={12} disabled />)
  expect(screen.queryByRole("link", { name: "Descargar PDF" })).toBeNull()
})
