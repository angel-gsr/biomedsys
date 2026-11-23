import type { InventoryEnrichment } from "../lib/supabase"

export function InventoryEnrichmentDetails({ data }: { data?: InventoryEnrichment | null }) {
  if (!data) return null
  return <section className="detail-section inventory-enrichment">
    <h3>Información ampliada del inventario</h3>
    <p className="inventory-enrichment-source">Fuente: {data.source?.source_file || "Inventario actualizado"} · Hoja1, fila {data.source_row}</p>
    <div className="inventory-enrichment-item"><h4>Periodicidad de mantenimiento</h4><p>{data.maintenance_periodicity || "No registrada"}</p>{data.periodicity_needs_review ? <span className="badge badge-warning">Requiere revisar tareas, horas o intervalos múltiples</span> : data.suggested_interval_months ? <span className="badge badge-neutral">Intervalo del archivo: {data.suggested_interval_months} meses</span> : null}<small>El jefe confirma la configuración de mantenimiento y sus fechas de referencia por separado.</small></div>
    <div className="inventory-enrichment-item"><h4>Posibles problemas</h4><p>{data.possible_problems || "Sin información en el archivo"}</p></div>
    <div className={`inventory-enrichment-item ${data.decommission_notes ? "inventory-enrichment-warning" : ""}`}><h4>Baja / sustitución</h4><p>{data.decommission_notes || "Sin indicación en el archivo"}</p>{data.decommission_notes && <small>Recomendación registrada; el estado operativo del equipo se gestiona por separado.</small>}</div>
    <div className="inventory-enrichment-item"><h4>Garantía</h4><p>{data.warranty_notes || "Sin información en el archivo"}</p></div>
    <div className="inventory-enrichment-item"><h4>Referencias FDA / COFEPRIS</h4><p>{data.regulatory_notes || "Sin información en el archivo"}</p><small>Texto del inventario proporcionado. No equivale a una verificación regulatoria vigente.</small></div>
  </section>
}
