import { t } from "../lib/i18n"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { AlertTriangle, CalendarPlus, CheckCircle2, Save, Settings2 } from "lucide-react"
import {
  configureEquipmentPreventiveProgram,
  getInventoryAdministrationData,
  isInventoryAdministrationEnabled,
  reviewInventoryIssue,
  schedulePreventiveMaintenance,
  updateEquipmentAssetAdmin,
  type EquipmentInventoryBundle,
  type EquipmentProgramConfiguration,
  type InventoryAdminAsset,
  type InventoryAdministrationData,
  type InventoryIssue,
} from "../lib/supabase"

export const issueLabels: Record<string, string> = {
  duplicate_serial: "Número de serie compartido o duplicado, pendiente de verificar",
  duplicate_asset_signature: "Datos de identificación coincidentes",
  maintenance_periodicity_missing: "Periodicidad de mantenimiento sin definir",
  invalid_document_url: "Enlace documental no válido",
  location_case_variant: "Variación de escritura en la ubicación",
  missing_specific_location: "Ubicación específica no registrada",
  missing_user_manual: "Manual de usuario no registrado",
  risk_total_hardcoded: "Total de riesgo escrito como valor",
  same_manual_url: "El mismo enlace aparece en más de un tipo de manual",
  serial_placeholder: "Número de serie provisional",
  spelling_candidate: "Texto posiblemente inconsistente",
}

export function inventoryIssueLabel(code: string) {
  return issueLabels[code] || code.replace(/_/g, " ")
}

export function inventoryIssueDescription(issue: InventoryIssue) {
  if (issue.issue_code === "missing_specific_location") return "Agrega la ubicación específica del equipo dentro del área hospitalaria."
  if (issue.issue_code === "maintenance_periodicity_missing") return "El jefe debe confirmar el intervalo y las fechas del programa de mantenimiento."
  return /xlsx|excel|hoja1|archivo|importaci/i.test(issue.details)
    ? "Revisa este dato en la administración del equipo y registra su resolución."
    : issue.details
}

export type InventoryAdministrationApi = {
  load: typeof getInventoryAdministrationData
  updateAsset: typeof updateEquipmentAssetAdmin
  configureProgram: typeof configureEquipmentPreventiveProgram
  schedule: typeof schedulePreventiveMaintenance
  reviewIssue: typeof reviewInventoryIssue
}

const defaultApi: InventoryAdministrationApi = {
  load: getInventoryAdministrationData,
  updateAsset: updateEquipmentAssetAdmin,
  configureProgram: configureEquipmentPreventiveProgram,
  schedule: schedulePreventiveMaintenance,
  reviewIssue: reviewInventoryIssue,
}

function nullableNumber(value: string) {
  return value === "" ? null : Number(value)
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No fue posible completar la operación."
}

function formatDateMx(value: string | null, includeTime = false) {
  if (!value) return ""
  const date = includeTime
    ? new Date(value)
    : new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return "Fecha no válida"
  return new Intl.DateTimeFormat("es-MX", includeTime
    ? { dateStyle: "long", timeStyle: "short" }
    : { dateStyle: "long" }).format(date)
}

