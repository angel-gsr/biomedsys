import { useEffect, useState } from "react"
import { listReports, type ReportSummary, type Role } from "../lib/supabase"
import { listTechnovigilanceHolidays, saveTechnovigilanceHoliday, removeTechnovigilanceHoliday } from "../lib/reportManagement"
import { getMovementLocations, getReportEquipmentIdentity, listTechnovigilanceReviews, moveTechnovigilanceEquipment, saveTechnovigilanceReview, type TechnovigilanceReview } from "../lib/reportManagement"
import { PageIntro, Button } from "./ui"
import { ReportPreview } from "./ReportPreview"

export function TechnovigilanceView({ role }: { role: Role }) {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [reviews, setReviews] = useState<TechnovigilanceReview[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  function load() {
    return Promise.all([listReports(), listTechnovigilanceReviews()]).then(([rows, cases]) => { setReports(rows); setReviews(cases); setError("") }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No fue posible sincronizar los incidentes.")).finally(() => setLoading(false))
  }
  useEffect(() => {
    let active = true
    const refresh = () => { if (active) void load() }
    refresh(); const timer = setInterval(refresh, 15000)
    window.addEventListener("focus", refresh); window.addEventListener("biomedgest:reports-changed", refresh)
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("biomedgest:reports-changed", refresh) }
  }, [])
  const report = reports.find((row) => row.id === selected)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date())
  const filtered = reports.filter((row) => [row.report_number, row.equipment_identifier, row.description, row.service].join(" ").toLocaleLowerCase("es-MX").includes(search.toLocaleLowerCase("es-MX")))
  return <>
    <PageIntro title="Tecnovigilancia" description="Bandeja biomédica de incidentes, ubicación actual del equipo y seguimiento documental." action={<Button variant="secondary" onClick={() => void load()}>Sincronizar</Button>} />
    <section className="panel tv-guidance"><p><strong>Acta interna:</strong> meta de 10 días para catastrófico/alto, 15 para medio y 30 para bajo, desde el registro del reporte.</p><p><strong>Notificación NOM-240-SSA1-2012, 12.3:</strong> amenaza grave de salud pública: 2 días hábiles; muerte o deterioro grave: 10 días naturales; otros incidentes notificables: 30 días naturales, desde su confirmación. Son plazos distintos de la meta interna.</p><p>Para días hábiles se excluyen fines de semana y las fechas del calendario institucional. Valida los días inhábiles oficiales con el responsable de tecnovigilancia. Guardar aquí no envía una notificación a COFEPRIS.</p><a href="https://sidof.segob.gob.mx/notas/docFuente/5275834" target="_blank" rel="noreferrer">Consultar norma oficial</a></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {role === "jefe" && <HolidayCalendar onChanged={() => void load()} />}
    <section className="panel"><div className="filter-bar"><label className="search-box"><input aria-label="Buscar incidente de tecnovigilancia" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Folio, equipo, incidente o área..." /></label></div>
      {loading ? <p role="status">Cargando incidentes...</p> : filtered.length === 0 ? <div className="empty-state"><h3>No hay incidentes para mostrar</h3></div> : <div className="table-wrap"><table><thead><tr><th>Folio / equipo</th><th>Incidente</th><th>Acta interna</th><th>Notificación NOM-240</th><th>Acciones</th></tr></thead><tbody>{filtered.map((row) => {
        const review = reviews.find((item) => item.report_id === row.id)
        const internalLate = review && !review.legal_record_completed_on && review.internal_due_on < today
        const regulatoryLate = review?.regulatory_due_on && !review.notified_on && review.regulatory_due_on < today
        return <tr key={row.id}><td><strong>{row.report_number}</strong><small>{row.equipment_identifier} · {row.service}</small></td><td>{row.event_type}<small>{row.description}</small></td><td><span className={internalLate ? "badge badge-danger" : "badge badge-neutral"}>{review?.legal_record_completed_on ? "Acta registrada" : review ? `${internalLate ? "Vencida · " : ""}${review.internal_due_on}` : "Sin clasificar"}</span></td><td><span className={regulatoryLate ? "badge badge-danger" : "badge badge-neutral"}>{review?.notified_on ? "Notificación registrada" : review?.regulatory_due_on ? `${regulatoryLate ? "Vencida · " : ""}${review.regulatory_due_on}` : "Pendiente / no aplica"}</span></td><td><button className="row-action" onClick={() => setSelected(row.id)}>Gestionar</button><button className="row-action" onClick={() => setPreview(row.id)}>Ver reporte / PDF</button></td></tr>
      })}</tbody></table></div>}
    </section>
    {report && <ReviewEditor key={report.id} report={report} existing={reviews.find((item) => item.report_id === report.id)} onSaved={() => void load()} />}
    {preview !== null && <ReportPreview reportId={preview} onClose={() => setPreview(null)} onChanged={() => void load()} />}
  </>
}

