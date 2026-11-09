import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { createReportPdf, editReportIncident, getReportPreview, remainingEditSeconds, type IncidentChanges, type ReportPreviewData } from "../lib/reportManagement"
import { Button } from "./ui"

export function ReportPreview({ reportId, onClose, onChanged }: { reportId: number; onClose: () => void; onChanged: () => void }) {
  const [preview, setPreview] = useState<ReportPreviewData | null>(null)
  const [error, setError] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdfUrl, setPdfUrl] = useState("")
  const [changes, setChanges] = useState<IncidentChanges | null>(null)
  const anchor = useRef(0)
  const alive = useRef(true)
  const pdfReference = useRef("")
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    getReportPreview(reportId).then((data) => { if (active) { anchor.current = performance.now(); setElapsed(0); setPreview(data); setError("") } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No fue posible consultar el reporte.") })
    return () => { active = false }
  }, [reportId, reload])
  useEffect(() => { const timer = setInterval(() => setElapsed(performance.now() - anchor.current), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (pdfReference.current) URL.revokeObjectURL(pdfReference.current) } }, [])
  const seconds = preview ? remainingEditSeconds(preview, elapsed) : 0
  const report = preview?.report
  function clearPdf() { if (pdfReference.current) URL.revokeObjectURL(pdfReference.current); pdfReference.current = ""; setPdfUrl("") }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!report || !changes || !seconds || busy) return
    setBusy(true); setError("")
    try { await editReportIncident(report, changes); clearPdf(); setEditing(false); setReload((v) => v + 1); onChanged(); window.dispatchEvent(new Event("biomedgest:reports-changed")) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar."); setReload((v) => v + 1) }
    finally { setBusy(false) }
  }
  async function previewPdf() {
    if (!report || busy) return
    setBusy(true); setError("")
    try {
      const latest = await getReportPreview(report.id)
      if (!alive.current) return
      anchor.current = performance.now(); setElapsed(0); setPreview(latest)
      const blob = await createReportPdf(latest.report)
      if (!alive.current) return
      clearPdf(); const url = URL.createObjectURL(blob); pdfReference.current = url; setPdfUrl(url)
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "No fue posible generar el PDF.") }
    finally { if (alive.current) setBusy(false) }
  }
  return <div className="modal-layer"><div className="modal report-preview" role="dialog" aria-modal="true" aria-label="Vista previa del reporte" onKeyDown={(event) => { if (event.key === "Escape") onClose() }}>
    <div className="modal-head"><div><span className="eyebrow">Vista previa</span><h2>{report?.report_number || "Cargando reporte..."}</h2></div><button className="icon-btn" type="button" aria-label="Cerrar vista previa" onClick={onClose}><X size={21} /></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {report && <>
      <dl className="report-preview-data">
        {Object.entries({ Equipo: report.equipment_snapshot?.equipment_type || report.equipment_identifier, Inventario: report.equipment_identifier, Fabricante: report.manufacturer, Modelo: report.equipment_snapshot?.model, Serie: report.equipment_snapshot?.serial_number, "Modelo / serie registrado": report.model_serial, Área: report.service, "Ubicación al reportar": report.location, "Fecha del evento": report.event_date, "Tipo de incidente": report.event_type, Descripción: report.description, "Resultado para el paciente": report.patient_outcome, "Acción tomada": report.action_taken, Estado: report.status, "Creado": new Date(report.created_at).toLocaleString("es-MX") }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "No registrado"}</dd></div>)}
      </dl>
      <p role="status">{seconds ? `Puedes corregir el incidente durante ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} más. Los datos del equipo están bloqueados.` : "Edición cerrada. El reporte conserva sus datos; el seguimiento técnico continúa por separado."}</p>
      {!editing && seconds > 0 && <Button variant="secondary" onClick={() => { setChanges({ event_date: report.event_date, event_type: report.event_type, description: report.description, patient_outcome: report.patient_outcome, action_taken: report.action_taken }); clearPdf(); setEditing(true) }}>Corregir incidente</Button>}
      {editing && changes && <form onSubmit={save}>
        <fieldset disabled={!seconds || busy} className="report-edit-fields">
          <label className="field"><span>Fecha del evento</span><input required type="date" value={changes.event_date} onChange={(e) => setChanges({ ...changes, event_date: e.target.value })} /></label>
          <label className="field"><span>Tipo de incidente</span><input required value={changes.event_type} onChange={(e) => setChanges({ ...changes, event_type: e.target.value })} /></label>
          <label className="field"><span>Descripción del incidente</span><textarea required value={changes.description} onChange={(e) => setChanges({ ...changes, description: e.target.value })} /></label>
          <label className="field"><span>Resultado para el paciente</span><input value={changes.patient_outcome || ""} onChange={(e) => setChanges({ ...changes, patient_outcome: e.target.value })} /></label>
          <label className="field"><span>Acción tomada</span><input value={changes.action_taken || ""} onChange={(e) => setChanges({ ...changes, action_taken: e.target.value })} /></label>
          <Button type="submit">{busy ? "Guardando..." : "Guardar corrección"}</Button>
        </fieldset><Button variant="secondary" onClick={() => setEditing(false)}>Cerrar edición</Button>
      </form>}
      {!editing && <div className="qr-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={previewPdf}>{busy ? "Preparando..." : "Vista previa PDF"}</button>{pdfUrl && <><a className="btn btn-secondary" href={pdfUrl} target="_blank" rel="noreferrer">Abrir PDF</a><a className="btn btn-secondary" href={pdfUrl} download={`${report.report_number}.pdf`}>Descargar PDF</a></>}</div>}
      {pdfUrl && <iframe className="report-pdf-preview" title="Vista previa PDF del reporte" src={pdfUrl} />}
    </>}
  </div></div>
}
