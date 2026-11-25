import { useState } from "react"

import { ExternalLink, Link, Plus, Pencil, Save, Trash2 } from "lucide-react"

import type { EquipmentDocument, Role } from "../lib/supabase"

import { isOperationalCompletionEnabled } from "../lib/supabase"

import {
  saveEquipmentDocument,
  removeEquipmentDocument,
  validDocumentUrl,
} from "../lib/equipmentDocuments"

import { PrivateAttachmentPanel } from "./PrivateAttachmentPanel"

import { Button } from "./ui"

import { t } from "../lib/i18n"

export function EquipmentDocumentsPanel({
  equipmentId,
  documents,
  role,
  onChanged,
}: {
  equipmentId: string
  documents: EquipmentDocument[]
  role: Role
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<number | null | undefined>(),
    [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [kind, setKind] =
      useState<EquipmentDocument["document_type"]>("manual_usuario"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")

  function edit(doc?: EquipmentDocument) {
    setEditing(doc?.id || null)
    setTitle(doc?.title || "")
    setUrl(doc?.url || "")
    setKind(doc?.document_type || "manual_usuario")
    setError("")
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await saveEquipmentDocument(
        equipmentId,
        { title, url, document_type: kind },
        editing || undefined,
      )
      setEditing(undefined)
      onChanged()
    } catch (cause) {
      setError(
        cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "No fue posible guardar el enlace.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(doc: EquipmentDocument) {
    if (
      !window.confirm(
        `¿Quitar ${doc.title || "este documento"} de este equipo?`,
      )
    )
      return
    setBusy(true)
    setError("")
    try {
      await removeEquipmentDocument(equipmentId, doc.id)
      onChanged()
    } catch (cause) {
      setError(
        cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "No fue posible quitar el enlace.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="detail-section equipment-documents-panel">
      <h3>{t("Documentos y archivos del equipo")}</h3>
      <p>
        {t(
          role === "usuario"
            ? "Consulta los enlaces, PDFs, imágenes y documentos disponibles de este equipo."
            : "Agrega manuales por enlace o carga PDFs, imágenes y documentos particulares de este equipo.",
        )}
      </p>
      {role === "jefe" && (
        <Button
          icon={Plus}
          variant="secondary"
          disabled={busy}
          onClick={() => edit()}
        >
          {t("Agregar enlace")}
        </Button>
      )}
      {editing !== undefined && (
        <form className="equipment-document-form" onSubmit={save}>
          <h4>{t(editing ? "Editar enlace" : "Nuevo enlace")}</h4>
          <fieldset disabled={busy} className="report-edit-fields">
            <label className="field">
              <span>{t("Título del documento")}</span>
              <input
                required
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("Tipo de documento")}</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="manual_usuario">{t("Manual de usuario")}</option>
                <option value="manual_servicio">
                  {t("Manual de servicio")}
                </option>
                <option value="otro">{t("Otro documento")}</option>
              </select>
            </label>
            <label className="field">
              <span>URL</span>
              <input
                required
                type="url"
                maxLength={2048}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="table-actions">
              <Button
                icon={Save}
                type="submit"
                disabled={!title.trim() || !validDocumentUrl(url)}
              >
                {t("Guardar enlace")}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(undefined)}>
                {t("Cancelar")}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="document-list">
        {documents.map((doc) => {
          const href = validDocumentUrl(doc.url)
          return (
            <article key={doc.id}>
              <Link size={19} />
              <div>
                <strong>{doc.title || t("Documento")}</strong>
                <small>
                  {t(
                    doc.document_type === "manual_usuario"
                      ? "Manual de usuario"
                      : doc.document_type === "manual_servicio"
                        ? "Manual de servicio"
                        : "Otro documento",
                  )}
                </small>
              </div>
              <div className="table-actions">
                {href && (
                  <a
                    className="btn btn-secondary"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    {t("Abrir vínculo")}
                  </a>
                )}
                {role === "jefe" && (
                  <>
                    <Button
                      icon={Pencil}
                      variant="secondary"
                      disabled={busy}
                      onClick={() => edit(doc)}
                    >
                      {t("Editar enlace")}
                    </Button>
                    <Button
                      icon={Trash2}
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void remove(doc)}
                    >
                      {t("Quitar enlace")}
                    </Button>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {!documents.length && (
        <p>{t("No hay enlaces documentales vinculados.")}</p>
      )}
      {isOperationalCompletionEnabled && (
        <PrivateAttachmentPanel
          relation={{ equipmentId }}
          title={t("PDFs, imágenes y archivos")}
          readOnly={role === "usuario"}
          allowMetadataEdit={role === "jefe"}
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