function HolidayCalendar({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<{ holiday: string; description: string }[]>([])
  const [day, setDay] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function load() { try { setRows(await listTechnovigilanceHolidays()) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible consultar el calendario.") } }
  useEffect(() => { void load() }, [])
  return <details className="panel tv-guidance"><summary>Calendario de días inhábiles para notificación · {rows.length} fechas registradas</summary><p>Registra las fechas oficiales que correspondan. Los cambios recalculan los plazos de amenaza grave de salud pública y quedan auditados.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <form onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(""); try { await saveTechnovigilanceHoliday(day, description); await load(); onChanged(); setDay(""); setDescription("") } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar.") } finally { setBusy(false) } }}>
      <fieldset className="report-edit-fields" disabled={busy}><label className="field"><span>Día inhábil oficial</span><input required type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label><label className="field"><span>Descripción / fundamento</span><input required value={description} onChange={(e) => setDescription(e.target.value)} /></label><Button type="submit">Guardar día inhábil</Button></fieldset>
    </form>{rows.map((row) => <p key={row.holiday}>{row.holiday} · {row.description} <button disabled={busy} type="button" className="row-action" onClick={async () => { setBusy(true); setError(""); try { await removeTechnovigilanceHoliday(row.holiday); await load(); onChanged() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible eliminar.") } finally { setBusy(false) } }}>Quitar fecha</button></p>)}
  </details>
}

function ReviewEditor({ report, existing, onSaved }: { report: ReportSummary; existing?: TechnovigilanceReview; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<TechnovigilanceReview>>(existing || { failure_type: report.event_type, regulatory_case: "pendiente" })
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getMovementLocations>> | null>(null)
  const [area, setArea] = useState("")
  const [location, setLocation] = useState("")
  const [reason, setReason] = useState("")
  const [currentLocation, setCurrentLocation] = useState("")
  const [movementError, setMovementError] = useState("")
  useEffect(() => {
    let active = true
    if (report.equipment_id) Promise.all([getMovementLocations(), getReportEquipmentIdentity(report.equipment_id)]).then(([rows, identity]) => { if (active) { setCatalog(rows); setCurrentLocation([identity.hospital_area, identity.location].filter(Boolean).join(" · ")) } }).catch((cause: unknown) => { if (active) setMovementError(cause instanceof Error ? cause.message : "No fue posible consultar la ubicación.") })
    return () => { active = false }
  }, [report.equipment_id])
  function update(key: keyof TechnovigilanceReview, value: string) { setForm((old) => ({ ...old, [key]: value })) }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("")
    try { await saveTechnovigilanceReview(report.id, form); setMessage("Seguimiento guardado y auditado."); onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar.") }
    finally { setBusy(false) }
  }
  return <section className="panel tv-editor"><div className="panel-head"><div><h3>Gestión de {report.report_number}</h3><p>Las observaciones técnicas no modifican el incidente original.</p></div></div>
    <form className="training-form" onSubmit={save}><fieldset disabled={busy} className="report-edit-fields"><div className="form-grid">
      <label className="field"><span>Riesgo para meta interna</span><select required value={form.internal_risk || ""} onChange={(e) => update("internal_risk", e.target.value)}><option value="" disabled>Clasifica el incidente</option><option value="catastrofico">Catastrófico · 10 días</option><option value="alto">Alto · 10 días</option><option value="medio">Medio · 15 días</option><option value="bajo">Bajo · 30 días</option></select></label>
      <label className="field"><span>Tipo de falla / incidente</span><input required value={form.failure_type || ""} onChange={(e) => update("failure_type", e.target.value)} /></label>
      <label className="field"><span>Supuesto de notificación NOM-240</span><select value={form.regulatory_case} onChange={(e) => update("regulatory_case", e.target.value)}><option value="pendiente">Pendiente de evaluación</option><option value="amenaza_publica">Amenaza grave de salud pública · 2 días hábiles</option><option value="muerte_deterioro_grave">Muerte / deterioro grave · 10 días naturales</option><option value="otro_notificable">Otro incidente notificable · 30 días naturales</option><option value="no_notificable">No notificable, justificar en notas</option></select></label>
      <label className="field"><span>Fecha de confirmación</span><input type="date" required={!['pendiente', 'no_notificable'].includes(form.regulatory_case || 'pendiente')} value={form.confirmed_on || ""} onChange={(e) => update("confirmed_on", e.target.value)} /></label>
      <label className="field"><span>Referencia / folio del acta interna</span><input value={form.legal_record_reference || ""} onChange={(e) => update("legal_record_reference", e.target.value)} /></label>
      <label className="field"><span>Acta completada el</span><input type="date" value={form.legal_record_completed_on || ""} onChange={(e) => update("legal_record_completed_on", e.target.value)} /></label>
      <label className="field"><span>Acuse / referencia de notificación</span><input value={form.notification_reference || ""} onChange={(e) => update("notification_reference", e.target.value)} /></label>
      <label className="field"><span>Notificado el</span><input type="date" value={form.notified_on || ""} onChange={(e) => update("notified_on", e.target.value)} /></label>
      <label className="field span-2"><span>Notas y justificación</span><textarea required={form.regulatory_case === "no_notificable"} value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} /></label>
    </div><Button type="submit">{busy ? "Guardando..." : "Guardar seguimiento"}</Button></fieldset></form>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {report.equipment_id && <form className="training-form" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMovementError("")
      try { await moveTechnovigilanceEquipment(report.equipment_id!, Number(area), location ? Number(location) : null, reason); const identity = await getReportEquipmentIdentity(report.equipment_id!); setCurrentLocation([identity.hospital_area, identity.location].filter(Boolean).join(" · ")); setReason(""); setMessage("Ubicación del inventario actualizada. El reporte conserva la ubicación registrada originalmente."); window.dispatchEvent(new Event("biomedgest:inventory-changed")) }
      catch (cause) { setMovementError(cause instanceof Error ? cause.message : "No fue posible mover el equipo.") }
      finally { setBusy(false) }
    }}><h3>Ubicación actual del equipo</h3><p>{currentLocation || "Consultando ubicación..."}</p>{movementError && <p className="form-error" role="alert">{movementError}</p>}{catalog && <fieldset disabled={busy} className="report-edit-fields"><div className="form-grid"><label className="field"><span>Área de destino</span><select required value={area} onChange={(e) => { setArea(e.target.value); setLocation("") }}><option value="">Selecciona un área</option>{catalog.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Ubicación de destino</span><select value={location} onChange={(e) => setLocation(e.target.value)}><option value="">Sin ubicación específica</option>{catalog.locations.filter((item) => item.hospital_area_id === Number(area)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field span-2"><span>Motivo del traslado</span><input required value={reason} onChange={(e) => setReason(e.target.value)} /></label></div><Button type="submit">Actualizar ubicación</Button></fieldset>}</form>}
  </section>
}