function AssetEditor({ data, onSave }: {
  data: InventoryAdministrationData
  onSave: (asset: InventoryAdminAsset) => Promise<void>
}) {
  const [asset, setAsset] = useState(data.asset)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const locations = data.locations.filter((item) => item.hospital_area_id === asset.hospital_area_id)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    if (asset.manufacture_year && asset.acquisition_year && asset.acquisition_year < asset.manufacture_year) {
      setMessage("El año de adquisición no puede ser anterior al año de fabricación.")
      return
    }
    if (!asset.hospital_area_id) {
      setMessage("Selecciona un área hospitalaria.")
      return
    }
    setSaving(true)
    try {
      await onSave(asset)
      setMessage("Cambios guardados y registrados en auditoría.")
    } catch (error) {
      setMessage(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel inventory-admin-card" onSubmit={submit}>
      <h3><Settings2 size={18} />{" "}{t("Administración del equipo")}</h3>
      <p>{t("Administra la ubicación, el estado y los datos del equipo.")}</p>
      <div className="form-grid">
        <label className="field"><span>{t("Número de serie")}</span><input value={asset.serial_number || ""} onChange={(e) => setAsset({ ...asset, serial_number: e.target.value || null })} /></label>
        <label className="field"><span>{t("Estado")}</span><select value={asset.status} onChange={(e) => setAsset({ ...asset, status: e.target.value as InventoryAdminAsset["status"] })}><option value="desconocido">{t("Sin confirmar")}</option><option value="operativo">{t("Operativo")}</option><option value="en_reparacion">{t("En reparación")}</option><option value="fuera_de_servicio">{t("Fuera de servicio")}</option><option value="baja">{t("Baja")}</option></select></label>
        <label className="field"><span>{t("Año de fabricación")}</span><input type="number" min="1950" max="2100" value={asset.manufacture_year ?? ""} onChange={(e) => setAsset({ ...asset, manufacture_year: nullableNumber(e.target.value) })} /></label>
        <label className="field"><span>{t("Año de adquisición")}</span><input type="number" min="1950" max="2100" value={asset.acquisition_year ?? ""} onChange={(e) => setAsset({ ...asset, acquisition_year: nullableNumber(e.target.value) })} /></label>
        <label className="field"><span>{t("Área hospitalaria")}</span><select value={asset.hospital_area_id} onChange={(e) => setAsset({ ...asset, hospital_area_id: Number(e.target.value), location_id: null })}>{data.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
        <label className="field"><span>{t("Ubicación específica")}</span><select value={asset.location_id ?? ""} onChange={(e) => setAsset({ ...asset, location_id: nullableNumber(e.target.value) })}><option value="">{t("Sin ubicación específica")}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="field"><span>{t("Resguardo")}</span><input value={asset.custodian_location_text || ""} onChange={(e) => setAsset({ ...asset, custodian_location_text: e.target.value || null })} /></label>
        <label className="check-inline"><input type="checkbox" checked={asset.serial_is_placeholder} onChange={(e) => setAsset({ ...asset, serial_is_placeholder: e.target.checked })} />{" "}{t("Serie provisional o pendiente de confirmar")}</label>
      </div>
      {message && <p className="inventory-admin-message" role="status">{message}</p>}
      <button className="btn btn-primary" disabled={saving} type="submit"><Save size={17} /> {saving ? t("Guardando...") : t("Guardar cambios")}</button>
    </form>
  )
}

function PreventiveEditor({ equipmentId, bundle, data, api, onChanged }: {
  equipmentId: string
  bundle: EquipmentInventoryBundle
  data: InventoryAdministrationData
  api: InventoryAdministrationApi
  onChanged: () => Promise<void>
}) {
  const firstProgram = data.programs[0]
  const [programId, setProgramId] = useState(firstProgram?.maintenance_program_id ?? 0)
  const selected = data.programs.find((item) => item.maintenance_program_id === programId) || firstProgram
  const [form, setForm] = useState<EquipmentProgramConfiguration | null>(selected || null)
  const lastConfiguration = useRef<EquipmentProgramConfiguration | null>(selected || null)
  const [scheduledAt, setScheduledAt] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [priority, setPriority] = useState<"critica" | "alta" | "ordinaria">("ordinaria")
  const [message, setMessage] = useState("")
  const programName = (id: number) => bundle.programs.find((item) => item.id === id)?.name || `Rutina ${id}`

  useEffect(() => {
    const next = data.programs.find((item) => item.maintenance_program_id === programId) || null
    if (lastConfiguration.current !== next) { lastConfiguration.current = next; setForm(next) }
  }, [data.programs, programId])

  if (!form) return <section className="panel inventory-admin-card"><h3>{" "}{t("Mantenimiento preventivo")}</h3><p>{t("No hay una rutina vinculada que pueda configurarse.")}</p></section>

  async function saveConfiguration(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    if (form!.interval_months && !form!.periodicity_basis?.trim()) {
      setMessage("Indica el fundamento de la periodicidad.")
      return
    }
    if (!form!.interval_months && (form!.reference_date || form!.last_completed_on)) {
      setMessage("Define primero una periodicidad para calcular vencimientos.")
      return
    }
    try {
      await api.configureProgram(equipmentId, form!)
      await onChanged()
      setMessage("Periodicidad específica del equipo guardada.")
    } catch (error) { setMessage(messageOf(error)) }
  }

  async function schedule(event: FormEvent) {
    event.preventDefault()
    setMessage("")
    if (!scheduledAt) { setMessage("Selecciona fecha y hora."); return }
    const scheduledDate = new Date(scheduledAt)
    if (Number.isNaN(scheduledDate.getTime())) { setMessage("La fecha de programación no es válida."); return }
    if (scheduledDate.getTime() <= Date.now()) { setMessage("La programación debe tener una fecha y hora futura."); return }
    try {
      await api.schedule({ equipmentId, programId, scheduledAt: scheduledDate.toISOString(), assignedTo: assignedTo || null, priority })
      setMessage("Orden preventiva creada. Ya aparecerá en mantenimiento y calendario.")
    } catch (error) { setMessage(messageOf(error)) }
  }

  return (
    <section className="panel inventory-admin-card">
      <h3><CalendarPlus size={18} />{" "}{t("Mantenimiento preventivo")}</h3>
      {bundle.enrichment?.maintenance_periodicity && <div className="inventory-source-periodicity"><strong>{t("Periodicidad del inventario actualizado")}</strong><p>{bundle.enrichment.maintenance_periodicity}</p>{bundle.enrichment.suggested_interval_months ? <button type="button" className="row-action" onClick={() => setForm({ ...form, interval_months: bundle.enrichment!.suggested_interval_months, periodicity_basis: "Periodicidad de referencia del equipo", periodicity_notes: bundle.enrichment!.maintenance_periodicity })}>{t("Usar intervalo de referencia (")}{bundle.enrichment.suggested_interval_months}{" "}{t("meses)")}</button> : <span className="badge badge-warning">{t("Definir las tareas e intervalos antes de configurar")}</span>}<small>{t("Revisa los valores y pulsa Guardar periodicidad para confirmarlos. Las fechas existentes se conservan.")}</small></div>}
      <label className="field"><span>{t("Rutina vinculada")}</span><select value={programId} onChange={(e) => setProgramId(Number(e.target.value))}>{data.programs.map((item) => <option key={item.maintenance_program_id} value={item.maintenance_program_id}>{programName(item.maintenance_program_id)}</option>)}</select></label>
      <form onSubmit={saveConfiguration}>
        <div className="form-grid">
          <label className="field"><span>{t("Periodicidad (meses)")}</span><input type="number" min="1" value={form.interval_months ?? ""} onChange={(e) => setForm({ ...form, interval_months: nullableNumber(e.target.value) })} /></label>
          <label className="field"><span>{t("Fundamento")}</span><input placeholder={t("Manual, política o criterio aprobado")} value={form.periodicity_basis || ""} onChange={(e) => setForm({ ...form, periodicity_basis: e.target.value || null })} /></label>
          <label className="field"><span>{t("Fecha de referencia")}</span><input type="date" lang="es-MX" value={form.reference_date || ""} onChange={(e) => setForm({ ...form, reference_date: e.target.value || null })} />{form.reference_date && <small>{formatDateMx(form.reference_date)}</small>}</label>
          <label className="field"><span>{t("Último mantenimiento")}</span><input type="date" lang="es-MX" value={form.last_completed_on || ""} onChange={(e) => setForm({ ...form, last_completed_on: e.target.value || null })} />{form.last_completed_on && <small>{formatDateMx(form.last_completed_on)}</small>}</label>
        </div>
        <label className="field"><span>{t("Notas")}</span><textarea value={form.periodicity_notes || ""} onChange={(e) => setForm({ ...form, periodicity_notes: e.target.value || null })} /></label>
        <p>{t("Próximo vencimiento:")}{" "}<strong>{form.next_due_on ? formatDateMx(form.next_due_on) : t("Se calculará al guardar si existe una fecha base")}</strong></p>
        <button className="btn btn-secondary" type="submit"><Save size={17} />{" "}{t("Guardar periodicidad")}</button>
      </form>
      <form className="inventory-schedule-form" onSubmit={schedule}>
        <h4>{t("Crear orden preventiva")}</h4>
        <div className="form-grid">
          <label className="field"><span>{t("Fecha y hora")}</span><input type="datetime-local" lang="es-MX" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />{scheduledAt && <small>{formatDateMx(scheduledAt, true)}</small>}</label>
          <label className="field"><span>{t("Técnico")}</span><select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}><option value="">{t("Sin asignar")}</option>{data.technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}</select></label>
          <label className="field"><span>{t("Prioridad")}</span><select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}><option value="ordinaria">{t("Ordinaria")}</option><option value="alta">{t("Alta")}</option><option value="critica">{t("Crítica")}</option></select></label>
        </div>
        <button className="btn btn-primary" type="submit"><CalendarPlus size={17} />{" "}{t("Programar mantenimiento")}</button>
      </form>
      {message && <p className="inventory-admin-message" role="status">{message}</p>}
    </section>
  )
}

