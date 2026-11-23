import { useEffect, useRef, useState } from "react"
import { Camera, ImagePlus, X } from "lucide-react"

export function IncidentPhotos({ files, onChange, disabled = false }: {
  files: File[]; onChange: (files: File[]) => void; disabled?: boolean
}) {
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [files])
  function add(input: HTMLInputElement) {
    const selected = Array.from(input.files || [])
    input.value = ""
    const valid = selected.filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size > 0 && file.size <= 10 * 1024 * 1024)
    setError(valid.length !== selected.length ? "Usa fotos JPG, PNG o WEBP de hasta 10 MB cada una." : "")
    onChange([...files, ...valid])
  }
  return <section className="incident-photos" aria-label="Fotos del incidente">
    <strong>Fotos del incidente (opcional)</strong>
    <p>Toma una foto o selecciona imágenes. Se adjuntarán al enviar el reporte.</p>
    <input hidden ref={camera} aria-label="Tomar foto del incidente" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={disabled} onChange={event => add(event.target)} />
    <input hidden ref={gallery} aria-label="Seleccionar fotos del incidente" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={event => add(event.target)} />
    <div className="incident-photo-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => camera.current?.click()}><Camera size={19} />Tomar foto</button><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => gallery.current?.click()}><ImagePlus size={19} />Elegir fotos</button></div>
    <div className="incident-photo-list">{files.map((file, index) => <div key={`${index}-${file.name}`}><img src={previews[index]} alt={`Foto adjunta ${index + 1}`} /><span>{file.name}</span><button type="button" className="icon-btn" disabled={disabled} aria-label={`Quitar foto ${index + 1}`} onClick={() => onChange(files.filter((_, i) => i !== index))}><X size={16} /></button></div>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
