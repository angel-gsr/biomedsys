import { t } from "../lib/i18n"
import { useEffect, useState } from "react"
import { Plus, X, Pencil } from "lucide-react"
import { archiveEquipmentAsset, equipmentAdminContext, listArchivedEquipment, restoreEquipmentAsset, saveEquipmentAsset, type ArchivedEquipment, type EquipmentAdminContext, type ManagedEquipment } from "../lib/equipmentControl"

export function InventoryEquipmentManager({ equipmentId, prominent = false, onChanged }: { equipmentId?: string; prominent?: boolean; onChanged: (id?: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [retired, setRetired] = useState<ArchivedEquipment[] | null>(null)
  const [error, setError] = useState("")
  async function loadRetired() { try { setRetired(await listArchivedEquipment()); setError("") } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar los equipos retirados.") } }
  return <div className="table-actions" onClick={(event) => event.stopPropagation()}>
    <button type="button" className={equipmentId && prominent ? "btn btn-primary equipment-edit-button" : "row-action"} onClick={() => setEditing(true)}>{equipmentId ? <><Pencil size={prominent ? 22 : 16} />{" "}{t("Editar / retirar")}</> : <><Plus size={16} />{" "}{t("Agregar equipo")}</>}</button>
    {!equipmentId && <button type="button" className="row-action" onClick={() => void loadRetired()}>{t("Equipos retirados")}</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {editing && <AssetForm id={equipmentId || null} onClose={() => setEditing(false)} onSaved={(id) => { setEditing(false); onChanged(id) }} />}
    {retired && <div className="modal-layer"><section className="modal equipment-manager" role="dialog" aria-modal="true" aria-label={t("Equipos retirados")}><div className="modal-head"><h2>{t("Equipos retirados")}</h2><button className="icon-btn" type="button" aria-label={t("Cerrar equipos retirados")} onClick={() => setRetired(null)}><X size={22} /></button></div><p>{t("Se conservan las fichas y todo su historial. Al restaurarlos vuelven a Sin confirmar.")}</p>{!retired.length && <p>{t("No hay equipos retirados.")}</p>}{retired.map((item) => <RestoreCard key={item.id} item={item} onRestored={() => { void loadRetired(); onChanged() }} />)}</section></div>}
  </div>
}

function RestoreCard({ item, onRestored }: { item: ArchivedEquipment; onRestored: () => void }) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  return <form className="inventory-enrichment-item" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(""); try { await restoreEquipmentAsset(item.id,reason); onRestored() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible restaurar.") } finally { setBusy(false) } }}><strong>{item.inventory_code} · {item.equipment_type}</strong><p>{item.archive_reason}</p><label className="field"><span>{t("Motivo de restauración")}</span><input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="row-action" type="submit" disabled={busy}>{t("Restaurar equipo")}</button></form>
}

function AssetForm({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const [context, setContext] = useState<EquipmentAdminContext | null>(null)
  const [asset, setAsset] = useState<ManagedEquipment | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => { let active = true; equipmentAdminContext(id).then((data) => { if (active) { setContext(data); setAsset(data.asset || { equipment_type: "", manufacturer: "", model: "", serial_number: null, manufacture_year: null, acquisition_year: null, hospital_area_id: data.areas[0]?.id || 0, location_id: null, custodian_location_text: null, status: "desconocido" }) } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No fue posible cargar el equipo.") }); return () => { active = false } },[id])
  const number = (value: string) => value ? Number(value) : null
  async function save(e: React.FormEvent) { e.preventDefault(); if (!asset || busy) return; setBusy(true); setError(""); try { const saved = await saveEquipmentAsset(id,asset,reason); onSaved(saved) } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar.") } finally { setBusy(false) } }
  return <div className="modal-layer"><section className="modal equipment-manager" role="dialog" aria-modal="true" aria-label={id ? t("Editar equipo") : t("Agregar equipo")}><div className="modal-head"><div><h2>{id ? t("Editar equipo") : t("Agregar equipo")}</h2><p>{asset?.inventory_code || "El código de inventario se asignará automáticamente."}</p></div><button type="button" className="icon-btn" aria-label={t("Cerrar administración del equipo")} onClick={onClose}><X size={22} /></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!asset || !context ? <p role="status">{t("Cargando formulario...")}</p> : <form onSubmit={save}><fieldset disabled={busy} className="report-edit-fields"><div className="form-grid">
      <label className="field"><span>{t("Nombre / tipo de equipo")}</span><input required value={asset.equipment_type} onChange={(e) => setAsset({ ...asset,equipment_type:e.target.value })} /></label>
      <label className="field"><span>{t("Fabricante / marca")}</span><input required value={asset.manufacturer} onChange={(e) => setAsset({ ...asset,manufacturer:e.target.value })} /></label>
      <label className="field"><span>{t("Modelo")}</span><input required value={asset.model} onChange={(e) => setAsset({ ...asset,model:e.target.value })} /></label>
      <label className="field"><span>{t("Número de serie")}</span><input value={asset.serial_number || ""} onChange={(e) => setAsset({ ...asset,serial_number:e.target.value || null })} /></label>
      <label className="field"><span>{t("Año de fabricación")}</span><input type="number" min={1950} max={2100} value={asset.manufacture_year || ""} onChange={(e) => setAsset({ ...asset,manufacture_year:number(e.target.value) })} /></label>
      <label className="field"><span>{t("Año de adquisición")}</span><input type="number" min={1950} max={2100} value={asset.acquisition_year || ""} onChange={(e) => setAsset({ ...asset,acquisition_year:number(e.target.value) })} /></label>
      <label className="field"><span>{t("Área del equipo")}</span><select required value={asset.hospital_area_id || ""} onChange={(e) => setAsset({ ...asset,hospital_area_id:Number(e.target.value),location_id:null })}><option value="" disabled>{t("Selecciona un área")}</option>{context.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field"><span>{t("Ubicación específica")}</span><select value={asset.location_id || ""} onChange={(e) => setAsset({ ...asset,location_id:number(e.target.value) })}><option value="">{t("Sin ubicación específica")}</option>{context.locations.filter((item) => item.hospital_area_id===asset.hospital_area_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field"><span>{t("Estado operativo")}</span><select value={asset.status} onChange={(e) => setAsset({ ...asset,status:e.target.value as ManagedEquipment["status"] })}><option value="desconocido">{t("Sin confirmar")}</option><option value="operativo">{t("Operativo")}</option><option value="en_reparacion">{t("En reparación")}</option><option value="fuera_de_servicio">{t("Fuera de servicio")}</option><option value="baja">{t("Baja")}</option></select></label>
      <label className="field"><span>{t("Resguardo")}</span><input value={asset.custodian_location_text || ""} onChange={(e) => setAsset({ ...asset,custodian_location_text:e.target.value || null })} /></label>
      <label className="check-inline"><input type="checkbox" checked={asset.serial_is_placeholder || false} onChange={(e) => setAsset({ ...asset,serial_is_placeholder:e.target.checked })} />{" "}{t("Serie provisional / pendiente")}</label>
      <label className="field span-2"><span>{t("Motivo del alta, edición o retiro")}</span><textarea required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    </div><div className="table-actions"><button type="submit" className="btn btn-primary">{busy ? t("Guardando...") : t("Guardar equipo")}</button>{id && <button type="button" className="btn btn-danger" onClick={async () => { if (reason.trim().length<3) { setError("Indica el motivo del retiro."); return } if (!window.confirm(`¿Retirar ${asset.inventory_code} del inventario activo? Sus reportes e historial se conservarán.`)) return; setBusy(true); setError(""); try { await archiveEquipmentAsset(id,reason); onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible retirar.") } finally { setBusy(false) } }}>{t("Retirar del inventario")}</button>}<button type="button" className="btn btn-secondary" onClick={onClose}>{t("Cancelar")}</button></div></fieldset>{id && <p>{t("El retiro oculta el equipo de las búsquedas activas y conserva sus documentos, reportes y mantenimientos.")}</p>}</form>}
  </section></div>
}
