import { supabase, type Quote } from "./supabase"
export type PurchaseItem = {
  description: string
  quantity: string | number
  unit: string
  supplier_catalog: string | null
  unit_cost: string | number
  discount_percent: string | number
  line_total?: number
  gross?: number
  discount_amount?: number
}
export type PurchaseInput = {
  hospital: string
  department: string
  purpose: string
  supplier: string
  supplier_phone: string | null
  supplier_email: string | null
  supplier_address: string | null
  payment_terms: string | null
  required_on: string | null
  delivery_on: string | null
  fixed_asset: boolean
  out_of_line: boolean
  currency: string
  tax_percent: string | number
  notes: string | null
  items: PurchaseItem[]
}
export type PurchaseRequisition = {
  id: number
  quote_id: number
  requisition_number: string
  data: PurchaseInput & {
    requester: {
      full_name: string
      institutional_id: string
      department: string | null
    }
  }
  subtotal: number
  tax_percent: number
  tax_amount: number
  total: number
  created_at: string
  updated_at: string
}
export type PurchaseResult = {
  quote: Quote
  requisition: PurchaseRequisition
}
function client() {
  if (!supabase) throw new Error("Supabase no está configurado")
  return supabase
}
export async function getPurchaseRequisition(quoteId: number) {
  const { data, error } = await client().rpc("get_purchase_requisition", {
    target_quote_id: quoteId,
  })
  if (error) throw error
  return data as PurchaseRequisition | null
}
export async function savePurchaseRequisition(
  input: PurchaseInput,
  quoteId: number | null,
  expected: string | null,
  status: string,
) {
  const { data, error } = await client().rpc("save_purchase_requisition", {
    target_quote_id: quoteId,
    data: input,
    expected_updated_at: expected,
    new_status: status,
  })
  if (error) throw error
  return data as PurchaseResult
}
function scaled(value: string | number) {
  const text = String(value)
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Indica valores con un máximo de dos decimales.")
  const [whole, decimals = ""] = text.split(".")
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"))
}
export function purchaseTotals(
  items: PurchaseItem[],
  taxPercent: string | number,
) {
  const rate = scaled(taxPercent)
  if (rate > 10000n) throw new Error("El IVA debe estar entre 0 y 100%.")
  let subtotal = 0n
  const lines = items.map((item) => {
    const quantity = scaled(item.quantity),
      cost = scaled(item.unit_cost),
      discount = scaled(item.discount_percent)
    if (
      quantity <= 0n ||
      quantity > 10000000n ||
      cost > 999999999999n ||
      discount > 10000n
    )
      throw new Error("Revisa cantidad, precio y descuento.")
    const gross = (quantity * cost + 50n) / 100n,
      discountAmount = (gross * discount + 5000n) / 10000n,
      total = gross - discountAmount
    subtotal += total
    return {
      gross: Number(gross) / 100,
      discount: Number(discountAmount) / 100,
      total: Number(total) / 100,
    }
  })
  const tax = (subtotal * rate + 5000n) / 10000n,
    total = subtotal + tax
  if (total > 999999999999n)
    throw new Error("El total supera el límite permitido.")
  return {
    lines,
    subtotal: Number(subtotal) / 100,
    tax: Number(tax) / 100,
    total: Number(total) / 100,
  }
}
export const blankPurchaseItem = (): PurchaseItem => ({
  description: "",
  quantity: "1",
  unit: "Pza",
  supplier_catalog: "",
  unit_cost: "0",
  discount_percent: "0",
})
