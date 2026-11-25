import { t } from "../lib/i18n"
import { useEffect, useState } from "react"
import { Image } from "lucide-react"
import { createAttachmentDownloadUrl, listPrivateAttachments, type FileAttachment } from "../lib/supabase"

export function ReportAttachments({ reportId }: { reportId: number }) {
  const [files, setFiles] = useState<FileAttachment[]>([])
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    listPrivateAttachments({ reportId }).then(rows => { if (active) setFiles(rows) }).catch(() => { if (active) setError("No fue posible consultar las fotos del reporte.") })
    return () => { active = false }
  }, [reportId])
  async function open(file: FileAttachment) {
    const tab = window.open("", "_blank")
    if (tab) tab.opener = null
    try {
      const url = await createAttachmentDownloadUrl(file)
      if (tab) tab.location.href = url
      else setError("Permite abrir ventanas para consultar la foto.")
    } catch { tab?.close(); setError("No fue posible abrir el archivo adjunto.") }
  }
  if (!files.length && !error) return null
  return <section className="attachment-panel"><strong>{t("Fotos y archivos del incidente")}</strong>{files.map(file => <button type="button" className="attachment-link" key={file.id} onClick={() => void open(file)}><Image size={18} aria-hidden="true" /> {file.original_name}</button>)}{error && <p className="form-error" role="alert">{error}</p>}</section>
}
