import { t } from "../lib/i18n"
import { useEffect, useState } from "react"
import { ExternalLink, FileText, Search } from "lucide-react"
import { listDocumentLibrary, listEquipmentInventory, type DocumentLibraryItem, type EquipmentInventoryDetail, type Role } from "../lib/supabase"
import { Button, PageIntro } from "./ui"

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX")
}

function initial(value: string) { const first=value.trim().charAt(0).toLocaleUpperCase("es-MX"); return first==="Ñ"?"Ñ":normalize(first).toUpperCase() }

function documentUrl(value: string) {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export function DocumentsBrowser({ role }: { role: Role }) {
  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([])
  const [equipment, setEquipment] = useState<EquipmentInventoryDetail[]>([])
  const [letter, setLetter] = useState("")
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
  const filtered = equipment.filter((item) => (!letter || initial(item.hospital_area || "Sin área")===letter) && (!area || (item.hospital_area || "Sin área") === area) && normalize([item.inventory_code, item.equipment_type, item.manufacturer, item.model, item.serial_number, item.hospital_area, item.location].join(" ")).includes(term))
  const selected = filtered.find((item) => item.id === selectedId)
  const selectedDocuments = selected ? documents.filter((doc) => doc.equipmentIds.includes(selected.id)) : []
  const counts = new Map<string, number>()
  for (const doc of documents) for (const id of new Set(doc.equipmentIds)) counts.set(id, (counts.get(id) || 0) + 1)

  return <>
    <PageIntro title={t("Documentos")} description={t("Explora por área o busca un equipo para consultar sus manuales y documentos disponibles.")} />
    {loading ? <section className="panel empty-state" role="status"><h3>{t("Cargando equipos y documentos...")}</h3></section> : error ? <section className="panel empty-state"><p role="alert">{error}</p><Button onClick={() => setReload((value) => value + 1)}>{t("Reintentar")}</Button></section> : <>
      <nav className="document-alphabet" aria-label={t("Áreas por letra")}><button type="button" aria-pressed={!letter} onClick={() => { setLetter(""); setArea(""); setSelectedId("") }}>{t("Todas")}</button>{"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("").map(value => <button type="button" key={value} aria-pressed={letter===value} disabled={!areas.some(name=>initial(name)===value)} onClick={() => { setLetter(value); setArea(""); setSelectedId("") }}>{value}</button>)}</nav>
      <section className="panel">
        <div className="filter-bar">
          <label className="search-box"><Search size={18} /><input aria-label={t("Buscar equipo para documentos")} placeholder={t("Código, equipo, marca, modelo o serie...")} value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId("") }} /></label>
          <label className="inventory-select"><span>{t("Área hospitalaria")}</span><select value={area} onChange={(event) => { setLetter(""); setArea(event.target.value); setSelectedId("") }}><option value="">{t("Todas las áreas")}</option>{areas.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          {(area || search || letter) && <Button variant="secondary" onClick={() => { setLetter(""); setArea(""); setSearch(""); setSelectedId("") }}>{t("Limpiar filtros")}</Button>}
        </div>
        <div className="panel-head"><div><h3>{area || "Equipos por área"}</h3><p>{filtered.length}{" "}{t("equipos encontrados. Selecciona uno para ver sus documentos.")}</p></div></div>
        {filtered.length === 0 ? <div className="empty-state"><h3>{t("No se encontraron equipos")}</h3><p>{t("Prueba otra búsqueda o cambia el área.")}</p></div> : <div className="document-equipment-grid">{areas.filter((name) => filtered.some((item) => (item.hospital_area || "Sin área") === name)).map((name) => <section className="document-area" key={name} aria-label={name}><h4>{name}</h4>{filtered.filter((item) => (item.hospital_area || "Sin área") === name).map((item) => <button type="button" className="document-equipment" aria-pressed={selected?.id === item.id} key={item.id} onClick={() => setSelectedId(item.id)}><strong>{item.inventory_code} · {item.equipment_type}</strong><span>{item.manufacturer} · {item.model}</span><small>{item.location || "Sin ubicación específica"} · {counts.get(item.id) || 0}{" "}{t("documentos")}</small></button>)}</section>)}</div>}
      </section>
      <section className="panel" aria-live="polite">
        <div className="panel-head"><div><h3>{selected ? `Documentos de ${selected.inventory_code}` : t("Documentos del equipo")}</h3><p>{selected ? `${selected.equipment_type} · ${selected.hospital_area || "Sin área"} · ${selected.location || "Sin ubicación específica"}` : t("Selecciona un equipo de la lista anterior.")}</p></div><FileText size={21} /></div>
        {selected && (selectedDocuments.length ? <div className="document-list">{selectedDocuments.map((doc) => { const href = documentUrl(doc.url); return <article key={doc.id}><FileText size={20} /><div><strong>{doc.title || (doc.document_type === "manual_usuario" ? "Manual de usuario" : doc.document_type === "manual_servicio" ? "Manual de servicio" : "Documento")}</strong><span>{doc.document_type.replace(/_/g, " ")} · {doc.review_status}</span></div>{href ? <a href={href} target="_blank" rel="noreferrer">{t("Abrir documento")}{" "}<ExternalLink size={14} /></a> : <span className="badge badge-warning">{t("Enlace por revisar")}</span>}</article> })}</div> : <div className="empty-state"><h3>{t("Este equipo no tiene documentos vinculados")}</h3></div>)}
        {selected && selectedDocuments.length > 0 && <p className="document-link-note">{t("Los documentos abren enlaces externos; su disponibilidad depende del sitio de origen.")}</p>}
      </section>
    </>}
  </>
}
