import { useEffect, useState } from "react"
import { ExternalLink, FileText, Search } from "lucide-react"
import { listDocumentLibrary, listEquipmentInventory, type DocumentLibraryItem, type EquipmentInventoryDetail, type Role } from "../lib/supabase"
import { Button, PageIntro } from "./ui"

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX")
}

function documentUrl(value: string) {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export function DocumentsBrowser({ role }: { role: Role }) {
  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([])
  const [equipment, setEquipment] = useState<EquipmentInventoryDetail[]>([])
  const [area, setArea] = useState("")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    Promise.all([listDocumentLibrary(), listEquipmentInventory(role)])
      .then(([docs, assets]) => { if (active) { setDocuments(docs); setEquipment(assets) } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No fue posible consultar los documentos.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [role, reload])

  const areas = [...new Set(equipment.map((item) => item.hospital_area || "Sin área"))].sort((a, b) => a.localeCompare(b, "es"))
  const term = normalize(search.trim())
  const filtered = equipment.filter((item) => (!area || (item.hospital_area || "Sin área") === area) && normalize([item.inventory_code, item.equipment_type, item.manufacturer, item.model, item.serial_number, item.hospital_area, item.location].join(" ")).includes(term))
  const selected = filtered.find((item) => item.id === selectedId)
  const selectedDocuments = selected ? documents.filter((doc) => doc.equipmentIds.includes(selected.id)) : []
  const counts = new Map<string, number>()
  for (const doc of documents) for (const id of new Set(doc.equipmentIds)) counts.set(id, (counts.get(id) || 0) + 1)

  return <>
    <PageIntro title="Documentos" description="Explora por área o busca un equipo para consultar sus manuales y documentos disponibles." />
    {loading ? <section className="panel empty-state" role="status"><h3>Cargando equipos y documentos...</h3></section> : error ? <section className="panel empty-state"><p role="alert">{error}</p><Button onClick={() => setReload((value) => value + 1)}>Reintentar</Button></section> : <>
      <section className="panel">
        <div className="filter-bar">
          <label className="search-box"><Search size={18} /><input aria-label="Buscar equipo para documentos" placeholder="Código, equipo, marca, modelo o serie..." value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId("") }} /></label>
          <label className="inventory-select"><span>Área hospitalaria</span><select value={area} onChange={(event) => { setArea(event.target.value); setSelectedId("") }}><option value="">Todas las áreas</option>{areas.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          {(area || search) && <Button variant="secondary" onClick={() => { setArea(""); setSearch(""); setSelectedId("") }}>Limpiar filtros</Button>}
        </div>
        <div className="panel-head"><div><h3>{area || "Equipos por área"}</h3><p>{filtered.length} equipos encontrados. Selecciona uno para ver sus documentos.</p></div></div>
        {filtered.length === 0 ? <div className="empty-state"><h3>No se encontraron equipos</h3><p>Prueba otra búsqueda o cambia el área.</p></div> : <div className="document-equipment-grid">{areas.filter((name) => filtered.some((item) => (item.hospital_area || "Sin área") === name)).map((name) => <section className="document-area" key={name} aria-label={name}><h4>{name}</h4>{filtered.filter((item) => (item.hospital_area || "Sin área") === name).map((item) => <button type="button" className="document-equipment" aria-pressed={selected?.id === item.id} key={item.id} onClick={() => setSelectedId(item.id)}><strong>{item.inventory_code} · {item.equipment_type}</strong><span>{item.manufacturer} · {item.model}</span><small>{item.location || "Sin ubicación específica"} · {counts.get(item.id) || 0} documentos</small></button>)}</section>)}</div>}
      </section>
      <section className="panel" aria-live="polite">
        <div className="panel-head"><div><h3>{selected ? `Documentos de ${selected.inventory_code}` : "Documentos del equipo"}</h3><p>{selected ? `${selected.equipment_type} · ${selected.hospital_area || "Sin área"} · ${selected.location || "Sin ubicación específica"}` : "Selecciona un equipo de la lista anterior."}</p></div><FileText size={21} /></div>
        {selected && (selectedDocuments.length ? <div className="document-list">{selectedDocuments.map((doc) => { const href = documentUrl(doc.url); return <article key={doc.id}><FileText size={20} /><div><strong>{doc.title || (doc.document_type === "manual_usuario" ? "Manual de usuario" : doc.document_type === "manual_servicio" ? "Manual de servicio" : "Documento")}</strong><span>{doc.document_type.replace(/_/g, " ")} · {doc.review_status}</span></div>{href ? <a href={href} target="_blank" rel="noreferrer">Abrir documento <ExternalLink size={14} /></a> : <span className="badge badge-warning">Enlace por revisar</span>}</article> })}</div> : <div className="empty-state"><h3>Este equipo no tiene documentos vinculados</h3></div>)}
        {selected && selectedDocuments.length > 0 && <p className="document-link-note">Los documentos abren enlaces externos; su disponibilidad depende del sitio de origen.</p>}
      </section>
    </>}
  </>
}
