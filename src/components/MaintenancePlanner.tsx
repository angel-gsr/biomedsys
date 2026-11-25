import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { t } from "../lib/i18n"
import { generalCalendarOptions, saveGeneralCalendarEvent, type CalendarOptions } from "../lib/generalCalendar"
import { type EquipmentInventoryDetail } from "../lib/supabase"
import { EquipmentReportSelector } from "./EquipmentReportSelector"
import { EquipmentQrScanner } from "./EquipmentQrScanner"
import { Button } from "./ui"

export function MaintenancePlanner({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}) {
  const [options,setOptions]=useState<CalendarOptions|null>(null)
  const [equipment,setEquipment]=useState<EquipmentInventoryDetail|null>(null)
  const [query,setQuery]=useState("")
  const [program,setProgram]=useState("")
  const [assignee,setAssignee]=useState("")
  const [start,setStart]=useState("")
  const [end,setEnd]=useState("")
  const [location,setLocation]=useState("")
  const [error,setError]=useState("")
  const [busy,setBusy]=useState(false)
  useEffect(()=>{generalCalendarOptions().then(setOptions).catch(cause=>setError(cause.message))},[])
  function select(item:EquipmentInventoryDetail){setEquipment(item);setQuery(item.inventory_code);setProgram("")}
  async function save(event:React.FormEvent){
    event.preventDefault();if(busy || !equipment || !program || !assignee)return
    setBusy(true);setError("")
    try{await saveGeneralCalendarEvent({key:null,kind:"mantenimiento",title:"",start:new Date(start).toISOString(),end:new Date(end).toISOString(),locationId:location?Number(location):null,equipmentIds:[equipment.id],programId:Number(program),assigneeId:assignee});window.dispatchEvent(new Event("biomedgest:operations-changed"));onSaved()}
    catch(cause){setError(cause instanceof Error?cause.message:"No fue posible programar el mantenimiento.")}finally{setBusy(false)}
  }
  return <div className="modal-layer"><section className="modal calendar-editor" role="dialog" aria-modal="true" aria-label={t("Programar mantenimiento")}><div className="modal-head"><h2>{t("Programar mantenimiento")}</h2><button type="button" className="icon-btn" aria-label={t("Cerrar")} onClick={onClose}><X/></button></div><form onSubmit={save}>
    <EquipmentReportSelector role="jefe" value={query} selected={equipment} onInputChange={value=>{setQuery(value);setEquipment(null);setProgram("")}} onSelect={select}/><EquipmentQrScanner role="jefe" onSelect={select}/>
    {equipment && <p>{equipment.inventory_code} · {equipment.equipment_type} · {equipment.model}</p>}
    <div className="form-grid"><label className="field"><span>{t("Rutina preventiva")}</span><select required value={program} onChange={e=>setProgram(e.target.value)}><option value="">{t("Selecciona una rutina vinculada")}</option>{options?.programs.filter(item=>item.equipment_id===equipment?.id).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{equipment && options && !options.programs.some(item=>item.equipment_id===equipment.id) && <small>{t("Este equipo no tiene una rutina preventiva vinculada.")}</small>}</label>
    <label className="field"><span>{t("Técnico asignado")}</span><select required value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">{t("Seleccionar")}</option>{options?.technicians.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="field"><span>{t("Inicio")}</span><input required type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="field"><span>{t("Fin")}</span><input required type="datetime-local" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>
    <label className="field span-2"><span>{t("Sala / ubicación ocupada")}</span><select value={location} onChange={e=>setLocation(e.target.value)}><option value="">{t("Sin sala específica")}</option>{options?.locations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <p className="calendar-help">{t("Se crea una orden preventiva. El equipo, responsable y horario aparecerán en el calendario de todos los perfiles.")}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="table-actions"><Button variant="secondary" onClick={onClose}>{t("Cancelar")}</Button><Button type="submit" disabled={busy || !equipment || !program || !assignee}>{busy?t("Guardando..."):t("Programar mantenimiento")}</Button></div>
  </form></section></div>
}