function IssueReview({ issue, reviews, api, onChanged }: {
  issue: InventoryIssue
  reviews: InventoryAdministrationData["issueReviews"]
  api: InventoryAdministrationApi
  onChanged: () => Promise<void>
}) {
  const [status, setStatus] = useState<"" | "confirmado" | "corregido" | "descartado">("")
  const [notes, setNotes] = useState("")
  const [justification, setJustification] = useState("")
  const [evidence, setEvidence] = useState("")
  const [message, setMessage] = useState("")
  const history = reviews.filter((review) => review.issue_id === issue.id)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!status) { setMessage("Selecciona el resultado de la revisión."); return }
    if (!notes.trim() || !justification.trim()) { setMessage("Las observaciones y la justificación son obligatorias."); return }
    try {
      await api.reviewIssue({ issueId: issue.id, status, notes, justification, evidenceReference: evidence || null })
      await onChanged()
      setMessage("Revisión registrada sin eliminar la incidencia original.")
    } catch (error) { setMessage(messageOf(error)) }
  }

  return (
    <article className="inventory-issue-review">
      <strong>{inventoryIssueLabel(issue.issue_code)}</strong>
      <p>{inventoryIssueDescription(issue)}</p>
      <span>{t("Estado:")}{" "}{issue.review_status}</span>
      {history.length > 0 && <details><summary>{t("Historial (")}{history.length})</summary>{history.map((review) => <p key={review.id}><b>{review.review_status}</b> · {new Date(review.reviewed_at).toLocaleString("es-MX")}<br />{review.notes}<br /><small>{review.justification}</small></p>)}</details>}
      <form onSubmit={submit}>
        <label className="field"><span>{t("Resultado")}</span><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="" disabled>{t("Seleccionar resultado")}</option><option value="confirmado">{t("Confirmado")}</option><option value="corregido">{t("Corregido")}</option><option value="descartado">{t("Descartado")}</option></select></label>
        <label className="field"><span>{t("Observaciones")}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <label className="field"><span>{t("Justificación")}</span><textarea value={justification} onChange={(e) => setJustification(e.target.value)} /></label>
        <label className="field"><span>{t("Referencia de evidencia (opcional)")}</span><input value={evidence} onChange={(e) => setEvidence(e.target.value)} /></label>
        <button className="btn btn-secondary" type="submit"><CheckCircle2 size={17} />{" "}{t("Registrar revisión")}</button>
      </form>
      {message && <p className="inventory-admin-message" role="status">{message}</p>}
    </article>
  )
}

