import { MaintenancePlanner } from "./MaintenancePlanner"
import { t } from "../lib/i18n"
import { ServiceOrderDocument } from "./ServiceOrderDocument"
import { FilePicker } from "./FilePicker"
import { Fragment, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  RefreshCw,
  Save,
  Wrench,
} from "lucide-react"
import {
  createAttachmentDownloadUrl,
  deletePrivateAttachment,
  isOperationalCompletionEnabled,
  listMaintenanceOverview,
  listReports,
  type ReportSummary,
  saveCorrectiveIntervention,
  savePreventiveIntervention,
  uploadPrivateAttachment,
  updateAssignedMaintenanceStatus,
  validateCorrectiveClosure,
  validatePreventiveClosure,
  type FileAttachment,
  type MaintenanceCatalogItem,
  type MaintenanceSummary,
  type Role,
} from "../lib/supabase"
import { Button, PageIntro } from "./ui"

function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function toLocalInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function nowLocalInput() {
  return toLocalInput(new Date().toISOString())
}

function Loading({ label }: { label: string }) {
  return (
    <section className="panel empty-state" aria-busy="true">
      <RefreshCw className="spin" size={34} />
      <h3>{label}</h3>
    </section>
  )
}

function Failure({ error, retry }: { error: string; retry: () => void }) {
  return (
    <section className="panel empty-state" role="alert">
      <AlertTriangle size={34} />
      <h3>{t("No fue posible consultar la información")}</h3>
      <p>{error}</p>
      <Button icon={RefreshCw} variant="secondary" onClick={retry}>{t("Reintentar")}</Button>
    </section>
  )
}

