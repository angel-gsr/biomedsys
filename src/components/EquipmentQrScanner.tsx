import { useEffect, useRef, useState } from "react"
import { QrCode, X } from "lucide-react"
import { findEquipmentQr } from "../lib/equipmentQr"
import type { EquipmentInventoryDetail, Role } from "../lib/supabase"

export function EquipmentQrScanner({ role, onSelect }: { role: Role; onSelect: (equipment: EquipmentInventoryDetail) => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  function close() { setOpen(false); trigger.current?.focus() }
  return <>
    <button ref={trigger} type="button" className="btn btn-secondary" onClick={() => setOpen(true)}><QrCode size={19} /> Escanear QR</button>
    {open && <Scanner role={role} onClose={close} onSelect={(equipment) => { close(); onSelect(equipment) }} />}
  </>
}

function Scanner({ role, onClose, onSelect }: { role: Role; onClose: () => void; onSelect: (equipment: EquipmentInventoryDetail) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const selected = useRef(onSelect)
  selected.current = onSelect
  const [error, setError] = useState("")
  const [status, setStatus] = useState("Solicitando acceso a la cámara...")
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    function stop() { stream?.getTracks().forEach((track) => track.stop()); if (timer) clearTimeout(timer) }
    function hidden() {
      if (document.hidden) { active = false; stop(); setError("La cámara se pausó al salir de la app. Pulsa Reintentar para continuar.") }
    }
    document.addEventListener("visibilitychange", hidden)
    setError("")
    setStatus("Solicitando acceso a la cámara...")
    async function start() {
      try {
        if (!window.isSecureContext) throw new Error("Para usar la cámara abre la app mediante HTTPS o localhost. Una dirección HTTP de la red local no permite acceder a la cámara.")
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar la cámara. Puedes buscar el equipo por su código.")
        const { default: jsQR } = await import("jsqr")
        if (!active) return
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } })
        if (!active) { stop(); return }
        const element = video.current
        if (!element) { stop(); return }
        element.srcObject = stream
        await element.play()
        if (!active) return
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) throw new Error("No fue posible iniciar el lector de imágenes.")
        setStatus("Apunta la cámara al QR del equipo y mantenlo dentro de la imagen.")
        async function scan() {
          if (!active) return
          try {
            if (element!.readyState >= 2 && element!.videoWidth > 0) {
              const scale = Math.min(1, 720 / element!.videoWidth)
              canvas.width = Math.round(element!.videoWidth * scale)
              canvas.height = Math.round(element!.videoHeight * scale)
              context!.drawImage(element!, 0, 0, canvas.width, canvas.height)
              const image = context!.getImageData(0, 0, canvas.width, canvas.height)
              const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })
              if (code?.data) {
                stop()
                setStatus("Buscando el equipo...")
                const equipment = await findEquipmentQr(code.data, role)
                if (active) selected.current(equipment)
                return
              }
            }
            timer = setTimeout(scan, 180)
          } catch (cause) { stop(); if (active) setError(cause instanceof Error ? cause.message : "No fue posible leer el código QR.") }
        }
        timer = setTimeout(scan, 180)
      } catch (cause) {
        stop()
        if (!active) return
        const name = cause instanceof Error ? cause.name : ""
        setError(name === "NotAllowedError" ? "Permiso de cámara denegado. Habilítalo en los permisos del navegador y vuelve a intentar." : name === "NotFoundError" ? "No se encontró una cámara disponible en este dispositivo." : name === "NotReadableError" ? "La cámara está ocupada. Cierra otras aplicaciones que la estén usando." : cause instanceof Error ? cause.message : "No fue posible abrir la cámara.")
      }
    }
    void start()
    return () => { active = false; stop(); document.removeEventListener("visibilitychange", hidden) }
  }, [role, retry])

  useEffect(() => { dialog.current?.querySelector<HTMLButtonElement>("button")?.focus() }, [])
  return <div className="modal-layer qr-scanner-layer" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} className="modal qr-scanner" role="dialog" aria-modal="true" aria-label="Escanear QR de equipo" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key === "Tab") {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button")
        if (!buttons?.length) return
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}>
      <div className="modal-head"><h2>Escanear equipo</h2><button type="button" className="icon-btn" aria-label="Cerrar lector QR" onClick={onClose}><X size={21} /></button></div>
      <video ref={video} autoPlay muted playsInline aria-label="Vista previa de la cámara" />
      {error ? <p className="form-error" role="alert">{error}</p> : <p role="status">{status}</p>}
      <p>También puedes cerrar el lector y buscar el código manualmente.</p>
      {error && <button type="button" className="btn btn-primary" onClick={() => setRetry((value) => value + 1)}>Reintentar</button>}
    </div>
  </div>
}
