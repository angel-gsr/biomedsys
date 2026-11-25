import { expect, it } from "vitest"

import { serviceOrderPdf } from "../components/ServiceOrderDocument"

import type { MaintenanceSummary } from "./supabase"

it("builds branded initial and final PDFs, preserves long technical text and embeds the engineer signature", async () => {
  const item = {
    maintenance_number: "MC-77",
    assigned_to: "tech",
    assigned_to_name: "Ana Biomedica",
    status: "en_proceso",
    scheduled_at: "2026-11-25T12:00:00Z",
    record: {
      diagnosis: "Diagnostico exclusivo final",
      work_performed: "Trabajo detallado ".repeat(240),
      test_results: "Prueba correcta",
      equipment_condition: "operativo",
      completed_at: "2026-11-25T13:00:00Z",
    },
  } as MaintenanceSummary

  async function read(blob: Blob) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(blob)
    })
  }

  const initial = await read(await serviceOrderPdf(item))
  expect(initial).not.toContain("Diagnostico exclusivo final")

  const final = await read(
    await serviceOrderPdf(item, null, {
      final: true,
      documentId: 7,
      signature:
        "data:image/png;base64,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",
    }),
  )

  expect(final).toContain("Diagnostico exclusivo final")
  expect(final).toContain("MC-77")
  expect(final).toContain("/Subtype /Image")
  expect(final).toMatch(/\/Count [2-9]/)
})
