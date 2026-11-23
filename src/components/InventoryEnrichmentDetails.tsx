import type { InventoryEnrichment } from "../lib/supabase"

export function InventoryEnrichmentDetails({ data }: { data?: InventoryEnrichment | null }) {
  if (!data) return null
  const problems = (data.possible_problems || "").split(/[\n\r;,]+/).map(value => value.trim()).filter(Boolean)
  return <section className="detail-section inventory-enrichment">
    <h3>Información del equipo</h3>
    <div className="inventory-enrichment-item"><h4>Periodicidad de mantenimiento</h4><p>{data.maintenance_periodicity || "No registrada"}</p>{data.periodicity_needs_review ? <span className="badge badge-warning">Revisar tareas e intervalos</span> : data.suggested_interval_months ? <span className="badge badge-neutral">Intervalo de referencia: {data.suggested_interval_months} meses</span> : null}<small>El jefe confirma la periodicidad y las fechas del mantenimiento.</small></div>
    <div className="inventory-enrichment-item inventory-problems"><h4>Posibles problemas</h4>{problems.length ? <ul>{problems.map((problem,index) => <li key={index}>{problem}</li>)}</ul> : <p>Sin problemas registrados</p>}</div>
    <div className="inventory-enrichment-item"><h4>Garantía</h4><p>{data.warranty_notes || "No registrada"}</p></div>
    <div className="inventory-enrichment-item"><h4>Referencias FDA / COFEPRIS</h4><p>{data.regulatory_notes || "Sin referencias registradas"}</p><small>No equivale a una verificación regulatoria vigente.</small></div>
  </section>
}
