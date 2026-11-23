import { HospitalCodeIcon } from "./HospitalCodeIcon"
import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Bell, Siren, Volume2, VolumeX, X, ArrowLeft } from "lucide-react"
import { supabase, type Profile } from "../lib/supabase"
import { emitHospitalAlert, HospitalSound, loadHospitalInbox, updateHospitalAlert, type HospitalAlert, type HospitalCode } from "../lib/hospitalAlerts"

export function HospitalAlertHub({ profile, onNotifications }: { profile: Profile; onNotifications: () => void }) {
  const [codes, setCodes] = useState<HospitalCode[]>([]), [alerts, setAlerts] = useState<HospitalAlert[]>([])
  const [unread, setUnread] = useState(0), [open, setOpen] = useState(false), [tab, setTab] = useState<"codes" | "active" | "history">("codes")
  const [selected, setSelected] = useState<HospitalCode | null>(null), [location, setLocation] = useState(""), [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [connectionError, setConnectionError] = useState("")
  const [soundEnabled, setSoundEnabled] = useState(false), [message, setMessage] = useState("")
  const [closing, setClosing] = useState<number | null>(null), [resolution, setResolution] = useState("")
  const [history, setHistory] = useState<HospitalAlert[]>([])
  const request = useRef(""), dialog = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const sound = useRef(new HospitalSound()), sounded = useRef(new Set<number>()), refreshRef = useRef<() => void>(() => {})
  const responsible = profile.role !== "usuario"

  useEffect(() => {
    let active = true, running = false, pending = false
    async function refresh() {
      if (running) { pending = true; return }
      running = true
      try {
        const data = await loadHospitalInbox()
        if (active) { setCodes(data.codes); setAlerts(data.alerts); setUnread(data.unread); setConnectionError("") }
      } catch (cause) { if (active) setConnectionError(cause instanceof Error ? cause.message : "No fue posible actualizar las alertas.") }
      finally { running = false; if (active && pending) { pending = false; void refresh() } }
    }
    refreshRef.current = () => { void refresh() }
    void refresh()
    const channel = supabase?.channel(`hospital-inbox-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` }, () => { void refresh(); window.dispatchEvent(new Event("biomedgest:notifications-changed")) })
      .on("postgres_changes", { event: "*", schema: "public", table: "hospital_alerts" }, () => { void refresh() }).subscribe()
    const timer = window.setInterval(refresh, 10000)
    const focus = () => { if (!document.hidden) void refresh() }
    const openAlert = () => { setSelected(null); setTab("active"); setOpen(true) }
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus)
    window.addEventListener("biomedgest:notifications-changed", focus); window.addEventListener("biomedgest:open-hospital-alerts", openAlert)
    return () => {
      active = false; window.clearInterval(timer); if (channel) void supabase?.removeChannel(channel)
      window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus)
      window.removeEventListener("biomedgest:notifications-changed", focus); window.removeEventListener("biomedgest:open-hospital-alerts", openAlert)
      void sound.current.stop()
    }
  }, [profile.id])

  useEffect(() => {
    sound.current.retain(new Set(alerts.map(alert => alert.id)))
    if (!soundEnabled) return
    const pending = alerts.filter(alert => alert.audible && !sounded.current.has(alert.id))
    pending.sort((a,b) => Number(b.audience === "todos") - Number(a.audience === "todos"))
    pending.forEach(alert => { if (sound.current.play(alert)) sounded.current.add(alert.id) })
  }, [alerts, soundEnabled])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus()
    return () => { document.body.style.overflow = previous; trigger.current?.focus() }
  }, [open])

  async function toggleSound() {
    try {
      if (soundEnabled) { await sound.current.stop(); setSoundEnabled(false) }
      else { await sound.current.enable(); setSoundEnabled(true) }
    } catch { setError("El navegador no habilitó el sonido. Usa un navegador compatible y permite el audio.") }
  }
  async function emit(event: React.FormEvent) {
    event.preventDefault(); if (!selected || busy) return
    setBusy(true); setError("")
    try {
      await emitHospitalAlert(selected.code, location, details, request.current)
      setSelected(null); setTab("active"); setMessage("Alerta emitida y guardada para sus destinatarios."); refreshRef.current()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible emitir la alerta. Puedes reintentar este envío.") }
    finally { setBusy(false) }
  }
  async function changeStatus(id: number, status: "en_atencion" | "cerrada") {
    setBusy(true); setError("")
    try { await updateHospitalAlert(id, status, resolution); setClosing(null); setResolution(""); refreshRef.current(); setMessage(status === "cerrada" ? "Alerta cerrada. Se notificó a sus destinatarios." : "Alerta marcada en atención.") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible actualizar la alerta.") }
    finally { setBusy(false) }
  }
  async function showHistory() {
    setTab("history"); setSelected(null); setError("")
    if (!supabase) return
    const { data, error: failure } = await supabase.rpc("list_hospital_alerts", { include_closed: true })
    if (failure) setError("No fue posible consultar el historial.")
    else setHistory((data || []) as HospitalAlert[])
  }
  function show(next: "active" | "codes") { setError(""); setMessage(""); setSelected(null); setTab(next); setOpen(true) }
  const visibleAlerts = tab === "history" ? history : alerts
  return <>
    <div className="hospital-header-actions">
      <button type="button" className="header-notifications icon-btn" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`} title="Notificaciones y avisos" onClick={onNotifications}><Bell size={22} />{unread > 0 && <span className="header-alert-count">{unread > 99 ? "99+" : unread}</span>}</button>
      <button ref={trigger} type="button" className="header-emergency icon-btn" aria-label="Códigos hospitalarios" title="Emitir alerta hospitalaria" onClick={() => show("codes")}><Siren size={22} />{alerts.length > 0 && <span className="header-alert-count">{alerts.length}</span>}</button>
    </div>
    {connectionError && !open && createPortal(<div className="hospital-alert-toast" role="alert"><Siren size={22} /><div><strong>Alertas sin conexión</strong><span>No se pueden actualizar los avisos. Reintentando.</span></div><button type="button" className="row-action" onClick={() => refreshRef.current()}>Reintentar</button></div>, document.body)}
    {alerts.length > 0 && !open && !connectionError && createPortal(<div className="hospital-alert-toast" role="status"><Siren size={22} /><div><strong>{alerts.length} alerta(s) hospitalaria(s) activa(s)</strong><span>{alerts[0].code_name} · {alerts[0].location}</span><span>Emitida por: {alerts[0].emitter_name}{alerts[0].emitter_institutional_id ? ` (ID ${alerts[0].emitter_institutional_id})` : ""}</span></div><button type="button" className="row-action" onClick={() => show("active")}>Revisar</button></div>, document.body)}
    {open && createPortal(<div className="modal-layer hospital-modal-layer" onClick={event => { if (event.target === event.currentTarget && !busy) setOpen(false) }}><div ref={dialog} className="modal hospital-modal" role="dialog" aria-modal="true" aria-label="Códigos y alertas hospitalarias" onKeyDown={event => {
      if (event.key === "Escape" && !busy) { event.stopPropagation(); setOpen(false) }
      if (event.key === "Tab") {
        const targets = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')
        if (!targets?.length) return
        const first = targets[0], last = targets[targets.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}>
      <div className="modal-head"><h2>Códigos hospitalarios</h2><button type="button" className="icon-btn" disabled={busy} aria-label="Cerrar códigos hospitalarios" onClick={() => setOpen(false)}><X size={22} /></button></div>
      <div className="hospital-panel-tools"><div className="hospital-tabs"><button type="button" aria-pressed={tab === "codes"} disabled={busy} onClick={() => { setTab("codes"); setSelected(null) }}>Emitir alerta</button><button type="button" aria-pressed={tab === "active"} disabled={busy} onClick={() => { setTab("active"); setSelected(null) }}>Activas ({alerts.length})</button><button type="button" aria-pressed={tab === "history"} disabled={busy} onClick={() => void showHistory()}>Historial</button></div><button type="button" className="row-action" aria-pressed={soundEnabled} onClick={() => void toggleSound()}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}{soundEnabled ? "Desactivar sonido" : "Activar sonido"}</button></div>
      <p className="hospital-scope-note">Recepción inicial: jefe e Ingeniería Biomédica. Las alertas generales se envían a todos los perfiles. El sonido requiere activación en este navegador y la app abierta.</p>
      {(error || connectionError) && <p className="form-error" role="alert">{error || connectionError}</p>}
      {message && <p className="hospital-success" role="status">{message}</p>}
      {tab === "codes" && !selected && <div className="hospital-code-grid">{codes.map(code => <button key={code.code} type="button" className="hospital-code-card" style={{ "--hospital-code-color": code.code === "blanco" ? "#94a3b8" : code.color, "--hospital-code-tint": code.color } as CSSProperties} disabled={busy} onClick={() => { setSelected(code); setLocation(""); setDetails(""); request.current=crypto.randomUUID(); setError(""); setMessage("") }}><HospitalCodeIcon code={code.code} color={code.color} /><span><strong>Código {code.name}</strong><span>{code.description}</span><small>{code.audience === "todos" ? "Todos los perfiles · Aviso general" : "Jefe y biomédicos"}</small></span></button>)}{!codes.length && <p>Cargando catálogo de códigos...</p>}</div>}
      {tab === "codes" && selected && <form className="hospital-emit-form" onSubmit={emit}><button type="button" className="row-action" disabled={busy} onClick={() => setSelected(null)}><ArrowLeft size={16} />Volver al catálogo</button><div className="hospital-selected-code"><HospitalCodeIcon code={selected.code} color={selected.color} /><div><h3>Código {selected.name}</h3><p>{selected.description}</p></div></div><p><strong>Destinatarios: {selected.audience === "todos" ? "todos los perfiles activos" : "jefe e ingenieros biomédicos"}.</strong></p><label className="field"><span>Área y ubicación de la emergencia *</span><input required minLength={2} maxLength={160} value={location} disabled={busy} onChange={event => setLocation(event.target.value)} placeholder="Ej. Quirófano 1, acceso principal" /></label><label className="field"><span>Observaciones (opcional)</span><textarea maxLength={1000} value={details} disabled={busy} onChange={event => setDetails(event.target.value)} placeholder="Describe únicamente los detalles necesarios para localizar la emergencia." /></label><button type="submit" className="btn btn-danger" disabled={busy || !location.trim()}><Siren size={19} />{busy ? "Emitiendo..." : selected.audience === "todos" ? "Emitir alerta para todos" : "Emitir alerta a responsables"}</button></form>}
      {tab !== "codes" && <div className="hospital-active-list">{visibleAlerts.length === 0 && <p>No hay alertas {tab === "active" ? "activas" : "registradas"} para tu cuenta.</p>}{visibleAlerts.map(alert => <article key={alert.id} className="hospital-active-card"><div className="hospital-selected-code"><HospitalCodeIcon code={alert.code} color={alert.color} /><div><h3>Código {alert.code_name} · {alert.code_description}</h3><p>{alert.location}</p></div></div><p>{alert.details}</p><div className="hospital-emitter"><strong>Emitida por: {alert.emitter_name}</strong><span>ID institucional: {alert.emitter_institutional_id || "No disponible"}{alert.emitter_role ? ` | ${alert.emitter_role === "jefe" ? "Jefe" : alert.emitter_role === "tecnico" ? "Ingeniero biomédico" : "Usuario"}` : ""}</span>{alert.emitter_department && <span>{alert.emitter_department}</span>}</div><small>{new Date(alert.created_at).toLocaleString("es-MX")}</small><strong className="hospital-alert-state">{alert.status === "activa" ? "Activa · Pendiente de atención" : alert.status === "en_atencion" ? `En atención · ${alert.responder_name || "Responsable asignado"}` : "Cerrada"}</strong>{alert.closure_notes && <p>Motivo del cierre: {alert.closure_notes}</p>}{responsible && alert.status !== "cerrada" && <div className="hospital-card-actions">{alert.status === "activa" && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void changeStatus(alert.id,"en_atencion")}>Atender alerta</button>}<button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setClosing(alert.id); setResolution("") }}>Cerrar alerta</button></div>}{closing === alert.id && <form onSubmit={event => { event.preventDefault(); void changeStatus(alert.id,"cerrada") }}><label className="field"><span>Motivo del cierre *</span><textarea required minLength={5} maxLength={1000} value={resolution} onChange={event => setResolution(event.target.value)} disabled={busy} /></label><div className="hospital-card-actions"><button type="submit" className="btn btn-primary" disabled={busy}>Confirmar cierre</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setClosing(null)}>Cancelar</button></div></form>}</article>)}</div>}
    </div></div>, document.body)}
  </>
}
