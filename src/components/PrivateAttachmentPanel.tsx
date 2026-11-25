import { t } from "../lib/i18n"
import { FilePicker } from "./FilePicker"
import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import {
  createAttachmentDownloadUrl,
  deletePrivateAttachment,
  listPrivateAttachments,
  uploadPrivateAttachment,
  type AttachmentRelation,
  type FileAttachment,
} from "../lib/supabase"

export function PrivateAttachmentPanel({ relation, title = "Archivos privados", readOnly=false }: { relation: AttachmentRelation; title?: string; readOnly?: boolean }) {
  const [rows, setRows] = useState<FileAttachment[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const relationKey = JSON.stringify(relation)
  function load() { listPrivateAttachments(relation).then(setRows).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No fue posible consultar los archivos.")) }
  useEffect(load, [relationKey])
  async function upload() { if (!file) return; setBusy(true); setError(""); try { await uploadPrivateAttachment(file, relation, description); setFile(null); setDescription(""); load() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible subir el archivo.") } finally { setBusy(false) } }
  async function download(row: FileAttachment) { try { window.open(await createAttachmentDownloadUrl(row), "_blank", "noopener,noreferrer") } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible descargar el archivo.") } }
  async function remove(row: FileAttachment) { if (!window.confirm(`¿Desactivar ${row.original_name}?`)) return; setBusy(true); setError(""); try { await deletePrivateAttachment(row.id); load() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible eliminar el archivo.") } finally { setBusy(false) } }
  return <div className="attachment-panel"><strong>{title}</strong>{!readOnly && <div className="attachment-upload"><FilePicker label={`Archivo para ${title}`} file={file} onChange={setFile} disabled={busy} /><input aria-label={t("Descripción del archivo")} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("Descripción")} /><button type="button" className="row-action" disabled={!file || busy} onClick={upload}><Save size={15} />{busy ? t("Subiendo...") : t("Guardar archivo")}</button></div>}{rows.map((row) => <div className="attachment-row" key={row.id}><button type="button" className="attachment-link" onClick={() => download(row)}>{row.original_name} · {(row.size_bytes / 1024).toFixed(1)}{" "}{t("KB")}</button>{!readOnly && <button type="button" className="row-action" disabled={busy} onClick={() => remove(row)}>{t("Eliminar")}</button>}</div>)}{rows.length === 0 && <small>{t("No hay archivos vinculados.")}</small>}{error && <small className="form-error">{error}</small>}</div>
}
