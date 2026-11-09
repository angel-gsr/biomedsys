import { describe, expect, it, vi } from "vitest"
import QRCode from "qrcode"
import jsQR from "jsqr"
vi.mock("./supabase", () => ({ listEquipmentInventory: vi.fn() }))
import { listEquipmentInventory } from "./supabase"
import { findEquipmentQr, parseEquipmentQr } from "./equipmentQr"

const id = "12345678-1234-1234-1234-123456789abc"
describe("equipment QR", () => {
  it("reads real generated labels and extracts only their identifier", () => {
    const url = `https://biomed.example/?equipment=${id}`
    const qr = QRCode.create(url)
    const scale = 5, width = (qr.modules.size + 8) * scale
    const pixels = new Uint8ClampedArray(width * width * 4).fill(255)
    for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
      if (!qr.modules.get(y, x)) continue
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const index = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4
        pixels[index] = pixels[index + 1] = pixels[index + 2] = 0
      }
    }
    const decoded = jsQR(pixels, width, width)
    expect(parseEquipmentQr(decoded!.data)).toEqual({ id })
    expect(parseEquipmentQr("eq-000001")).toEqual({ code: "EQ-000001" })
    expect(parseEquipmentQr("javascript:alert(1)")).toBeNull()
    expect(parseEquipmentQr("https://example.org/?equipment=not-an-id")).toBeNull()
  })

  it("resolves through the signed-in role and rejects unknown equipment", async () => {
    vi.mocked(listEquipmentInventory).mockResolvedValue([{ id, inventory_code: "EQ-000001" }] as never)
    expect((await findEquipmentQr(`https://old.example/?equipment=${id}`, "usuario")).id).toBe(id)
    expect(listEquipmentInventory).toHaveBeenCalledWith("usuario", {})
    vi.mocked(listEquipmentInventory).mockResolvedValue([])
    await expect(findEquipmentQr("EQ-999999", "tecnico")).rejects.toThrow("No se encontró")
  })
})
