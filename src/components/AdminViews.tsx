import {PurchaseRequisition} from "./PurchaseRequisition"
import type {PurchaseRequisition as PurchaseRecord} from "../lib/purchaseRequisition"
import { profileEditDraft } from "../lib/profileDraft"
import { t } from "../lib/i18n"
import { ProfilePhotoPicker } from "./ProfilePhotoPicker"
import { uploadProfilePhoto, removeProfilePhoto } from "../lib/profilePhotos"
import { useEffect, useState } from "react"

import { AlertTriangle, History, Info, Search, UserPlus, Users } from "lucide-react"

import { Button, PageIntro } from "./ui"
import { PrivateAttachmentPanel } from "./PrivateAttachmentPanel"

import {
  createAccessRequest,
  deleteInactiveUser,
  listUserDepartments,
  listUserPresence,
  listAuditLog,
  listAccessRequests,
  listQuoteItems,
  listQuoteStatusHistory,
  listEquipmentInventory,
  listMaintenanceOverview,
  listProfiles,
  listProfileChangeHistory,
  listQuotes,
  isOperationalCompletionEnabled,
  manageProfile,
  provisionUser,
  isBusinessCompletionEnabled,
  saveQuoteItems,
  syncAuthStatus,
  type AuditEntry,
  type AccessRequest,
  type Profile,
  type ProfileChange,
  type Quote,
  type QuoteItem,
  type QuoteStatusHistory,
  type EquipmentInventoryDetail,
  type MaintenanceSummary,
} from "../lib/supabase"

