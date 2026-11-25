import { LoanVoucher } from "./LoanVoucher"
import { useOperationalRefresh } from "../lib/useOperationalRefresh"
import { t } from "../lib/i18n"
import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
import { type Role } from "../lib/supabase"
import { calendarKindLabels, cancelOrganizedEvent, cancelEquipmentUse, eventOnDay, generalCalendarOptions, listGeneralCalendar, localDateKey, saveOrganizedEvent, type CalendarEvent, type CalendarKind, type CalendarOptions } from "../lib/generalCalendar"
import { Button, PageIntro } from "./ui"

const kinds = Object.keys(calendarKindLabels) as CalendarKind[]
const dateTime = (value: string) => new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
function localInput(value: string) { const date = new Date(value); return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` }

export function GeneralCalendar({ role, onMaintenance }: { role: Role; onMaintenance?: (id: number) => void }) {
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
  useOperationalRefresh(()=>setReload(value=>value+1),["maintenances","trainings","calendar_bookings"])
  useEffect(()=>{if(loading || !editor || editor === "new")return;const current=events.find(item=>item.event_key===editor.event_key);if(!current || ["cancelado","cancelada"].includes(current.status))setEditor(null);else if(JSON.stringify(current)!==JSON.stringify(editor))setEditor(current)},[events,loading])
  const visible = events.filter((event) => !["cancelado","cancelada"].includes(event.status) && (!kind || event.kind === kind))
  const agenda = visible.filter((event) => eventOnDay(event, day))
  const incomplete = visible.filter((event) => event.blocks_resources && !event.ends_at)
  function changeMonth(delta: number) { const next = new Date(month.getFullYear(), month.getMonth() + delta, 1); setMonth(next); setDay(localDateKey(next)) }
  return <>
    <PageIntro title={t("Calendario general")} description={t("Mantenimientos, capacitaciones y eventos dirigidos a tu perfil en una sola agenda.")} action={role === "jefe" ? <Button icon={Plus} onClick={() => setEditor("new")}>{t("Organizar evento")}</Button> : undefined} />
    <div className="calendar-legend" role="group" aria-label={t("Filtrar por tipo de evento")}><button type="button" className="calendar-type calendar-all" aria-pressed={!kind} onClick={()=>setKind("")}>{t("Todos los eventos")}</button>{kinds.map((value) => <button type="button" key={value} className={`calendar-type type-${value}`} aria-pressed={kind===value} onClick={()=>setKind(current=>current===value?"":value)}>{t(calendarKindLabels[value])}</button>)}</div>
    <p className="calendar-help">{t("Horario local del dispositivo:")}{" "}{Intl.DateTimeFormat().resolvedOptions().timeZone}{t(". La disponibilidad se valida por sala y equipo. No registres nombres ni datos de pacientes.")}</p>
    {error && <section className="panel empty-state"><p className="form-error" role="alert">{error}</p><Button onClick={() => setReload((v) => v + 1)}>{t("Reintentar")}</Button></section>}
    {incomplete.length > 0 && <details className="panel calendar-incomplete"><summary>{incomplete.length}{" "}{t("eventos sin hora de fin: disponibilidad pendiente de confirmar")}</summary><p>{t("Un evento activo sin fin mantiene ocupado su equipo o sala hasta que el jefe complete el horario.")}</p>{incomplete.map((event) => <div className="table-actions" key={event.event_key}><span>{event.title} · {dateTime(event.starts_at)}</span><button type="button" className="row-action" onClick={() => setEditor(event)}>{t("Ver evento")}</button></div>)}</details>}
    <section className="panel general-calendar" aria-busy={loading}>
      <div className="general-calendar-toolbar"><div className="table-actions"><button type="button" className="icon-btn" aria-label={t("Mes anterior")} onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button><h3>{month.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</h3><button type="button" className="icon-btn" aria-label={t("Mes siguiente")} onClick={() => changeMonth(1)}><ChevronRight size={20} /></button></div><label className="inventory-select"><span>{t("Filtrar por tipo de evento")}</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">{t("Todos los eventos")}</option>{kinds.map((value) => <option key={value} value={value}>{t(calendarKindLabels[value])}</option>)}</select></label></div>
      {loading && <p className="calendar-help" role="status">{t("Actualizando agenda...")}</p>}
      <div className="general-calendar-grid" aria-label={t("Fechas del calendario")}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => <span className="calendar-weekday" key={label}>{label}</span>)}
        {range.days.map((date) => { const key = localDateKey(date); const dayEvents = visible.filter((event) => eventOnDay(event, key)); return <button type="button" key={key} className={`calendar-day ${date.getMonth() !== month.getMonth() ? "outside" : ""} ${key === day ? "selected" : ""}`} aria-pressed={key === day} aria-label={`${date.toLocaleDateString("es-MX", { dateStyle: "full" })}: ${dayEvents.length} eventos`} onClick={() => setDay(key)}><strong>{date.getDate()}</strong><span className="calendar-day-types">{kinds.filter((value) => dayEvents.some((event) => event.kind === value)).map((value) => <span key={value} className={`calendar-dot type-${value}`} title={calendarKindLabels[value]} />)}</span>{dayEvents.length > 0 && <small>{dayEvents.length}<span className="calendar-event-word">{" "}{t("eventos")}</span></small>}</button> })}
      </div>
    </section>
    <section className="panel calendar-agenda"><div className="panel-head"><div><h3>{t("Agenda del")}{" "}{new Date(`${day}T12:00:00`).toLocaleDateString("es-MX", { dateStyle: "long" })}</h3><p>{agenda.length}{" "}{t("eventos registrados")}</p></div><CalendarDays size={22} /></div>
      {!agenda.length ? <div className="empty-state"><h3>{t("No hay eventos para este día")}</h3><p>{t("La ocupación de los eventos sin hora de fin sigue pendiente de confirmar.")}</p></div> : agenda.map((event) => <article className="calendar-agenda-event" key={event.event_key}><div><span className={`calendar-type type-${event.kind}`}>{calendarKindLabels[event.kind]}</span><h4>{event.title}</h4><p>{dateTime(event.starts_at)} → {event.ends_at ? dateTime(event.ends_at) : t(["completado","completada"].includes(event.status)?"Concluido":!event.responsible_name && event.kind==="mantenimiento"?"Pendiente de asignación":"Fin pendiente")}</p><p>{event.location_name || "Sin sala registrada"} · {t(({programado:"Programado",programada:"Programada",en_proceso:"En proceso",en_curso:"En curso",completado:"Completado",completada:"Completada"} as Record<string,string>)[event.status] || event.status)}</p>{event.responsible_name && <p>{t("Responsable:")} {event.responsible_name}</p>}{event.equipment_ids.length > 0 && <small>{event.equipment_ids.map((id) => options?.equipment.find((item) => item.id === id)?.name || id).join(" · ")}</small>}</div><button type="button" className="row-action" onClick={() => setEditor(event)}>{role === "jefe" && event.blocks_resources ? t("Ver / gestionar") : t("Ver evento")}</button></article>)}
    </section>
    {editor && options && <CalendarEditor key={editor === "new" ? "new" : `${editor.event_key}-${editor.starts_at}-${editor.ends_at}-${editor.status}`} onMaintenance={onMaintenance} role={role} event={editor === "new" ? null : editor} day={day} options={options} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setReload((v) => v + 1) }} />}
  </>
}

function CalendarEditor({ role, event, day, options, onClose, onSaved, onMaintenance }: { role: Role; event: CalendarEvent | null; day: string; options: CalendarOptions; onClose: () => void; onSaved: () => void; onMaintenance?: (id: number) => void }) {
  const [title,setTitle]=useState(event?.title || "")
  const [description,setDescription]=useState(event?.description || "")
  const [location,setLocation]=useState(event?.location_name || "")
  const [start,setStart]=useState(event ? localInput(event.starts_at) : `${day}T08:00`)
  const [end,setEnd]=useState(event?.ends_at ? localInput(event.ends_at) : "")
  const [audience,setAudience]=useState<Role[]>(event?.audience || ["usuario"])
  const [error,setError]=useState("")
  const [busy,setBusy]=useState(false)
  const [showVoucher,setShowVoucher]=useState(false)
  const editable=role==="jefe" && (!event || event.kind==="evento")
  async function save(e: React.FormEvent) {
    e.preventDefault(); if(busy)return;setBusy(true);setError("")
    try {await saveOrganizedEvent({id:event ? Number(event.event_key.split(":")[1]):null,title,description,location,start:new Date(start).toISOString(),end:new Date(end).toISOString(),audience});onSaved()}
    catch(cause){setError(cause instanceof Error?cause.message:"No fue posible guardar el evento.")}finally{setBusy(false)}
  }
  return <div className="modal-layer"><section className="modal calendar-editor" role="dialog" aria-modal="true" aria-label={t(editable?"Organizar evento":"Detalle del evento")}><div className="modal-head"><h2>{t(editable?"Organizar evento":"Detalle del evento")}</h2><button type="button" className="icon-btn" aria-label={t("Cerrar evento")} onClick={onClose}><X size={22}/></button></div>
    {editable ? <form onSubmit={save}><fieldset disabled={busy} className="report-edit-fields"><div className="form-grid">
      <label className="field span-2"><span>{t("Título (sin datos de pacientes)")}</span><input required minLength={3} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label className="field"><span>{t("Inicio")}</span><input required type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="field"><span>{t("Fin")}</span><input required type="datetime-local" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <label className="field span-2"><span>{t("Ubicación")}</span><input maxLength={160} value={location} onChange={e=>setLocation(e.target.value)}/></label><label className="field span-2"><span>{t("Descripción")}</span><textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <fieldset className="field span-2 calendar-audience"><legend>{t("Dirigido a")}</legend><div className="table-actions">{(["jefe","tecnico","usuario"] as Role[]).map(value=><label key={value}><input type="checkbox" checked={audience.includes(value)} onChange={e=>setAudience(e.target.checked?[...audience,value]:audience.filter(item=>item!==value))}/> {t(({jefe:"Jefes",tecnico:"Ingenieros biomédicos",usuario:"Usuarios"})[value])}</label>)}</div><small>{t("El jefe organizador también puede consultar el evento.")}</small></fieldset>
    </div></fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="table-actions"><Button variant="secondary" onClick={onClose}>{t("Cerrar")}</Button><Button type="submit" disabled={busy || !audience.length}>{t("Guardar evento")}</Button>{event && <Button variant="secondary" disabled={busy} onClick={async()=>{if(!window.confirm("¿Cancelar este evento?"))return;setBusy(true);try{await cancelOrganizedEvent(Number(event.event_key.split(":")[1]));onSaved()}catch(cause){setError(cause instanceof Error?cause.message:"No fue posible cancelar.")}finally{setBusy(false)}}}>{t("Cancelar evento")}</Button>}</div></form>
    : event && (showVoucher ? <LoanVoucher bookingId={Number(event.event_key.split(":")[1])} onClose={()=>setShowVoucher(false)}/> : <div className="event-details"><h3>{event.title}</h3><p>{dateTime(event.starts_at)} → {event.ends_at?dateTime(event.ends_at):t("Fin pendiente")}</p><p>{event.location_name || t("Sin sala registrada")}</p><p>{t("Responsable:")} {event.responsible_name || t("Sin asignar")}</p><p>{event.description}</p>{event.equipment_ids.map(id=><p key={id}>{options.equipment.find(item=>item.id===id)?.name || id}</p>)}{error && <p role="alert" className="form-error">{error}</p>}<div className="table-actions"><Button onClick={onClose}>{t("Cerrar")}</Button>{event.kind==="uso_equipo" && event.can_view_loan && <Button variant="secondary" onClick={()=>setShowVoucher(true)}>{t("Ver vale / PDF")}</Button>}{event.kind==="uso_equipo" && event.can_cancel && <Button variant="secondary" disabled={busy} onClick={async()=>{if(!window.confirm(t("¿Cancelar esta solicitud y liberar el equipo?")))return;setBusy(true);setError("");try{await cancelEquipmentUse(Number(event.event_key.split(":")[1]));window.dispatchEvent(new Event("biomedgest:operations-changed"));onSaved()}catch(cause){setError(cause && typeof cause==="object" && "message" in cause?String(cause.message):t("No fue posible cancelar la solicitud."))}finally{setBusy(false)}}}>{t("Cancelar solicitud")}</Button>}{event.kind==="mantenimiento" && role!=="usuario" && onMaintenance && <Button variant="secondary" onClick={()=>onMaintenance(Number(event.event_key.split(":")[1]))}>{t("Ver orden")}</Button>}</div></div>)}
  </section></div>
}
