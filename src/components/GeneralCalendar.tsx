import { t } from "../lib/i18n"
import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
import { type Role } from "../lib/supabase"
import { calendarKindLabels, calendarEventsOverlap, cancelGeneralCalendarEvent, eventOnDay, generalCalendarOptions, listGeneralCalendar, localDateKey, saveGeneralCalendarEvent, type CalendarEvent, type CalendarKind, type CalendarOptions } from "../lib/generalCalendar"
import { Button, PageIntro } from "./ui"

const kinds = Object.keys(calendarKindLabels) as CalendarKind[]
const dateTime = (value: string) => new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
function localInput(value: string) { const date = new Date(value); return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` }

export function GeneralCalendar({ role, onMaintenance }: { role: Role; onMaintenance: () => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [day, setDay] = useState(() => localDateKey(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [options, setOptions] = useState<CalendarOptions | null>(null)
  const [kind, setKind] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [editor, setEditor] = useState<CalendarEvent | "new" | null>(null)
  const range = useMemo(() => {
    const start = new Date(month); start.setDate(1 - (start.getDay() + 6) % 7)
    const end = new Date(start); end.setDate(end.getDate() + 42)
    return { start, end, days: Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date }) }
  }, [month])
  useEffect(() => {
    let active = true
    setLoading(true); setError("")
    Promise.all([listGeneralCalendar(range.start.toISOString(), range.end.toISOString()), generalCalendarOptions()]).then(([items, catalogs]) => { if (active) { setEvents(items); setOptions(catalogs) } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No fue posible cargar el calendario.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range, reload])
  useEffect(() => { const refresh = () => setReload((v) => v + 1); window.addEventListener("focus", refresh); const timer = setInterval(refresh, 60000); return () => { clearInterval(timer); window.removeEventListener("focus", refresh) } }, [])
  const visible = events.filter((event) => !kind || event.kind === kind)
  const agenda = visible.filter((event) => eventOnDay(event, day))
  const incomplete = events.filter((event) => event.blocks_resources && !event.ends_at)
  function changeMonth(delta: number) { const next = new Date(month.getFullYear(), month.getMonth() + delta, 1); setMonth(next); setDay(localDateKey(next)) }
  return <>
    <PageIntro title={t("Calendario general")} description={t("Cirugías, mantenimiento, capacitaciones y reservas de equipo en una sola agenda.")} action={role === "jefe" ? <Button icon={Plus} onClick={() => setEditor("new")}>{"Programar evento"}</Button> : undefined} />
    <div className="calendar-legend">{kinds.map((value) => <span key={value} className={`calendar-type type-${value}`}>{calendarKindLabels[value]}</span>)}</div>
    <p className="calendar-help">{t("Horario local del dispositivo:")}{" "}{Intl.DateTimeFormat().resolvedOptions().timeZone}{t(". La disponibilidad se valida por sala y equipo. No registres nombres ni datos de pacientes.")}</p>
    {error && <section className="panel empty-state"><p className="form-error" role="alert">{error}</p><Button onClick={() => setReload((v) => v + 1)}>{t("Reintentar")}</Button></section>}
    {incomplete.length > 0 && <details className="panel calendar-incomplete"><summary>{incomplete.length}{" "}{t("eventos sin hora de fin: disponibilidad pendiente de confirmar")}</summary><p>{t("Un evento activo sin fin mantiene ocupado su equipo o sala hasta que el jefe complete el horario.")}</p>{incomplete.map((event) => <div className="table-actions" key={event.event_key}><span>{event.title} · {dateTime(event.starts_at)}</span><button type="button" className="row-action" onClick={() => setEditor(event)}>{role === "jefe" ? t("Completar horario") : t("Ver evento")}</button></div>)}</details>}
    <section className="panel general-calendar" aria-busy={loading}>
      <div className="general-calendar-toolbar"><div className="table-actions"><button type="button" className="icon-btn" aria-label={t("Mes anterior")} onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button><h3>{month.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</h3><button type="button" className="icon-btn" aria-label={t("Mes siguiente")} onClick={() => changeMonth(1)}><ChevronRight size={20} /></button></div><label className="inventory-select"><span>{t("Mostrar")}</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">{t("Todos los eventos")}</option>{kinds.map((value) => <option key={value} value={value}>{calendarKindLabels[value]}</option>)}</select></label></div>
      {loading && <p className="calendar-help" role="status">{t("Actualizando agenda...")}</p>}
      <div className="general-calendar-grid" aria-label={t("Fechas del calendario")}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => <span className="calendar-weekday" key={label}>{label}</span>)}
        {range.days.map((date) => { const key = localDateKey(date); const dayEvents = visible.filter((event) => eventOnDay(event, key)); return <button type="button" key={key} className={`calendar-day ${date.getMonth() !== month.getMonth() ? "outside" : ""} ${key === day ? "selected" : ""}`} aria-pressed={key === day} aria-label={`${date.toLocaleDateString("es-MX", { dateStyle: "full" })}: ${dayEvents.length} eventos`} onClick={() => setDay(key)}><strong>{date.getDate()}</strong><span className="calendar-day-types">{kinds.filter((value) => dayEvents.some((event) => event.kind === value)).map((value) => <span key={value} className={`calendar-dot type-${value}`} title={calendarKindLabels[value]} />)}</span>{dayEvents.length > 0 && <small>{dayEvents.length}<span className="calendar-event-word">{" "}{t("eventos")}</span></small>}</button> })}
      </div>
    </section>
    <section className="panel calendar-agenda"><div className="panel-head"><div><h3>{t("Agenda del")}{" "}{new Date(`${day}T12:00:00`).toLocaleDateString("es-MX", { dateStyle: "long" })}</h3><p>{agenda.length}{" "}{t("eventos registrados")}</p></div><CalendarDays size={22} /></div>
      {!agenda.length ? <div className="empty-state"><h3>{t("No hay eventos para este día")}</h3><p>{t("La ocupación de los eventos sin hora de fin sigue pendiente de confirmar.")}</p></div> : agenda.map((event) => <article className="calendar-agenda-event" key={event.event_key}><div><span className={`calendar-type type-${event.kind}`}>{calendarKindLabels[event.kind]}</span><h4>{event.title}</h4><p>{dateTime(event.starts_at)} → {event.ends_at ? dateTime(event.ends_at) : t("Fin pendiente")}</p><p>{event.location_name || "Sin sala registrada"} · {event.status}</p>{event.equipment_ids.length > 0 && <small>{event.equipment_ids.map((id) => options?.equipment.find((item) => item.id === id)?.name || id).join(" · ")}</small>}</div><button type="button" className="row-action" onClick={() => setEditor(event)}>{role === "jefe" && event.blocks_resources ? t("Ver / gestionar") : t("Ver evento")}</button></article>)}
    </section>
    <div className="table-actions"><Button variant="secondary" onClick={onMaintenance}>{t("Ver órdenes de mantenimiento")}</Button></div>
    {editor && options && <CalendarEditor role={role} event={editor === "new" ? null : editor} day={day} options={options} events={events} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setReload((v) => v + 1) }} />}
  </>
}

function CalendarEditor({ role, event, day, options, events, onClose, onSaved }: { role: Role; event: CalendarEvent | null; day: string; options: CalendarOptions; events: CalendarEvent[]; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<CalendarKind>(event?.kind || "cirugia")
  const [title, setTitle] = useState(event?.title || "")
  const [start, setStart] = useState(event ? localInput(event.starts_at) : `${day}T08:00`)
  const [end, setEnd] = useState(event?.ends_at ? localInput(event.ends_at) : "")
  const [location, setLocation] = useState(event?.location_id ? String(event.location_id) : "")
  const [equipment, setEquipment] = useState<string[]>(event?.equipment_ids || [])
  const [program, setProgram] = useState("")
  const [assignee, setAssignee] = useState("")
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const editable = role === "jefe" && (!event || event.blocks_resources)
  const sourceEquipmentLocked = Boolean(event && ["mantenimiento", "capacitacion"].includes(kind))
  const conflicts = start && end && Number.isFinite(Date.parse(start)) && Number.isFinite(Date.parse(end)) ? events.filter((item) => item.event_key !== event?.event_key && calendarEventsOverlap({ starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), location_id: location ? Number(location) : null, equipment_ids: equipment }, item)) : []
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("")
    try { await saveGeneralCalendarEvent({ key: event?.event_key || null, kind, title, start: new Date(start).toISOString(), end: new Date(end).toISOString(), locationId: location ? Number(location) : null, equipmentIds: equipment, programId: program ? Number(program) : null, assigneeId: assignee || null }); onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar el evento.") }
    finally { setBusy(false) }
  }
  return <div className="modal-layer"><section className="modal calendar-editor" role="dialog" aria-modal="true" aria-label={event ? t("Detalle del evento") : t("Programar evento")} onKeyDown={(e) => { if (e.key === "Escape") onClose() }}><div className="modal-head"><h2>{event ? t("Detalle del evento") : t("Programar evento")}</h2><button type="button" className="icon-btn" aria-label={t("Cerrar evento")} onClick={onClose}><X size={22} /></button></div>
    <form onSubmit={save}><fieldset disabled={!editable || busy} className="report-edit-fields"><div className="form-grid">
      <label className="field"><span>{t("Tipo de evento")}</span><select disabled={Boolean(event)} value={kind} onChange={(e) => { setKind(e.target.value as CalendarKind); setEquipment([]); setProgram("") }}>{kinds.map((value) => <option value={value} key={value}>{calendarKindLabels[value]}</option>)}</select></label>
      <label className="field"><span>{t("Título (sin datos de pacientes)")}</span><input required={kind !== "mantenimiento"} readOnly={Boolean(event && ["mantenimiento", "capacitacion"].includes(kind)) || kind === "mantenimiento"} placeholder={kind === "mantenimiento" ? t("Se genera con la orden preventiva") : t("Ej. Cirugía programada")} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>{t("Inicio")}</span><input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="field"><span>{t("Fin")}</span><input required type="datetime-local" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      <label className="field span-2"><span>{t("Sala / ubicación ocupada")}</span><select required={kind === "cirugia"} value={location} onChange={(e) => setLocation(e.target.value)}><option value="">{t("Sin sala específica")}</option>{options.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {["mantenimiento", "capacitacion"].includes(kind) ? <label className="field span-2"><span>{t("Equipo")}</span><select required={kind === "mantenimiento"} disabled={sourceEquipmentLocked} value={equipment[0] || ""} onChange={(e) => { setEquipment(e.target.value ? [e.target.value] : []); setProgram("") }}><option value="">{t("Sin equipo específico")}</option>{options.equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <div className="field span-2"><span>{t("Equipos reservados")}</span><input aria-label={t("Buscar equipo para reservar")} placeholder={t("Buscar por código o nombre")} value={search} onChange={(e) => setSearch(e.target.value)} /><div className="calendar-equipment-options">{options.equipment.filter((item) => item.name.toLocaleLowerCase("es-MX").includes(search.toLocaleLowerCase("es-MX"))).map((item) => <label key={item.id}><input type="checkbox" checked={equipment.includes(item.id)} onChange={(e) => setEquipment(e.target.checked ? [...equipment, item.id] : equipment.filter((id) => id !== item.id))} />{item.name}</label>)}</div>{kind === "uso_equipo" && !equipment.length && <small>{t("Selecciona al menos un equipo.")}</small>}</div>}
      {!event && kind === "mantenimiento" && <label className="field"><span>{t("Rutina preventiva")}</span><select required value={program} onChange={(e) => setProgram(e.target.value)}><option value="">{t("Selecciona una rutina vinculada")}</option>{options.programs.filter((item) => item.equipment_id === equipment[0]).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      {!event && ["mantenimiento", "capacitacion"].includes(kind) && <label className="field"><span>{kind === "capacitacion" ? t("Instructor") : t("Técnico asignado")}</span><select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">{kind === "capacitacion" ? t("Jefe que registra") : t("Sin asignar")}</option>{options.technicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </div></fieldset>
    {conflicts.length > 0 && <div className="calendar-conflicts" role="alert"><strong>{t("Coincidencias de sala o equipo:")}</strong>{conflicts.map((item) => <p key={item.event_key}>{item.title} · {dateTime(item.starts_at)}{!item.ends_at && " · Falta hora de fin"}</p>)}<p>{t("Elige otro horario o recurso. El servidor vuelve a validar al guardar.")}</p></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="table-actions"><Button variant="secondary" onClick={onClose}>{t("Cerrar")}</Button>{editable && <button type="submit" disabled={busy} className="btn btn-primary">{busy ? t("Guardando...") : t("Guardar evento")}</button>}{editable && event && <button type="button" disabled={busy} className="btn btn-danger" onClick={async () => { if (!window.confirm("¿Cancelar este evento y liberar sus recursos?")) return; setBusy(true); setError(""); try { await cancelGeneralCalendarEvent(event.event_key); onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cancelar.") } finally { setBusy(false) } }}>{t("Cancelar evento")}</button>}</div>
    </form>
  </section></div>
}