export function QuotationsView() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState("")

  const [open, setOpen] = useState(false)
  const [selectedQuote,setSelectedQuote]=useState<Quote|undefined>(),[selectedRecord,setSelectedRecord]=useState<PurchaseRecord|undefined>()

  useEffect(() => {
    listQuotes()
      .then(setQuotes)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar cotizaciones.",
        ),
      )
  }, [])

  if(open)return <PurchaseRequisition key={selectedQuote?.id||"new"} quote={selectedQuote} initial={selectedRecord} onBack={()=>{setOpen(false);setSelectedQuote(undefined);setSelectedRecord(undefined)}} onSaved={result=>{setQuotes(current=>[result.quote,...current.filter(item=>item.id!==result.quote.id)]);setSelectedQuote(result.quote);setSelectedRecord(result.requisition)}}/>
  return (
    <>
      <PageIntro
        title={t("Cotizaciones")}
        description={t("Solicita y revisa cotizaciones de equipo médico con proveedores.")}
        action={
          <Button icon={UserPlus} onClick={() => {setSelectedQuote(undefined);setSelectedRecord(undefined);setOpen(true)}}>{t("Nueva requisición")}</Button>
        }
      />
      <section className="panel">
        {error && <QueryError message={error} />}
        {!error && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Folio")}</th>
                    <th>{t("Proveedor")}</th>
                    <th>{t("Equipo")}</th>
                    <th>{t("Monto")}</th>
                    <th>{t("Estado")}</th><th>{t("Requisición de compra")}</th>
                    {isBusinessCompletionEnabled && <th>{t("Detalle")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <strong className="order-id">
                          {quote.quote_number}
                        </strong>
                      </td>
                      <td>{quote.supplier}</td>
                      <td>{quote.equipment_description}</td>
                      <td>
                        {quote.currency} {quote.amount.toLocaleString("es-MX")}
                      </td>

                      <td>
                        <span className="badge badge-warning">
                          {quote.status}
                        </span>
                      </td><td><Button variant="secondary" onClick={()=>{setSelectedQuote(quote);setSelectedRecord(undefined);setOpen(true)}}>{t(quote.has_purchase_requisition?"Ver requisición / PDF":"Crear requisición")}</Button></td>{isBusinessCompletionEnabled && <td>{quote.has_purchase_requisition?t("Editar desde la requisición"):<QuoteDetailEditor quote={quote} onChanged={(updated) => setQuotes((current) => current.map((item) => item.id === updated.id ? updated : item))}/>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quotes.length === 0 && (
              <div className="empty-state">
                <h3>{t("No hay cotizaciones registradas")}</h3>
                <p>{t("Agrega la primera cotización para iniciar la revisión.")}</p>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

function QuoteDetailEditor({ quote, onChanged }: { quote: Quote; onChanged: (quote: Quote) => void }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [status, setStatus] = useState(quote.status)
  const [error, setError] = useState("")
  const [equipment, setEquipment] = useState<EquipmentInventoryDetail[]>([])
  const [maintenances, setMaintenances] = useState<MaintenanceSummary[]>([])
  const [equipmentId, setEquipmentId] = useState(quote.equipment_id || "")
  const [maintenanceId, setMaintenanceId] = useState(quote.maintenance_id ? String(quote.maintenance_id) : "")
  const [history, setHistory] = useState<QuoteStatusHistory[]>([])
  const locked = quote.status === "aprobada" || quote.status === "rechazada"
  async function toggle() { const next = !open; setOpen(next); if (next) { try { const [rows, equipmentRows, maintenanceResult, historyRows] = await Promise.all([listQuoteItems(quote.id), listEquipmentInventory("jefe"), listMaintenanceOverview(), listQuoteStatusHistory(quote.id)]); setItems(rows.length ? rows : [{ description: quote.equipment_description, quantity: 1, unit_cost: quote.amount }]); setEquipment(equipmentRows); setMaintenances(maintenanceResult.maintenances); setHistory(historyRows) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar el detalle.") } } }
  async function save() { try { const updated = await saveQuoteItems(quote.id, status, items, { equipmentId: equipmentId || null, maintenanceId: maintenanceId ? Number(maintenanceId) : null }); onChanged(updated); setOpen(false) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar la cotización.") } }
  return <div><button type="button" className="row-action" onClick={toggle}>{open ? t("Cerrar") : locked ? t("Consultar") : t("Editar")}</button>{open && <div className="quote-detail-editor"><label className="field"><span>{t("Estado")}</span><select disabled={locked} value={status} onChange={(event) => setStatus(event.target.value)}><option value="pendiente">{t("Pendiente")}</option><option value="en_revision">{t("En revisión")}</option><option value="aprobada">{t("Aprobada")}</option><option value="rechazada">{t("Rechazada")}</option></select></label><label className="field"><span>{t("Equipo relacionado")}</span><select disabled={locked || Boolean(maintenanceId)} value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}><option value="">{t("Sin equipo")}</option>{equipment.map((row) => <option key={row.id} value={row.id}>{row.inventory_code} · {row.equipment_type}</option>)}</select></label><label className="field"><span>{t("Mantenimiento relacionado")}</span><select disabled={locked || Boolean(equipmentId)} value={maintenanceId} onChange={(event) => setMaintenanceId(event.target.value)}><option value="">{t("Sin mantenimiento")}</option>{maintenances.map((row) => <option key={row.id} value={row.id}>{row.maintenance_number}</option>)}</select></label>{items.map((item, index) => <div className="quote-item-row" key={item.id || index}><input disabled={locked} value={item.description} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, description: event.target.value } : row))} /><input disabled={locked} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, quantity: Number(event.target.value) } : row))} /><input disabled={locked} type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => setItems((current) => current.map((row, position) => position === index ? { ...row, unit_cost: Number(event.target.value) } : row))} /></div>)}{!locked && <><button type="button" className="row-action" onClick={() => setItems((current) => [...current, { description: "", quantity: 1, unit_cost: 0 }])}>{t("Agregar")}</button><button type="button" className="row-action" onClick={save}>{t("Guardar")}</button></>}<div className="audit-list">{history.map((row) => <small key={row.id}>{row.previous_status} → {row.new_status} · {new Date(row.changed_at).toLocaleString("es-MX")}</small>)}</div><PrivateAttachmentPanel relation={{ quoteId: quote.id }} title={t("Documentos de cotización")} />{error && <small className="form-error">{error}</small>}</div>}</div>
}

export function UserPermissionsView() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [active, setActive] = useState("")
  const [editing, setEditing] = useState<Profile | null>(null)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [presence, setPresence] = useState<Record<string, boolean>>({})
  const [presenceError, setPresenceError] = useState(false)
  useEffect(() => {
    let mounted = true
    const load = () => { listUserPresence().then(rows => { if (mounted) { setPresence(Object.fromEntries(rows.map(row => [row.profile_id,row.online]))); setPresenceError(false) } }).catch(() => { if (mounted) setPresenceError(true) }) }
    load(); const timer = window.setInterval(load,15000); window.addEventListener("focus",load)
    return () => { mounted=false; clearInterval(timer); window.removeEventListener("focus",load) }
  }, [])
  const [deleting, setDeleting] = useState<Profile | null>(null)
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<File | null>(null)
  const [profileNotice, setProfileNotice] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [requestOpen, setRequestOpen] = useState(false)
  const [showIdInfo, setShowIdInfo] = useState(false)
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [request, setRequest] = useState({ firstName: "", lastName: "", age: "", phone: "", role: "usuario" as Profile["role"], department: "" })
  const [departments, setDepartments] = useState<string[]>([])
  useEffect(() => { listUserDepartments().then(setDepartments).catch(cause => setError(cause.message)) }, [])
  const [provisioning, setProvisioning] = useState<AccessRequest | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState("")

  useEffect(() => {
    listProfiles()
      .then(setProfiles)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar perfiles.",
        ),
      )
  }, [])
  useEffect(() => { if (isOperationalCompletionEnabled) listAccessRequests().then(setRequests).catch(() => undefined) }, [])

  const filtered = profiles.filter((profile) => {
    const term = search.trim().toLocaleLowerCase("es-MX")
    return (!term || [profile.full_name, profile.institutional_id, profile.department || ""].some((value) => value.toLocaleLowerCase("es-MX").includes(term))) &&
      (!role || profile.role === role) && (!active || String(profile.active) === active)
  })

  async function saveProfile() {
    if (!editing || !reason.trim()) {
      setError("Indica el motivo del cambio para conservar la trazabilidad.")
      return
    }
    if (!editing.first_name?.trim() || (editing.age != null && (!Number.isInteger(editing.age) || editing.age<18 || editing.age>100))) { setError("Revisa los nombres y la edad (18 a 100 años, si está registrada)."); return }
    setSaving(true)
    setError("")
    let uploaded: string | null = null
    try {
      const previous = profiles.find((profile) => profile.id === editing.id)
      if(editingPhoto) uploaded = await uploadProfilePhoto(editingPhoto, editing.id)
      const updated = await manageProfile({...editing, avatar_path: uploaded || editing.avatar_path}, reason.trim())
      if(previous?.avatar_path && previous.avatar_path !== updated.avatar_path) void removeProfilePhoto(previous.avatar_path)
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile))
      if (previous && previous.active !== updated.active) {
        try { await syncAuthStatus(updated.id, updated.active) }
        catch (cause) {
          setError(`El perfil quedó ${updated.active ? "habilitado" : "inhabilitado"} y RLS ya aplica, pero Auth no pudo sincronizarse: ${cause instanceof Error ? cause.message : "error no identificado"}`)
          return
        }
      }
      setProfileNotice(previous?.institutional_id !== updated.institutional_id ? `Rol actualizado. Nuevo ID para iniciar sesión: ${updated.institutional_id}. La contraseña se conserva.` : "Perfil actualizado correctamente.")
      window.dispatchEvent(new Event("biomedgest:profile-updated"))
      setEditing(null)
      setReason("")
    } catch (cause) {
      if(uploaded && cause && typeof cause === "object" && "code" in cause) void removeProfilePhoto(uploaded)
      setError(cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "No fue posible actualizar el perfil.")
    } finally {
      setSaving(false)
    }
  }

  async function submitAccessRequest(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("")
    let uploaded: string | null = null
    try { if(newPhoto) uploaded = await uploadProfilePhoto(newPhoto); await createAccessRequest({...request, ...(uploaded ? {avatarPath:uploaded} : {})}); uploaded=null; setNewPhoto(null); setRequests(await listAccessRequests()); setRequestOpen(false); setRequest({ firstName: "", lastName: "", age: "", phone: "", role: "usuario", department: "" }) }
    catch (cause) { if(uploaded && cause && typeof cause === "object" && "code" in cause) void removeProfilePhoto(uploaded); setError(cause instanceof Error ? cause.message : "No fue posible registrar la solicitud.") }
    finally { setSaving(false) }
  }

  async function submitProvision(event: React.FormEvent) {
    event.preventDefault(); if (!provisioning) return
    setSaving(true); setError("")
    try {
      await provisionUser({ institutionalId: provisioning.institutional_id, fullName: provisioning.full_name, role: provisioning.role, department: provisioning.department || "", temporaryPassword, accessRequestId: provisioning.id })
      const [profileRows, requestRows] = await Promise.all([listProfiles(), listAccessRequests()])
      setProfiles(profileRows); setRequests(requestRows); setProvisioning(null); setTemporaryPassword("")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible crear la cuenta.") }
    finally { setSaving(false) }
  }

  if (!isOperationalCompletionEnabled)
    return <><PageIntro title={t("Usuarios y permisos")} description={t("La administración segura de perfiles estará disponible después de instalar la migración 16.")} /><section className="panel empty-state"><h3>{t("Activación pendiente")}</h3><p>{t("La consulta existente se conserva, pero las modificaciones permanecen deshabilitadas para evitar llamadas a funciones aún no desplegadas.")}</p></section></>

  return (
    <>
      <PageIntro
        title={t("Usuarios y permisos")}
        description={t("Consulta, filtra y administra perfiles sin exponer privilegios de Auth en el navegador.")}
        action={
          <Button icon={UserPlus} onClick={() => setRequestOpen(true)}>{"Alta de usuario"}</Button>
        }
      />
      {profileNotice && <p className="form-success" role="status">{profileNotice}</p>}
      <section className="panel">
        {error ? (
          <QueryError message={error} />
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h3>{t("Directorio de perfiles")}</h3>
                <p>{filtered.length}{" "}{t("de")}{" "}{profiles.length}{" "}{t("perfiles visibles")}</p>
              </div>
              <Users size={21} />
            </div>
            <div className="filter-bar">
              <label className="search-box"><Search size={18} /><input aria-label={t("Buscar usuario")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Nombre, ID o departamento...")} /></label>
              <label className="inventory-select"><span>{t("Rol")}</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="">{t("Todos")}</option><option value="usuario">{t("Usuario")}</option><option value="tecnico">{t("Ingeniero biomédico")}</option><option value="jefe">{t("Jefe")}</option></select></label>
              <label className="inventory-select"><span>{t("Acceso")}</span><select value={active} onChange={(event) => setActive(event.target.value)}><option value="">{t("Todos")}</option><option value="true">{t("Habilitados")}</option><option value="false">{t("Inhabilitados")}</option></select></label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("ID")}</th>
                    <th>{t("Nombre")}</th>
                    <th>{t("Rol")}</th>
                    <th>{t("Departamento")}</th>
                    <th>{t("Conexión")}</th><th>{t("Acceso")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((profile) => (
                    <tr key={profile.id}>
                      <td>
                        <strong className="order-id">
                          {profile.institutional_id}
                        </strong>
                      </td>
                      <td>{profile.full_name}</td>
                      <td>{profile.role}</td>
                      <td>{profile.department || "—"}</td>
                      <td>
                        <span className={`badge badge-${presence[profile.id] && profile.active ? "success" : "neutral"}`}>{presenceError ? t("Sin conexión al estado") : presence[profile.id] && profile.active ? t("Activo") : t("Inactivo")}</span>
                      </td><td><span className={`badge badge-${profile.active ? "success" : "neutral"}`}>{profile.active ? t("Habilitado") : t("Inhabilitado")}</span>
                      </td>
                      <td><button type="button" className="row-action" onClick={() => { setEditing(profileEditDraft(profile)); setEditingPhoto(null); setReason(""); setError("") }}>{t("Editar")}</button>{!profile.active && <button type="button" className="row-action" onClick={() => { setDeleting(profile); setDeleteError("") }}>{t("Eliminar usuario")}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="empty-state"><h3>{t("No hay coincidencias")}</h3><p>{t("Prueba con otros filtros.")}</p></div>}
          </>
        )}
      </section>
      <section className="panel"><div className="panel-head"><div><h3>{t("Solicitudes de alta")}</h3><p>{t("La identidad Auth se crea únicamente mediante la función backend protegida.")}</p></div><UserPlus size={21} /></div><div className="table-wrap"><table><thead><tr><th>{t("ID institucional")}</th><th>{t("Nombre")}</th><th>{t("Rol solicitado")}</th><th>{t("Conexión")}</th><th>{t("Acceso")}</th><th>{t("Acción")}</th></tr></thead><tbody>{requests.map((row) => <tr key={row.id}><td>{row.institutional_id}</td><td>{row.full_name}</td><td>{row.role}</td><td>{row.status}</td><td>{row.status === "pendiente" ? <button type="button" className="row-action" onClick={() => { setProvisioning(row); setTemporaryPassword(""); setError("") }}>{t("Crear cuenta Auth")}</button> : "—"}</td></tr>)}</tbody></table></div>{requests.length === 0 && <div className="empty-state"><h3>{t("Sin solicitudes")}</h3></div>}</section>
      {deleting && <div className="modal-layer"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title"><h2 id="delete-user-title">{t("¿Eliminar usuario?")}</h2><p>{deleting.full_name} · {deleting.institutional_id}</p><p>{t("La cuenta inhabilitada se eliminará del directorio y se bloqueará su acceso. Sus reportes, órdenes e historial se conservarán para mantener la trazabilidad. Esta acción no permite reactivar la cuenta.")}</p>{deleteError && <p role="alert" className="form-error">{deleteError}</p>}<div className="modal-footer"><Button disabled={saving} variant="secondary" onClick={() => setDeleting(null)}>{t("Cancelar")}</Button><Button disabled={saving} variant="danger" onClick={async () => { setSaving(true); setDeleteError(""); try { await deleteInactiveUser(deleting.id); setProfiles(current => current.filter(p => p.id !== deleting.id)); setDeleting(null) } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : "No fue posible eliminar la cuenta") } finally { setSaving(false) } }}>{saving ? t("Eliminando...") : t("Confirmar eliminación")}</Button></div></div></div>}
      {requestOpen && <div className="modal-layer"><form className="modal" onSubmit={submitAccessRequest}><div className="modal-head"><div><span className="eyebrow">{t("Alta de usuario")}</span><h2>{t("Datos de la nueva cuenta")}</h2><p>{t("El identificador se asigna automáticamente al guardar. Después podrás establecer la contraseña temporal.")}</p></div></div><div className="form-grid">
        <div className="field span-2"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><label htmlFor="registration-role">{t("Rol *")}</label><button type="button" className="icon-btn" aria-label={t("Información del identificador automático")} aria-expanded={showIdInfo} aria-controls="registration-id-info" onClick={() => setShowIdInfo(value => !value)}><Info size={18} /></button></div><select id="registration-role" value={request.role} onChange={event => setRequest({ ...request, role: event.target.value as Profile["role"] })}><option value="usuario">{t("Usuario")}</option><option value="tecnico">{t("Ingeniero biomédico")}</option><option value="jefe">{t("Jefe / administrador")}</option></select>{showIdInfo && <p id="registration-id-info" role="note">{t("ID automático:")}{" "}{request.role === "jefe" ? t("00") : request.role === "tecnico" ? t("01") : t("02")}{" "}{t("+ consecutivo desde 181000. Se confirma al registrar; no es editable.")}</p>}</div>
        <ProfilePhotoPicker file={newPhoto} onChange={setNewPhoto} />
        <label className="field"><span>{t("Nombres *")}</span><input required minLength={2} maxLength={80} autoComplete="given-name" pattern="[\p{L}][\p{L} '.’\-]*[\p{L}]" value={request.firstName} onChange={event => setRequest({ ...request, firstName: event.target.value })} /></label>
        <label className="field"><span>{t("Apellidos *")}</span><input required minLength={2} maxLength={100} autoComplete="family-name" pattern="[\p{L}][\p{L} '.’\-]*[\p{L}]" value={request.lastName} onChange={event => setRequest({ ...request, lastName: event.target.value })} /></label>
        <label className="field"><span>{t("Edad *")}</span><input required type="number" min={18} max={100} step={1} value={request.age} onChange={event => setRequest({ ...request, age: event.target.value })} /></label>
        <label className="field"><span>{t("Teléfono (opcional)")}</span><input type="tel" autoComplete="tel" maxLength={10} inputMode="numeric" pattern="[0-9]{10}" placeholder={t("10 dígitos")} value={request.phone} onChange={event => setRequest({ ...request, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
        <label className="field span-2"><span>{t("Departamento *")}</span><select required value={request.department} onChange={event => setRequest({ ...request, department: event.target.value })}><option value="">{t("Selecciona un departamento")}</option>{departments.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      </div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><Button variant="secondary" onClick={() => setRequestOpen(false)}>{t("Cancelar")}</Button><Button type="submit" disabled={saving}>{saving ? t("Guardando...") : t("Registrar usuario")}</Button></div></form></div>}
      {provisioning && <div className="modal-layer"><form className="modal" onSubmit={submitProvision}><div className="modal-head"><div><span className="eyebrow">{t("Backend protegido")}</span><h2>{t("Crear cuenta")}{" "}{provisioning.institutional_id}</h2><p>{t("La contraseña temporal se envía directamente a la función y no se almacena en React ni PostgreSQL.")}</p></div></div><label className="field"><span>{t("Contraseña temporal *")}</span><input required type="password" minLength={6} maxLength={12} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /><small>{t("Entre 6 y 12 caracteres, con mayúscula, minúscula y número.")}</small></label>{error && <p className="form-error">{error}</p>}<div className="modal-footer"><Button variant="secondary" onClick={() => { setProvisioning(null); setTemporaryPassword("") }}>{t("Cancelar")}</Button><Button type="submit">{saving ? t("Creando...") : t("Crear cuenta")}</Button></div></form></div>}
      {editing && <div className="modal-layer"><div className="modal"><div className="modal-head"><div><span className="eyebrow">{t("Perfil institucional")}</span><h2>{editing.full_name}</h2><p>{editing.institutional_id}</p>{(!editing.first_name || !editing.last_name || !editing.age) && <p>{t("Revisa la separación sugerida del nombre y completa solo los datos que conozcas.")}</p>}<p>{t("Al cambiar el rol, el prefijo del ID se ajusta automáticamente: 00 jefe, 01 biomédico, 02 usuario. Se conserva la contraseña.")}</p></div></div><div className="form-grid"><ProfilePhotoPicker file={editingPhoto} onChange={setEditingPhoto} profile={editing} onRemove={()=>setEditing({...editing,avatar_path:null})} /><label className="field"><span>{t("Nombres *")}</span><input required minLength={2} maxLength={80} value={editing.first_name || ""} onChange={e=>setEditing({...editing,first_name:e.target.value})} /></label><label className="field"><span>{t("Apellidos *")}</span><input required minLength={2} maxLength={100} value={editing.last_name || ""} onChange={e=>setEditing({...editing,last_name:e.target.value})} /></label><label className="field"><span>{t("Edad")}</span><input type="number" min={18} max={100} step={1} value={editing.age ?? ""} onChange={e=>setEditing({...editing,age:e.target.value?Number(e.target.value):null})} /></label><label className="field"><span>{t("Teléfono (opcional)")}</span><input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={editing.phone || ""} onChange={e=>setEditing({...editing,phone:e.target.value.replace(/\D/g,"").slice(0,10)})} /></label><label className="field"><span>{t("Departamento")}</span><select required value={editing.department || ""} onChange={(event) => setEditing({ ...editing, department: event.target.value || null })}><option value="">{t("Selecciona un departamento")}</option>{editing.department && !departments.includes(editing.department) && <option value={editing.department} disabled>{editing.department} · {t("Departamento actual")}</option>}{departments.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label className="field"><span>{t("Rol")}</span><select value={editing.role} onChange={(event) => setEditing({ ...editing, role: event.target.value as Profile["role"] })}><option value="usuario">{t("Usuario")}</option><option value="tecnico">{t("Ingeniero biomédico")}</option><option value="jefe">{t("Jefe")}</option></select></label><label className="field"><span>{t("Acceso a la cuenta")}</span><select value={String(editing.active)} onChange={(event) => setEditing({ ...editing, active: event.target.value === "true" })}><option value="true">{t("Habilitado")}</option><option value="false">{t("Inhabilitado")}</option></select></label><label className="field span-2"><span>{t("Motivo del cambio *")}</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><Button variant="secondary" onClick={() => setEditing(null)}>{t("Cancelar")}</Button><Button onClick={saveProfile}>{saving ? t("Guardando...") : t("Guardar cambios")}</Button></div></div></div>}
    </>
  )
}

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [profileChanges, setProfileChanges] = useState<ProfileChange[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    listAuditLog()
      .then(setEntries)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No fue posible cargar la trazabilidad.",
        ),
      )
  }, [])

  useEffect(() => {
    if (isOperationalCompletionEnabled) listProfileChangeHistory().then(setProfileChanges).catch(() => undefined)
  }, [])

  return (
    <>
      <PageIntro
        title={t("Trazabilidad")}
        description={t("Historial de movimientos recientes del sistema.")}
      />
      <section className="panel">
        {error ? (
          <QueryError message={error} />
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h3>{t("Actividad reciente")}</h3>
                <p>{t("Registros generados por cambios en usuarios, capacitaciones y cotizaciones.")}</p>
              </div>
              <History size={21} />
            </div>
            <div className="audit-list">
              {entries.map((entry) => (
                <article key={entry.id}>
                  <span className="summary-icon blue">
                    <History size={17} />
                  </span>
                  <div>
                    <strong>
                      {entry.action} · {entry.entity_type}
                    </strong>
                    <small>
                      {new Date(entry.created_at).toLocaleString("es-MX")} ·{" "}
                      {entry.entity_id || "sin identificador"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
            {entries.length === 0 && (
              <div className="empty-state">
                <h3>{t("Sin movimientos registrados")}</h3>
              </div>
            )}
          </>
        )}
      </section>
      {isOperationalCompletionEnabled && <section className="panel"><div className="panel-head"><div><h3>{t("Cambios de perfiles")}</h3><p>{t("Roles y activaciones con motivo obligatorio.")}</p></div><Users size={21} /></div><div className="audit-list">{profileChanges.map((change) => <article key={change.id}><span className="summary-icon blue"><History size={17} /></span><div><strong>{change.previous_role} → {change.new_role} · {change.previous_active ? t("activo") : t("inactivo")} → {change.new_active ? t("activo") : t("inactivo")}</strong><small>{new Date(change.changed_at).toLocaleString("es-MX")} · {change.reason}</small></div></article>)}</div>{profileChanges.length === 0 && <div className="empty-state"><h3>{t("Sin cambios de perfiles")}</h3></div>}</section>}
    </>
  )
}

function QueryError({ message }: { message: string }) {
  return (
    <div className="empty-state" role="alert">
      <AlertTriangle size={30} />
      <h3>{t("No fue posible cargar la información")}</h3>
      <p>{message}</p>
    </div>
  )
}
