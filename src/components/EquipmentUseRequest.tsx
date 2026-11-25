import {LoanVoucher} from "./LoanVoucher"
import {useState} from "react"
import {CalendarPlus,X} from "lucide-react"
import {requestEquipmentUse} from "../lib/generalCalendar"
import {type EquipmentInventoryDetail} from "../lib/supabase"
import {t} from "../lib/i18n"
import {Button} from "./ui"
import {EquipmentReportSelector} from "./EquipmentReportSelector"
import {EquipmentQrScanner} from "./EquipmentQrScanner"

export function EquipmentUseRequest(){
 const [open,setOpen]=useState(false),[notice,setNotice]=useState("")
 const [bookingId,setBookingId]=useState<number|null>(null)
 return <><Button className="loan-request-button" icon={CalendarPlus} onClick={()=>{setNotice("");setOpen(true)}}>{t("Solicitar equipo")}</Button>{notice && <p role="status">{notice}</p>}{open && <RequestForm onClose={()=>setOpen(false)} onSaved={id=>{setOpen(false);if(Number.isSafeInteger(id)&&id>0)setBookingId(id);setNotice(t("Solicitud registrada. Consulta el horario en Calendario → Uso de equipo."));window.dispatchEvent(new Event("biomedgest:operations-changed"))}}/>}{bookingId && <div className="modal-layer"><div className="modal loan-voucher-modal" role="dialog" aria-modal="true" aria-label={t("Vale de préstamo")}><LoanVoucher bookingId={bookingId} onClose={()=>setBookingId(null)}/></div></div>}</>
}
function RequestForm({onClose,onSaved}:{onClose:()=>void;onSaved:(id:number)=>void}){
 const [equipment,setEquipment]=useState<EquipmentInventoryDetail|null>(null),[query,setQuery]=useState("")
 const [start,setStart]=useState(""),[end,setEnd]=useState(""),[location,setLocation]=useState("")
 const [error,setError]=useState(""),[busy,setBusy]=useState(false)
 function select(item:EquipmentInventoryDetail){setEquipment(item);setQuery(item.inventory_code);setError("")}
 async function save(event:React.FormEvent){event.preventDefault();if(busy || !equipment)return;setBusy(true);setError("");try{const id=await requestEquipmentUse({equipmentId:equipment.id,start:new Date(start).toISOString(),end:new Date(end).toISOString(),location:location.trim()});onSaved(id)}catch(cause){setError(cause && typeof cause==="object" && "message" in cause?String(cause.message):t("No fue posible registrar la solicitud."))}finally{setBusy(false)}}
 return <div className="modal-layer"><section className="modal calendar-editor" role="dialog" aria-modal="true" aria-label={t("Solicitar equipo")}><div className="modal-head"><h2>{t("Solicitar equipo")}</h2><button type="button" className="icon-btn" disabled={busy} aria-label={t("Cerrar solicitud")} onClick={onClose}><X/></button></div><form onSubmit={save}><fieldset disabled={busy} className="report-edit-fields"><EquipmentReportSelector role="usuario" selected={equipment} value={query} onInputChange={value=>{setQuery(value);setEquipment(null)}} onSelect={select}/><EquipmentQrScanner role="usuario" onSelect={select}/><div className="form-grid"><label className="field"><span>{t("Inicio")}</span><input required type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="field"><span>{t("Fin")}</span><input required type="datetime-local" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label><label className="field span-2"><span>{t("Ubicación de uso")}</span><input required minLength={3} maxLength={160} value={location} onChange={e=>setLocation(e.target.value)}/></label></div></fieldset><p className="calendar-help">{t("Tu cuenta se registra como solicitante. El horario se reserva si el equipo está operativo y no coincide con otro uso o mantenimiento. No incluyas datos de pacientes.")}</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="table-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>{t("Cancelar")}</Button><Button type="submit" disabled={busy || !equipment || equipment.status!=="operativo"}>{busy?t("Guardando..."):t("Registrar solicitud")}</Button></div>{equipment && equipment.status!=="operativo" && <p role="status">{t("El equipo no está operativo y no puede reservarse.")}</p>}</form></section></div>
}