export function InventoryAdministration({ bundle, enabled = isInventoryAdministrationEnabled, api = defaultApi, onChanged }: {
  bundle: EquipmentInventoryBundle
  enabled?: boolean
  api?: InventoryAdministrationApi
  onChanged: () => void
}) {
  const [data, setData] = useState<InventoryAdministrationData | null>(null)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let active = true
    api.load(bundle.equipment.id).then((result) => { if (active) setData(result) }).catch((loadError) => { if (active) setError(messageOf(loadError)) })
    return () => { active = false }
  }, [api, bundle.equipment.id, enabled, reload])

  const refresh = useMemo(() => async () => {
    setReload((value) => value + 1)
    onChanged()
  }, [onChanged])

  if (!enabled) return (
    <section className="panel inventory-admin-disabled" role="status">
      <AlertTriangle size={22} />
      <div><strong>{t("Administración preparada, pendiente de aprobación")}</strong><p>{t("La consulta continúa activa, pero editar, programar y revisar se habilitarán únicamente después de desplegar")}{" "}<code>{t("13_inventory_administration.sql")}</code>.</p></div>
    </section>
  )
  if (error) return <section className="panel inventory-admin-disabled" role="alert"><AlertTriangle size={22} /><div><strong>{t("No fue posible cargar la administración")}</strong><p>{error}</p></div></section>
  if (!data) return <section className="panel inventory-admin-disabled"><Settings2 size={22} /><div><strong>{t("Cargando herramientas administrativas...")}</strong></div></section>

  return (
    <div className="inventory-admin-layout">
      <AssetEditor data={data} onSave={async (asset) => { await api.updateAsset(asset); await refresh() }} />
      <PreventiveEditor equipmentId={bundle.equipment.id} bundle={bundle} data={data} api={api} onChanged={refresh} />
      <section className="panel inventory-admin-card inventory-review-panel">
        <h3>{t("Revisión de incidencias")}</h3>
        <p>{t("Los registros dudosos se conservan; cada decisión agrega una entrada al historial.")}</p>
        {bundle.issues.length === 0 ? <p>{t("Este equipo no tiene incidencias registradas.")}</p> : bundle.issues.map((issue) => <IssueReview key={issue.id} issue={issue} reviews={data.issueReviews} api={api} onChanged={refresh} />)}
      </section>
    </div>
  )
}
