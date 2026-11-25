import { t } from "../lib/i18n"
import {updateEquipmentFile} from "../lib/equipmentDocuments"
import { FilePicker } from "./FilePicker"
import { useEffect, useState } from "react"
import { Save,Pencil } from "lucide-react"
import {
  createAttachmentDownloadUrl,
  deletePrivateAttachment,
  listPrivateAttachments,
  uploadPrivateAttachment,
  type AttachmentRelation,
  type FileAttachment,
} from "../lib/supabase"

export function PrivateAttachmentPanel({ relation, title = "Archivos privados", readOnly=false,allowMetadataEdit=false }: { relation: AttachmentRelation; title?: string; readOnly?: boolean;allowMetadataEdit?:boolean }) {
  const [editing,setEditing]=useState<FileAttachment|null>(null),[fileTitle,setFileTitle]=useState(""),[fileDescription,setFileDescription]=useState("")
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
  async function saveInfo(event:React.FormEvent){event.preventDefault();if(!editing)return;setBusy(true);setError("");try{await updateEquipmentFile(editing.id,fileTitle,fileDescription);setEditing(null);load()}catch(cause){setError(cause && typeof cause==="object" && "message" in cause?String(cause.message):"No fue posible actualizar el archivo.")}finally{setBusy(false)}}
  return <div className="attachment-panel"><strong>{title}</strong>{!readOnly && <div className="attachment-upload"><FilePicker label={`Archivo para ${title}`} file={file} onChange={setFile} disabled={busy} /><input aria-label={t("Descripción del archivo")} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("Descripción")} /><button type="button" className="row-action" disabled={!file || busy} onClick={upload}><Save size={15} />{busy ? t("Subiendo...") : t("Guardar archivo")}</button></div>}{editing && <form className="equipment-document-form" onSubmit={saveInfo}><h4>{t("Editar archivo")}</h4><label className="field"><span>{t("Nombre del archivo")}</span><input required maxLength={180} value={fileTitle} onChange={e=>setFileTitle(e.target.value)}/></label><label className="field"><span>{t("Descripción del archivo")}</span><textarea aria-label={t("Descripción del archivo")} maxLength={2000} value={fileDescription} onChange={e=>setFileDescription(e.target.value)}/></label><div className="table-actions"><button className="row-action" type="submit" disabled={busy}>{t("Guardar cambios")}</button><button className="row-action" type="button" disabled={busy} onClick={()=>setEditing(null)}>{t("Cancelar")}</button></div></form>}{rows.map((row) => <div className="attachment-row" key={row.id}><div><button type="button" className="attachment-link" onClick={() => download(row)}>{row.original_name} · {(row.size_bytes / 1024).toFixed(1)}{" "}{t("KB")}</button>{row.description && <small className="attachment-description">{row.description}</small>}</div>{!readOnly && allowMetadataEdit && <button className="row-action" type="button" disabled={busy} onClick={()=>{setEditing(row);setFileTitle(row.original_name);setFileDescription(row.description||"")}}><Pencil size={15}/>{t("Editar archivo")}</button>}{!readOnly && <button type="button" className="row-action" disabled={busy} onClick={() => remove(row)}>{t("Eliminar")}</button>}</div>)}{rows.length === 0 && <small>{t("No hay archivos vinculados.")}</small>}{error && <small className="form-error">{error}</small>}</div>
}