function useMaintenanceOverview() {
  const [catalog, setCatalog] = useState<MaintenanceCatalogItem[]>([])
  const [maintenances, setMaintenances] = useState<MaintenanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    listMaintenanceOverview()
      .then((result) => {
        if (active) {
          setCatalog(result.catalog)
          setMaintenances(result.maintenances)
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Error de consulta no identificado.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])
  return {
    catalog,
    maintenances,
    loading,
    error,
    retry: () => setReload((value) => value + 1),
  }
}

export function MaintenanceView({ role, onOpenOrder }: { role: Role; onOpenOrder?: (id:number)=>void }) {
  const state = useMaintenanceOverview()
  const [showPlanner,setShowPlanner]=useState(false)
  const counts = useMemo(
    () =>
      state.maintenances.reduce<Record<string, number>>((result, item) => {
        if (item.status !== "cancelado")
          result[item.maintenance_code] =
            (result[item.maintenance_code] || 0) + 1
        return result
      }, {}),
    [state.maintenances],
  )
  const preventiveState = useMemo(() => {
    const now = Date.now()
    const warning = now + 30 * 24 * 60 * 60 * 1000
    return state.maintenances.filter((item) => item.maintenance_code === "MP" && item.status === "programado").reduce((result, item) => {
      const scheduled = new Date(item.scheduled_at).getTime()
      if (scheduled < now) result.overdue += 1
      else if (scheduled <= warning) result.upcoming += 1
      else result.later += 1
      return result
    }, { overdue: 0, upcoming: 0, later: 0 })
  }, [state.maintenances])
  if (state.loading) return <Loading label={t("Consultando mantenimientos...")} />
  if (state.error) return <Failure error={state.error} retry={state.retry} />
  return (
    <>
      <PageIntro
        action={role === "jefe" ? <Button icon={CalendarDays} onClick={()=>setShowPlanner(true)}>{t("Programar mantenimiento")}</Button> : undefined}
        title={t("Mantenimiento")}
        description={t("Órdenes y actividades realmente registradas y visibles para tu sesión.")}
      />
      {showPlanner && <MaintenancePlanner onOpenOrder={onOpenOrder} onClose={()=>setShowPlanner(false)} onSaved={()=>{setShowPlanner(false);state.retry()}}/>}
      <section className="maintenance-catalog">
        {state.catalog.map((item) => (
          <article className="panel maintenance-type" key={item.code}>
            <div className="maintenance-code">{item.code}</div>
            <div>
              <span className="eyebrow">{t("Tipo de mantenimiento")}</span>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
            </div>
            <strong>
              {counts[item.code] || 0}
              <small>{t("registrados")}</small>
            </strong>
          </article>
        ))}
      </section>
      <section className="maintenance-catalog preventive-summary"><article className="panel maintenance-type"><div className="maintenance-code">!</div><div><h3>{t("Preventivos vencidos")}</h3><p>{t("Órdenes programadas cuya fecha ya pasó.")}</p></div><strong>{preventiveState.overdue}</strong></article><article className="panel maintenance-type"><div className="maintenance-code">{t("30")}</div><div><h3>{t("Próximos 30 días")}</h3><p>{t("Fechas registradas, sin periodicidades inferidas.")}</p></div><strong>{preventiveState.upcoming}</strong></article><article className="panel maintenance-type"><div className="maintenance-code">+</div><div><h3>{t("Posteriores")}</h3><p>{t("Preventivos pendientes fuera de la ventana inmediata.")}</p></div><strong>{preventiveState.later}</strong></article></section>
      <section className="panel orders-panel">
        <div className="panel-head">
          <div>
            <h3>
              {role === "tecnico"
                ? t("Mis mantenimientos")
                : t("Mantenimientos programados")}
            </h3>
            <p>{t("No se generan eventos de calendario a partir de rutinas sin periodicidad.")}</p>
          </div>
          <CalendarDays size={21} />
        </div>
        <MaintenanceTable items={state.maintenances} role={role} onChanged={state.retry} />
      </section>
    </>
  )
}

export function ServiceOrdersView({ role, requestedOrderId = null, onBack, backLabel = "Volver a Mesa de ayuda" }: { role: Role; requestedOrderId?: number | null; onBack?: () => void; backLabel?: string }) {
  const state = useMaintenanceOverview()
  if (state.loading)
    return <Loading label={t("Consultando órdenes de servicio...")} />
  if (state.error) return <Failure error={state.error} retry={state.retry} />
  if (requestedOrderId !== null) {
    const item = state.maintenances.find(order => order.id === requestedOrderId)
    return <><Button variant="secondary" icon={ArrowLeft} onClick={onBack}>{t(backLabel)}</Button>{!item ? <section className="panel"><h2>{t("Orden no disponible")}</h2><p>{t("No se encontró la orden o no tienes acceso a ella.")}</p></section> : <><PageIntro title={`Orden ${item.maintenance_number}`} description={t("Orden de servicio confirmada · Vista de consulta")} /><ReadOnlyServiceOrder key={item.id} item={item} /></>}</>
  }
  return (
    <>
      <PageIntro
        title={t("Órdenes de servicio")}
        description={t("Mantenimientos creados en Supabase; los formularios técnicos detallados se habilitarán cuando exista una orden seleccionada.")}
      />
      <section className="panel orders-panel">
        <MaintenanceTable items={state.maintenances} role={role} onChanged={state.retry} />
      </section>
    </>
  )
}

function ReadOnlyServiceOrder({ item }: { item: MaintenanceSummary }) {
  const [report,setReport]=useState<ReportSummary | null>(null)
  const [loading,setLoading]=useState(Boolean(item.source_report_id)),[error,setError]=useState("")
  useEffect(()=>{let active=true;if(!item.source_report_id)return;listReports().then(rows=>{if(active){const found=rows.find(r=>r.id===item.source_report_id);if(!found)throw new Error("No fue posible consultar el incidente vinculado");setReport(found)}}).catch(cause=>{if(active)setError(cause.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[item.source_report_id])
  if(loading)return <p>{t("Cargando datos del incidente...")}</p>
  if(error)return <p role="alert" className="form-error">{error}</p>
  return <ServiceOrderDocument item={item} report={report} />
}

function MaintenanceStatusEditor({ item, role, onChanged }: { item: MaintenanceSummary; role: Role; onChanged: () => void }) {
  const options = item.status === "programado"
    ? role === "tecnico" ? ["en_proceso"] : ["en_proceso", "cancelado"]
    : item.status === "en_proceso" && role === "jefe" ? ["cancelado"] : []
  const [status, setStatus] = useState<MaintenanceSummary["status"]>((options[0] || item.status) as MaintenanceSummary["status"])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => setStatus((options[0] || item.status) as MaintenanceSummary["status"]), [item.status, role])

  if (options.length === 0) return <span className="muted-copy">{t("Sin transición disponible")}</span>

  async function save() {
    setSaving(true)
    setError("")
    try {
      await updateAssignedMaintenanceStatus(item.id, status)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar la orden.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="maintenance-status-editor">
      <select aria-label={`Estado de ${item.maintenance_number}`} value={status} onChange={(event) => setStatus(event.target.value as MaintenanceSummary["status"])}>
        {options.map((option) => <option key={option} value={option}>{option === "en_proceso" ? t("Iniciar") : t("Cancelar")}</option>)}
      </select>
      <button type="button" className="row-action" disabled={saving} onClick={save}>
        {saving ? t("Guardando...") : t("Aplicar")}
      </button>
      {error && <small className="form-error" role="alert">{error}</small>}
    </div>
  )
}

function MaintenanceTable({ items, role, onChanged }: { items: MaintenanceSummary[]; role: Role; onChanged: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  if (items.length === 0)
    return (
      <div className="empty-state">
        <Wrench size={34} />
        <h3>{t("No hay mantenimientos registrados")}</h3>
        <p>{t("No se muestran órdenes ni fechas simuladas.")}</p>
      </div>
    )
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("Orden")}</th>
            <th>{t("Equipo")}</th>
            <th>{t("Tipo")}</th>
            <th>{t("Estado")}</th>
            <th>{t("Prioridad")}</th>
            <th>{t("Programación")}</th>
            {(role === "jefe" || role === "tecnico") && <th>{t("Actualizar")}</th>}
            {(role === "jefe" || role === "tecnico") && <th>{t("Expediente")}</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={item.id}>
            <tr>
              <td>
                <strong className="order-id">{item.maintenance_number}</strong>
              </td>
              <td><strong>{item.equipment_identifier || "Equipo vinculado"}</strong>{item.equipment && <small className="table-subline">{item.equipment.equipment_type} · {item.equipment.manufacturer} {item.equipment.model}</small>}</td>
              <td>{item.maintenance_code}</td>
              <td>{item.status.replace(/_/g, " ")}</td>
              <td>{item.priority || "Sin registrar"}</td>
              <td>{formatDate(item.scheduled_at)}</td>
              {(role === "jefe" || role === "tecnico") && <td><MaintenanceStatusEditor item={item} role={role} onChanged={onChanged} /></td>}
              {(role === "jefe" || role === "tecnico") && <td><button type="button" className="row-action" onClick={() => setExpanded((current) => current === item.id ? null : item.id)}>{expanded === item.id ? t("Ocultar") : t("Abrir")}</button></td>}
            </tr>
            {expanded === item.id && (role === "jefe" || role === "tecnico") && (
              <tr className="maintenance-detail-row"><td colSpan={8}><CorrectiveWorkflowPanel item={item} role={role} onChanged={onChanged} /></td></tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CorrectiveWorkflowPanel({ item, role, onChanged }: { item: MaintenanceSummary; role: Role; onChanged: () => void }) {
  if (item.maintenance_code === "MP")
    return <PreventiveWorkflowPanel item={item} role={role} onChanged={onChanged} />

  const record = item.record
  const [startedAt, setStartedAt] = useState(toLocalInput(record?.started_at) || nowLocalInput())
  const [completedAt, setCompletedAt] = useState(toLocalInput(record?.completed_at))
  const [diagnosis, setDiagnosis] = useState(record?.diagnosis || "")
  const [workPerformed, setWorkPerformed] = useState(record?.work_performed || "")
  const [testResults, setTestResults] = useState(record?.test_results || "")
  const [condition, setCondition] = useState<"" | "operativo" | "en_reparacion" | "fuera_de_servicio">(record?.equipment_condition || "")
  const [technicalNotes, setTechnicalNotes] = useState(record?.technical_notes || "")
  const [closureNotes, setClosureNotes] = useState(item.closure_notes || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function save(finalize: boolean) {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const finalCompletedAt = finalize ? (completedAt || nowLocalInput()) : null
      await saveCorrectiveIntervention(item.id, {
        startedAt: new Date(startedAt).toISOString(),
        completedAt: finalCompletedAt ? new Date(finalCompletedAt).toISOString() : null,
        diagnosis,
        workPerformed,
        testResults,
        equipmentCondition: condition || null,
        technicalNotes,
      })
      setCompletedAt(finalCompletedAt || "")
      setMessage(finalize ? "Expediente enviado para validación del jefe." : "Borrador técnico guardado.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar la intervención.")
    } finally {
      setSaving(false)
    }
  }

  async function close() {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await validateCorrectiveClosure(item.id, closureNotes)
      setMessage("Orden y reporte cerrados de forma transaccional.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible validar el cierre.")
    } finally {
      setSaving(false)
    }
  }

  if (item.maintenance_code !== "MC")
    return <div className="corrective-workflow"><p>{t("Esta orden no corresponde a mantenimiento correctivo.")}</p></div>

  return (
    <section className="corrective-workflow">
      <div className="corrective-summary">
        <strong>{item.report_number ? `Reporte ${item.report_number}` : t("Sin reporte vinculado")}</strong>
        <span>{t("Estado del reporte:")}{" "}{item.report_status || "No disponible"}</span>
        <span>{t("Técnico asignado:")}{" "}{item.assigned_to_name || "No disponible"}</span>
        {item.equipment && <span>{t("Equipo:")}{" "}{item.equipment.inventory_code} · {item.equipment.equipment_type} · {item.equipment.manufacturer} {item.equipment.model} · {item.equipment.hospital_area || "Área sin registrar"}</span>}
        <span>{t("La evidencia documental depende de configurar Supabase Storage; no se simularán archivos.")}</span>
      </div>
      {role === "tecnico" && item.status === "programado" && <p>{t("Inicia la orden antes de registrar la intervención.")}</p>}
      {role === "tecnico" && item.status === "en_proceso" && (
        <div className="corrective-form">
          <label><span>{t("Inicio *")}</span><input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label>
          <label><span>{t("Finalización")}</span><input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></label>
          <label className="span-2"><span>{t("Diagnóstico *")}</span><textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
          <label className="span-2"><span>{t("Trabajo realizado *")}</span><textarea value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} /></label>
          <label className="span-2"><span>{t("Resultados de pruebas *")}</span><textarea value={testResults} onChange={(event) => setTestResults(event.target.value)} /></label>
          <label><span>{t("Condición final *")}</span><select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="">{t("Seleccionar")}</option><option value="operativo">{t("Operativo")}</option><option value="en_reparacion">{t("En reparación")}</option><option value="fuera_de_servicio">{t("Fuera de servicio")}</option></select></label>
          <label className="span-2"><span>{t("Observaciones técnicas")}</span><textarea value={technicalNotes} onChange={(event) => setTechnicalNotes(event.target.value)} /></label>
          <div className="corrective-actions"><button type="button" className="row-action" disabled={saving || !startedAt} onClick={() => save(false)}>{t("Guardar borrador")}</button><button type="button" className="row-action" disabled={saving || !startedAt} onClick={() => save(true)}>{t("Enviar para validación")}</button></div>
        </div>
      )}
      {record && role === "jefe" && (
        <div className="technical-record-summary">
          <strong>{t("Expediente técnico")}</strong>
          <span>{t("Inicio:")}{" "}{record.started_at ? formatDate(record.started_at) : t("Pendiente")}</span>
          <span>{t("Finalización:")}{" "}{record.completed_at ? formatDate(record.completed_at) : t("Pendiente")}</span>
          <p><b>{t("Diagnóstico:")}</b> {record.diagnosis || "Pendiente"}</p>
          <p><b>{t("Trabajo:")}</b> {record.work_performed || "Pendiente"}</p>
          <p><b>{t("Pruebas:")}</b> {record.test_results || "Pendiente"}</p>
          <p><b>{t("Condición:")}</b> {record.equipment_condition || "Pendiente"}</p>
        </div>
      )}
      {role === "jefe" && item.status === "en_proceso" && (
        <div className="closure-panel"><label><span>{t("Observaciones de validación")}</span><textarea value={closureNotes} onChange={(event) => setClosureNotes(event.target.value)} /></label><button type="button" className="row-action" disabled={saving || !record?.completed_at} onClick={close}>{t("Validar y cerrar")}</button>{!record?.completed_at && <small>{t("El técnico debe finalizar primero el expediente.")}</small>}</div>
      )}
      {item.validated_at && <p>{t("Validado el")}{" "}{formatDate(item.validated_at)}.</p>}
      {isOperationalCompletionEnabled && <AttachmentPanel maintenanceId={item.id} attachments={item.attachments || []} onChanged={onChanged} />}
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function PreventiveWorkflowPanel({ item, role, onChanged }: { item: MaintenanceSummary; role: Role; onChanged: () => void }) {
  const record = item.record
  const [startedAt, setStartedAt] = useState(toLocalInput(record?.started_at) || nowLocalInput())
  const [completedAt, setCompletedAt] = useState(toLocalInput(record?.completed_at))
  const [diagnosis, setDiagnosis] = useState(record?.diagnosis || "")
  const [workPerformed, setWorkPerformed] = useState(record?.work_performed || "")
  const [testResults, setTestResults] = useState(record?.test_results || "")
  const [condition, setCondition] = useState<"" | "operativo" | "en_reparacion" | "fuera_de_servicio">(record?.equipment_condition || "")
  const [technicalNotes, setTechnicalNotes] = useState(record?.technical_notes || "")
  const [activitiesText, setActivitiesText] = useState((item.activities || []).map((activity) => activity.activity).join("\n"))
  const [closureNotes, setClosureNotes] = useState(item.closure_notes || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  if (!isOperationalCompletionEnabled)
    return <div className="corrective-workflow"><p>{t("El flujo preventivo detallado requiere desplegar y habilitar la migración 16.")}</p></div>

  const activities = activitiesText.split(/\r?\n/).map((activity) => activity.trim()).filter(Boolean)

  async function save(finalize: boolean) {
    setSaving(true); setError(""); setMessage("")
    try {
      const finalCompletedAt = finalize ? (completedAt || nowLocalInput()) : null
      await savePreventiveIntervention(item.id, {
        startedAt: new Date(startedAt).toISOString(),
        completedAt: finalCompletedAt ? new Date(finalCompletedAt).toISOString() : null,
        diagnosis, workPerformed, testResults,
        equipmentCondition: condition || null,
        technicalNotes,
        activities: activities.map((activity) => ({ activity, completed: finalize, notes: "" })),
      })
      setCompletedAt(finalCompletedAt || "")
      setMessage(finalize ? "Mantenimiento enviado para validación." : "Borrador preventivo guardado.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar el mantenimiento preventivo.")
    } finally { setSaving(false) }
  }

  async function close() {
    setSaving(true); setError(""); setMessage("")
    try {
      await validatePreventiveClosure(item.id, closureNotes)
      setMessage("Mantenimiento preventivo validado y próxima fecha actualizada cuando existe periodicidad aprobada.")
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible validar el cierre preventivo.")
    } finally { setSaving(false) }
  }

  return (
    <section className="corrective-workflow">
      <div className="corrective-summary">
        <strong>{t("Rutina preventiva")}</strong>
        <span>{t("Técnico asignado:")}{" "}{item.assigned_to_name || "No disponible"}</span>
        {item.equipment && <span>{t("Equipo:")}{" "}{item.equipment.inventory_code} · {item.equipment.equipment_type} · {item.equipment.hospital_area}</span>}
      </div>
      {role === "tecnico" && item.status === "programado" && <p>{t("Inicia la orden antes de registrar la rutina.")}</p>}
      {role === "tecnico" && item.status === "en_proceso" && (
        <div className="corrective-form">
          <label><span>{t("Inicio *")}</span><input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label>
          <label><span>{t("Finalización")}</span><input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></label>
          <label className="span-2"><span>{t("Actividades ejecutadas, una por línea *")}</span><textarea value={activitiesText} onChange={(event) => setActivitiesText(event.target.value)} /></label>
          <label className="span-2"><span>{t("Hallazgos / diagnóstico *")}</span><textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
          <label className="span-2"><span>{t("Trabajo realizado *")}</span><textarea value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} /></label>
          <label className="span-2"><span>{t("Resultados de pruebas *")}</span><textarea value={testResults} onChange={(event) => setTestResults(event.target.value)} /></label>
          <label><span>{t("Condición final *")}</span><select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)}><option value="">{t("Seleccionar")}</option><option value="operativo">{t("Operativo")}</option><option value="en_reparacion">{t("En reparación")}</option><option value="fuera_de_servicio">{t("Fuera de servicio")}</option></select></label>
          <label className="span-2"><span>{t("Observaciones")}</span><textarea value={technicalNotes} onChange={(event) => setTechnicalNotes(event.target.value)} /></label>
          <div className="corrective-actions"><button type="button" className="row-action" disabled={saving || !startedAt} onClick={() => save(false)}>{t("Guardar borrador")}</button><button type="button" className="row-action" disabled={saving || !startedAt || activities.length === 0} onClick={() => save(true)}>{t("Enviar para validación")}</button></div>
        </div>
      )}
      {record && role === "jefe" && <div className="technical-record-summary"><strong>{t("Expediente preventivo")}</strong><span>{t("Inicio:")}{" "}{record.started_at ? formatDate(record.started_at) : t("Pendiente")}</span><span>{t("Finalización:")}{" "}{record.completed_at ? formatDate(record.completed_at) : t("Pendiente")}</span><p><b>{t("Hallazgos:")}</b> {record.diagnosis || "Pendiente"}</p><p><b>{t("Trabajo:")}</b> {record.work_performed || "Pendiente"}</p><p><b>{t("Pruebas:")}</b> {record.test_results || "Pendiente"}</p>{(item.activities || []).map((activity) => <p key={activity.id}><b>{t("Actividad:")}</b> {activity.activity} · {activity.completed ? t("completada") : t("pendiente")}</p>)}</div>}
      {role === "jefe" && item.status === "en_proceso" && <div className="closure-panel"><label><span>{t("Observaciones de validación")}</span><textarea value={closureNotes} onChange={(event) => setClosureNotes(event.target.value)} /></label><button type="button" className="row-action" disabled={saving || !record?.completed_at} onClick={close}>{t("Validar preventivo")}</button></div>}
      <AttachmentPanel maintenanceId={item.id} attachments={item.attachments || []} onChanged={onChanged} />
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function AttachmentPanel({ maintenanceId, attachments, onChanged }: { maintenanceId: number; attachments: FileAttachment[]; onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function upload() {
    if (!file) return
    setBusy(true); setError("")
    try {
      await uploadPrivateAttachment(file, { maintenanceId }, description)
      setFile(null); setDescription(""); onChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible subir el archivo.") }
    finally { setBusy(false) }
  }

  async function download(attachment: FileAttachment) {
    setError("")
    try { window.open(await createAttachmentDownloadUrl(attachment), "_blank", "noopener,noreferrer") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible abrir el archivo.") }
  }

  async function remove(attachment: FileAttachment) {
    if (!window.confirm(`¿Desactivar ${attachment.original_name}?`)) return
    setBusy(true); setError("")
    try { await deletePrivateAttachment(attachment.id); onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible eliminar la evidencia.") }
    finally { setBusy(false) }
  }

  return <div className="attachment-panel"><strong>{t("Evidencias privadas")}</strong><div className="attachment-upload"><FilePicker label={t("Archivo de evidencia")} file={file} onChange={setFile} disabled={busy} /><input aria-label={t("Descripción de evidencia")} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("Descripción")} /><button type="button" className="row-action" disabled={!file || busy} onClick={upload}><Save size={15} /> {busy ? t("Subiendo...") : t("Guardar archivo")}</button></div>{attachments.map((attachment) => <div className="attachment-row" key={attachment.id}><button type="button" className="attachment-link" onClick={() => download(attachment)}>{attachment.original_name} · {(attachment.size_bytes / 1024).toFixed(1)}{" "}{t("KB")}</button><button type="button" className="row-action" disabled={busy} onClick={() => remove(attachment)}>{t("Eliminar")}</button></div>)}{error && <small className="form-error" role="alert">{error}</small>}</div>
}
