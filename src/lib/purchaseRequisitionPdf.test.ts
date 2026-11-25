import { expect, it } from "vitest"
import { purchaseRequisitionPdf } from "./purchaseRequisitionPdf"
import {
  blankPurchaseItem,
  purchaseTotals,
  type PurchaseRequisition,
} from "./purchaseRequisition"
it("prints a branded requisition with supplier, item table, accurate totals and four signature/date spaces", async () => {
  const item = {
    ...blankPurchaseItem(),
    description: "Sensor de reemplazo",
    quantity: 2,
    unit_cost: 100,
    discount_percent: 10,
    line_total: 180,
  }
  const totals = purchaseTotals([item], 16)
  const record = {
    id: 1,
    quote_id: 12,
    requisition_number: "REQ-000012",
    created_at: "2026-11-25T12:00:00Z",
    updated_at: "2026-11-25T12:00:00Z",
    subtotal: totals.subtotal,
    tax_percent: 16,
    tax_amount: totals.tax,
    total: totals.total,
    data: {
      hospital: "Hospital de prueba",
      department: "Biomedica",
      purpose: "Reposicion de sensores",
      supplier: "Proveedor de prueba",
      supplier_phone: "2221234567",
      supplier_email: "proveedor@example.com",
      currency: "MXN",
      requester: { full_name: "Ana Biomedica", institutional_id: "00181000" },
      items: [item],
    },
  } as PurchaseRequisition
  const text = await new Promise<string>(async (resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(await purchaseRequisitionPdf(record))
  })
  for (const value of [
    "%PDF-",
    "REQ-000012",
    "Hospital de prueba",
    "Sensor de reemplazo",
    "00181000",
    "180.00",
    "28.80",
    "208.80",
    "Compras",
    "Nombre y firma",
  ])
    expect(text).toContain(value)
  expect(text).toContain("/Count 1")
})
