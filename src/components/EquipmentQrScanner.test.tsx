import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EquipmentQrScanner } from "./EquipmentQrScanner"
vi.mock("jsqr", () => ({ default: vi.fn(() => ({ data: "EQ-000001" })) }))
vi.mock("../lib/equipmentQr", () => ({ findEquipmentQr: vi.fn().mockResolvedValue({ id: "asset-1", inventory_code: "EQ-000001" }) }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe("QR camera lifecycle", () => {
  it("explains missing HTTPS without requesting the camera", async () => {
    vi.stubGlobal("isSecureContext", false)
    render(<EquipmentQrScanner role="usuario" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Escanear QR" }))
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("HTTPS"))
    fireEvent.click(screen.getByRole("button", { name: "Cerrar lector QR" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("explains camera permission rejection", async () => {
    vi.stubGlobal("isSecureContext", true)
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" })
    const getUserMedia = vi.fn().mockRejectedValue(denied)
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
    render(<EquipmentQrScanner role="jefe" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Escanear QR" }))
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Permiso de cámara denegado"))
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }))
  })

  it("releases a late camera grant after the dialog closes", async () => {
    vi.stubGlobal("isSecureContext", true)
    let grant!: (stream: MediaStream) => void
    const stop = vi.fn()
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { grant = resolve }))
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
    render(<EquipmentQrScanner role="tecnico" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Escanear QR" }))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Cerrar lector QR" }))
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await waitFor(() => expect(stop).toHaveBeenCalled())
  })

  it("selects the scanned equipment and stops its camera", async () => {
    vi.stubGlobal("isSecureContext", true)
    const stop = vi.fn(), onSelect = vi.fn()
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } })
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(4)
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640)
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) } as never)
    render(<EquipmentQrScanner role="usuario" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole("button", { name: "Escanear QR" }))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ id: "asset-1", inventory_code: "EQ-000001" }))
    expect(stop).toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
