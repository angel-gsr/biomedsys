import { expect, it } from "vitest"
import { blankPurchaseItem, purchaseTotals } from "./purchaseRequisition"
it("calculates discounts per line and tax with exact cent rounding", () => {
  const result = purchaseTotals(
    [
      {
        ...blankPurchaseItem(),
        quantity: "20",
        unit_cost: "5670",
        discount_percent: "0",
      },
      {
        ...blankPurchaseItem(),
        quantity: "5",
        unit_cost: "3800",
        discount_percent: "10",
      },
    ],
    "16",
  )
  expect(result.subtotal).toBe(130500)
  expect(result.tax).toBe(20880)
  expect(result.total).toBe(151380)
  const cents = purchaseTotals(
    [
      {
        ...blankPurchaseItem(),
        quantity: "1.5",
        unit_cost: "0.05",
        discount_percent: "50",
      },
    ],
    "16",
  )
  expect(cents.lines[0]).toEqual({ gross: 0.08, discount: 0.04, total: 0.04 })
  expect(cents.total).toBe(0.05)
})
it("rejects invalid quantities, discounts, tax and totals instead of silently rounding inputs", () => {
  for (const [item, tax] of [
    [{ quantity: "0" }, "16"],
    [{ unit_cost: "1.001" }, "16"],
    [{ discount_percent: "101" }, "16"],
    [{}, ""],
    [{}, "101"],
    [{ quantity: "100000", unit_cost: "9999999999.99" }, "16"],
  ] as const)
    expect(() =>
      purchaseTotals([{ ...blankPurchaseItem(), ...item }], tax),
    ).toThrow()
})
