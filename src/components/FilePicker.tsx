import { t } from "../lib/i18n"
import { useRef } from "react"
import { Upload } from "lucide-react"

export function FilePicker({ label, file, onChange, disabled = false }: {
  label: string
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  return <div className="file-picker">
    <input ref={input} hidden aria-label={label} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx" disabled={disabled} onChange={(event) => {
      onChange(event.target.files?.[0] || null)
      event.target.value = ""
    }} />
    <button type="button" className="row-action file-picker-button" disabled={disabled} onClick={() => input.current?.click()}><Upload size={18} aria-hidden="true" />{file ? t("Cambiar archivo") : t("Cargar archivo")}</button>
    <small className="file-picker-name" aria-live="polite">{file?.name || "Ningún archivo seleccionado"}</small>
  </div>
}
