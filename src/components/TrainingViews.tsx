import { t } from "../lib/i18n"
import { useEffect, useState } from "react"

import { CalendarDays, CheckCircle2, GraduationCap, Plus } from "lucide-react"

import { Button, PageIntro } from "./ui"
import { PrivateAttachmentPanel } from "./PrivateAttachmentPanel"

import {
  createTraining,
  getCurrentProfile,
  listTrainingInstructors,
  isBusinessCompletionEnabled,
  listActiveProfileDirectory,
  listEquipmentInventory,
  listTrainingParticipants,
  listTrainings,
  setTrainingParticipants,
  updateTrainingAttendance,
  updateTrainingStatus,
  type Profile,
  type Role,
  type Training,
  type TrainingParticipant,
  type EquipmentInventoryDetail,
} from "../lib/supabase"

export function TrainingCalendar({ role }: { role: Role }) {
  const [trainings, setTrainings] = useState<Training[]>([])

  const [showForm, setShowForm] = useState(false)

  const [error, setError] = useState("")

  useEffect(() => {
    listTrainings()
      .then(setTrainings)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar capacitaciones.",
        ),
      )
  }, [])

  return (
    <>
      <PageIntro
        title={t("Capacitaciones")}
        description={t("Administra las capacitaciones; sus fechas también aparecen en el calendario general.")}
        action={
          <Button icon={Plus} onClick={() => setShowForm(true)}>{"Programar capacitación"}</Button>
        }
      />
      {showForm && (
        <TrainingForm role={role}
          onCreated={(training) => {
            setTrainings((current) => [training, ...current])
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {error && <p className="form-error">{error}</p>}
      <section className="panel training-calendar">
        <div className="panel-head">
          <div>
            <h3>{t("Capacitaciones programadas")}</h3>
            <p>{t("Equipo nuevo, personal nuevo, necesidades detectadas y protocolos.")}</p>
          </div>
          <GraduationCap size={22} />
        </div>
        {trainings.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={34} />
            <h3>{t("No hay capacitaciones registradas")}</h3>
            <p>{t("Programa la primera sesión usando el botón superior.")}</p>
          </div>
        ) : (
          <div className="training-list">
            {trainings.map((training) => (
              <article key={training.id}>
                <span className="maintenance-code">
                  <GraduationCap size={18} />
                </span>
                <div>
                  <strong>{training.title}</strong>
                  <small>
                    {training.training_number} ·{" "}
                    {new Date(training.scheduled_at).toLocaleString("es-MX")} ·{" "}
                    {training.location || "Por definir"}
                  </small>
                  <small>{t("Impartido por:")} {training.instructor_name || t("No disponible")}</small>
                  <span>
                    {training.purposeLabel}{" "}{t("· Recurrencia")}{" "}{training.recurrence}{" "}{t("· Estado")}{" "}{training.status}
                  </span>
                </div>
                <CheckCircle2 size={18} />
                {isBusinessCompletionEnabled && (role === "jefe" || role === "tecnico") && <TrainingAdminPanel training={training} onChanged={(updated) => setTrainings((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))} />}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function TrainingAdminPanel({ training, onChanged }: { training: Training; onChanged: (training: Training) => void }) {
  const [open, setOpen] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [participants, setParticipants] = useState<TrainingParticipant[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState("")

  async function load() {
    setError("")
    try {
      const [profileRows, participantRows] = await Promise.all([listActiveProfileDirectory(), listTrainingParticipants(training.id)])
      setProfiles(profileRows.filter((profile) => profile.active))
      setParticipants(participantRows)
      setSelected(participantRows.map((row) => row.participant_id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar participantes.") }
  }

  async function toggle() { const next = !open; setOpen(next); if (next) await load() }
  async function saveParticipants() { try { await setTrainingParticipants(training.id, selected); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar participantes.") } }
  async function attendance(row: TrainingParticipant, status: TrainingParticipant["attendance_status"]) { try { await updateTrainingAttendance(training.id, row.participant_id, status); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible registrar asistencia.") } }
  async function transition(status: Training["status"]) { try { onChanged(await updateTrainingStatus(training.id, status)) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cambiar el estado.") } }

  return <div className="training-admin"><button type="button" className="row-action" onClick={toggle}>{open ? t("Cerrar gestión") : t("Gestionar")}</button>{open && <div className="training-admin-panel"><label className="field"><span>{t("Participantes activos")}</span><select multiple value={selected} onChange={(event) => setSelected(Array.from(event.target.selectedOptions, (option) => option.value))}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} · {profile.role}</option>)}</select></label><button type="button" className="row-action" onClick={saveParticipants}>{t("Guardar participantes")}</button><div className="participant-list">{participants.map((row) => <label key={row.participant_id}><span>{row.profile?.full_name || row.participant_id}</span><select value={row.attendance_status} onChange={(event) => attendance(row, event.target.value as TrainingParticipant["attendance_status"])}><option value="convocado">{t("Convocado")}</option><option value="confirmado">{t("Confirmado")}</option><option value="asistio">{t("Asistió")}</option><option value="no_asistio">{t("No asistió")}</option></select></label>)}</div><div className="qr-actions">{training.status === "programada" && <><button type="button" className="row-action" onClick={() => transition("en_curso")}>{t("Iniciar")}</button><button type="button" className="row-action" onClick={() => transition("cancelada")}>{t("Cancelar")}</button></>}{training.status === "en_curso" && <button type="button" className="row-action" onClick={() => transition("completada")}>{t("Completar")}</button>}</div><PrivateAttachmentPanel relation={{ trainingId: training.id }} title={t("Evidencias de capacitación")} />{error && <small className="form-error">{error}</small>}</div>}</div>
}

export function TrainingForm({
  onCreated,
  onCancel,
  role = "tecnico",
}: {
  onCreated: (training: Training) => void
  onCancel: () => void
  role?: Role
}) {
  const [instructors, setInstructors] = useState<Profile[]>([])
  const [instructorId, setInstructorId] = useState("")
  const [instructorType, setInstructorType] = useState<"jefe"|"tecnico">("jefe")
  const [self, setSelf] = useState<Profile | null>(null)
  useEffect(() => { getCurrentProfile().then(setSelf).catch(() => undefined); if(role === "jefe") listTrainingInstructors().then(setInstructors).catch(cause => setError(cause.message)) }, [role])
  const [title, setTitle] = useState("")

  const [purpose, setPurpose] = useState("equipo_nuevo")

  const [recurrence, setRecurrence] = useState("unica")

  const [scheduledAt, setScheduledAt] = useState("")

  const [location, setLocation] = useState("")

  const [description, setDescription] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [equipment, setEquipment] = useState<EquipmentInventoryDetail[]>([])

  const [error, setError] = useState("")
  const [saving,setSaving] = useState(false)

  useEffect(() => { if (isBusinessCompletionEnabled) listEquipmentInventory("tecnico").then(setEquipment).catch(() => setEquipment([])) }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(saving)return
    setSaving(true);setError("")
    try {
      onCreated(
        await createTraining({
          title,
          instructorId: role === "jefe" ? instructorId : undefined,
          purpose,
          recurrence,
          scheduledAt,
          location,
          description,
          equipmentId,
        }),
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible guardar la capacitación.",
      )
    } finally { setSaving(false) }
  }

  return (
    <form className="panel training-form" onSubmit={submit}>
      <div className="panel-head">
        <h3>{t("Nueva capacitación")}</h3>
      </div>
      <div className="form-grid">
        {role === "jefe" ? <fieldset className="field span-2"><legend>{t("Impartido por")}</legend><div className="table-actions"><button type="button" aria-pressed={instructorType==="jefe"} className={`btn btn-${instructorType==="jefe"?"primary":"secondary"}`} onClick={()=>{setInstructorType("jefe");setInstructorId("")}}>{t("Jefe")}</button><button type="button" aria-pressed={instructorType==="tecnico"} className={`btn btn-${instructorType==="tecnico"?"primary":"secondary"}`} onClick={()=>{setInstructorType("tecnico");setInstructorId("")}}>{t("Ingeniero biomédico")}</button></div><label className="field"><span>{t(instructorType==="jefe"?"Jefe que imparte":"Ingeniero que imparte")} *</span><select required value={instructorId} onChange={e=>setInstructorId(e.target.value)}><option value="">{t("Selecciona quién imparte")}</option>{instructors.filter(p=>p.role===instructorType && p.active).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label></fieldset> : <div className="field span-2"><span>{t("Impartido por")}</span><strong>{self?.full_name || t("Ingeniero de la sesión actual")}</strong><small>{t("La capacitación se asigna automáticamente a tu cuenta.")}</small></div>}
        <label className="field span-2">
          <span>{t("Título *")}</span>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("Ej. Uso seguro del nuevo monitor")}
          />
        </label>
        <label className="field">
          <span>{t("Motivo *")}</span>
          <select
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          >
            <option value="equipo_nuevo">{t("Equipo nuevo")}</option>
            <option value="personal_nuevo">{t("Personal nuevo")}</option>
            <option value="necesidad_detectada">{t("Necesidad detectada")}</option>
            <option value="protocolo">{t("Protocolo")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("Periodicidad *")}</span>
          <select
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value)}
          >
            <option value="unica">{t("Única")}</option>
            <option value="semanal">{t("Semanal")}</option>
            <option value="mensual">{t("Mensual")}</option>
            <option value="semestral">{t("Semestral")}</option>
            <option value="anual">{t("Anual")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("Fecha y hora *")}</span>
          <input
            required
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{t("Ubicación")}</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={t("Aula o servicio")}
          />
        </label>
        <label className="field span-2">
          <span>{t("Descripción")}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {isBusinessCompletionEnabled && <label className="field span-2"><span>{t("Equipo relacionado")}</span><select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}><option value="">{t("Sin equipo específico")}</option>{equipment.map((row) => <option key={row.id} value={row.id}>{row.inventory_code} · {row.equipment_type}</option>)}</select></label>}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-footer">
        <Button variant="secondary" onClick={onCancel}>{t("Cancelar")}</Button>
        <Button type="submit" disabled={saving || (role === "jefe" && !instructorId)}>{t("Guardar capacitación")}</Button>
      </div>
    </form>
  )
}

export function NoticesView() {
  const [trainings, setTrainings] = useState<Training[]>([])

  useEffect(() => {
    listTrainings()
      .then(setTrainings)
      .catch(() => setTrainings([]))
  }, [])

  return (
    <>
      <PageIntro
        eyebrow="Portal clínico"
        title={t("Avisos")}
        description={t("Capacitaciones próximas comunicadas por Ingeniería Biomédica.")}
      />
      <section className="panel">
        <div className="notice-list">
          {trainings.map((training) => (
            <article key={training.id}>
              <span className="summary-icon blue">
                <GraduationCap size={21} />
              </span>
              <div>
                <strong>{training.title}</strong>
                <p>
                  {new Date(training.scheduled_at).toLocaleString("es-MX")} ·{" "}
                  {training.location || "Ubicación por confirmar"}
                </p>
                <small>
                  {training.description ||
                    "Consulta los detalles con Ingeniería Biomédica."}
                </small>
              </div>
              <span className="badge badge-blue">{t("Próxima")}</span>
            </article>
          ))}
        </div>
        {trainings.length === 0 && (
          <div className="empty-state">
            <h3>{t("No hay avisos por ahora")}</h3>
            <p>{t("Las próximas capacitaciones aparecerán aquí.")}</p>
          </div>
        )}
      </section>
    </>
  )
}
