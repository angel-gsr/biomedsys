import { t } from "../lib/i18n"
import { EquipmentUseRequest } from "./EquipmentUseRequest"
import { EquipmentQrScanner } from "./EquipmentQrScanner";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Download,
  FileText,
  MonitorCog,
  PackageOpen,
  RefreshCw,
  QrCode,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button, PageIntro } from "./ui";
import { InventoryAdministration, inventoryIssueLabel, inventoryIssueDescription } from "./InventoryAdministration";
import {
  getEquipmentInventoryBundle,
  getInventoryCapabilities,
  getEquipmentActivity,
  isBusinessCompletionEnabled,
  isOperationalCompletionEnabled,
  isSupabaseConfigured,
  listEquipmentInventory,
  type EquipmentInventoryBundle,
  type EquipmentInventoryDetail,
  type InventoryFilters,
  type RiskLevel,
  type Role,
  type ActivityTimelineEntry,
} from "../lib/supabase";
import { PrivateAttachmentPanel } from "./PrivateAttachmentPanel";
import { InventoryEnrichmentDetails } from "./InventoryEnrichmentDetails";
import { InventoryEquipmentManager } from "./InventoryEquipmentManager";

const PAGE_SIZE = 20;

const statusLabels: Record<EquipmentInventoryDetail["status"], string> = {
  operativo: "Operativo",
  en_reparacion: "En reparación",
  fuera_de_servicio: "Fuera de servicio",
  baja: "Baja",
  desconocido: "Sin confirmar",
};

const riskLabels: Record<RiskLevel, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

function statusTone(status: EquipmentInventoryDetail["status"]) {
  if (status === "operativo") return "success";
  if (status === "en_reparacion" || status === "desconocido") return "warning";
  return "danger";
}

function riskTone(risk: RiskLevel | null) {
  if (risk === "bajo") return "success";
  if (risk === "medio") return "warning";
  if (risk === "alto") return "danger";
  return "neutral";
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{typeof children === "string" ? t(children) : children}</span>;
}

function PendingConfiguration() {
  return (
    <section className="panel empty-state inventory-message" role="status">
      <ShieldCheck size={38} />
      <h3>{t("Conexión con Supabase pendiente")}</h3>
      <p>{t("El inventario está preparado para datos reales, pero todavía faltan")}<code>{" "}{t("VITE_SUPABASE_URL")}</code> y <code>{t("VITE_SUPABASE_ANON_KEY")}</code>{" "}{t("en")}{" "}<code>{t(".env.local")}</code>.
      </p>
    </section>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <section className="panel empty-state inventory-message" aria-busy="true" aria-live="polite">
      <RefreshCw className="spin" size={34} />
      <h3>{message}</h3>
      <p>{t("La información se consulta respetando los permisos de tu sesión.")}</p>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="panel empty-state inventory-message" role="alert">
      <AlertTriangle size={38} />
      <h3>{t("No fue posible consultar el inventario")}</h3>
      <p>{message}</p>
      <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>{t("Reintentar")}</Button>
    </section>
  );
}

export type InventoryApi = {
  list: typeof listEquipmentInventory;
  getBundle: typeof getEquipmentInventoryBundle;
};

const defaultInventoryApi: InventoryApi = {
  list: listEquipmentInventory,
  getBundle: getEquipmentInventoryBundle,
};

export function Inventory({
  role,
  onSelectEquipment,
  api = defaultInventoryApi,
  configured = isSupabaseConfigured,
}: {
  role: Role;
  onSelectEquipment: (equipmentId: string) => void;
  api?: InventoryApi;
  configured?: boolean;
}) {
  const capabilities = getInventoryCapabilities(role);
  const [searchTerm, setSearchTerm] = useState("");
  const [hospitalArea, setHospitalArea] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "">("");
  const [equipment, setEquipment] = useState<EquipmentInventoryDetail[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (!configured) return;
    const refresh = () => setReloadToken((value) => value + 1);
    window.addEventListener("biomedgest:reports-changed", refresh);
    window.addEventListener("biomedgest:inventory-changed", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => { window.removeEventListener("biomedgest:reports-changed", refresh); window.removeEventListener("biomedgest:inventory-changed", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const filters: InventoryFilters = {
        searchTerm,
        hospitalArea,
        riskLevel: capabilities.canViewRisk ? riskLevel : "",
      };
      api.list(role, filters)
        .then((items) => {
          if (!active) return;
          setEquipment(items);
          setAreas((current) => Array.from(new Set([
            ...current,
            ...items.map((item) => item.hospital_area).filter((area): area is string => Boolean(area)),
          ])).sort((left, right) => left.localeCompare(right, "es")));
          setPage(1);
        })
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : "Error de consulta no identificado.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, capabilities.canViewRisk, configured, hospitalArea, reloadToken, riskLevel, role, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(equipment.length / PAGE_SIZE));
  const visibleEquipment = useMemo(
    () => equipment.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [equipment, page],
  );

  return (
    <>
      <PageIntro
        title={role === "usuario" ? t("Consultar equipo") : t("Inventario de activos")}
        action={configured && role === "usuario" ? <EquipmentUseRequest/> : role === "jefe" && configured ? <InventoryEquipmentManager onChanged={() => setReloadToken((value) => value + 1)} /> : undefined}
        description={role === "usuario"
          ? t("Consulta disponibilidad, identificación y ubicación sin exponer datos técnicos restringidos.")
          : t("Consulta los equipos médicos, su riesgo y la información técnica validada.")}
      />
      {!configured ? <PendingConfiguration /> : (
        <section className="panel inventory-panel">
          <div className="filter-bar" aria-label={t("Filtros de inventario")}>
            <EquipmentQrScanner role={role} onSelect={(item) => onSelectEquipment(item.id)} />
            <label className="search-box">
              <Search size={17} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("Código, equipo, fabricante o modelo")}
                aria-label={t("Buscar equipo")}
              />
            </label>
            <label className="inventory-select">
              <span>{t("Área")}</span>
              <select value={hospitalArea} onChange={(event) => setHospitalArea(event.target.value)}>
                <option value="">{t("Todas las áreas")}</option>
                {areas.map((area) => <option key={area}>{area}</option>)}
              </select>
            </label>
            {capabilities.canViewRisk && (
              <label className="inventory-select">
                <span>{t("Riesgo")}</span>
                <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as RiskLevel | "")}>
                  <option value="">{t("Todos los niveles")}</option>
                  <option value="alto">{t("Alto")}</option>
                  <option value="medio">{t("Medio")}</option>
                  <option value="bajo">{t("Bajo")}</option>
                </select>
              </label>
            )}
          </div>

          {loading ? <LoadingState message="Consultando equipos..." /> : error ? (
            <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
          ) : equipment.length === 0 ? (
            <div className="empty-state inventory-inline-empty">
              <PackageOpen size={34} />
              <h3>{t("No hay equipos para mostrar")}</h3>
              <p>{t("Prueba con otros criterios de búsqueda o registra un equipo.")}</p>
            </div>
          ) : (
            <>
              <div className="table-wrap inventory-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Código")}</th><th>{t("Equipo")}</th><th>{t("Fabricante / modelo")}</th><th>{t("Área / ubicación")}</th>
                      {capabilities.canViewRisk && <th>{t("Riesgo")}</th>}<th>{t("Estado")}</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEquipment.map((item) => (
                      <tr key={item.id} onClick={() => onSelectEquipment(item.id)}>
                        <td><strong className="order-id">{item.inventory_code}</strong></td>
                        <td><strong>{item.equipment_type}</strong></td>
                        <td><strong>{item.manufacturer}</strong><small>{item.model}</small></td>
                        <td><strong>{item.hospital_area || "Sin área"}</strong><small>{item.location || "Sin ubicación específica"}</small></td>
                        {capabilities.canViewRisk && (
                          <td><Badge tone={riskTone(item.current_risk_category)}>{item.current_risk_category ? riskLabels[item.current_risk_category] : t("Sin evaluación")}</Badge></td>
                        )}
                        <td><Badge tone={statusTone(item.status)}>{statusLabels[item.status]}</Badge></td>
                        <td><div className="table-actions"><button type="button" className="row-action" aria-label={`Abrir ficha ${item.inventory_code}`}>{t("Ver ficha")}</button>{role === "jefe" && <InventoryEquipmentManager equipmentId={item.id} onChanged={() => setReloadToken((value) => value + 1)} />}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>{equipment.length}{" "}{t("equipo")}{equipment.length === 1 ? "" : "s"}{" "}{t("encontrado")}{equipment.length === 1 ? "" : "s"}</span>
                <div>
                  <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t("Anterior")}</button>
                  <button className="current">{page} / {totalPages}</button>
                  <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t("Siguiente")}</button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}

function safeDocumentUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function DetailContent({ bundle, role, onChanged }: { bundle: EquipmentInventoryBundle; role: Role; onChanged: () => void }) {
  const { equipment, risks, documents, programs, issues, restricted } = bundle;
  const currentRisk = risks[0];
  const pendingIssues = issues.filter(issue => {
    if (issue.review_status !== "pendiente") return false;
    if (issue.issue_code === "missing_specific_location" && equipment.location) return false;
    if (issue.issue_code === "maintenance_periodicity_missing" && programs.length && programs.every(program => program.interval_months)) return false;
    return true;
  });
  function downloadRoutine(program: typeof programs[number]) {
    const tasks = program.procedure_text.split(/\r?\n|;/).map(task => task.trim()).filter(Boolean);
    const text = ["HOJA DE MANTENIMIENTO", `${equipment.inventory_code} - ${equipment.equipment_type}`, `Modelo: ${equipment.model}`, `Serie: ${equipment.serial_number || "No registrada"}`, `Rutina: ${program.name}`, program.interval_months ? `Periodicidad: cada ${program.interval_months} meses` : "Periodicidad: pendiente de confirmar", "", "Fecha: __________________  Responsable: __________________", "", ...tasks.map(task => `[ ] ${task}`), "", "Observaciones:", "________________________________________________________", "Firma: __________________"].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${equipment.inventory_code}-rutina-${program.id}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <section className="equipment-head">
        <div className="equipment-icon"><MonitorCog size={28} /></div>
        <div className="equipment-title">
          <div>
            <Badge tone={statusTone(equipment.status)}>{statusLabels[equipment.status]}</Badge>
            <span>{equipment.inventory_code}</span>
            {equipment.requires_review && <Badge tone="warning">{t("Revisión pendiente")}</Badge>}
          </div>
          <h2>{equipment.equipment_type}</h2>
          <p>{equipment.manufacturer} · {equipment.model} · {equipment.hospital_area || "Área no especificada"}</p>
        </div>
      </section>

      {restricted && (
        <div className="inventory-access-note">
          <ShieldCheck size={20} />
          <div><strong>{t("Ficha clínica limitada")}</strong><span>{t("Los datos técnicos, riesgos, manuales y rutinas están disponibles únicamente para Ingeniería Clínica.")}</span></div>
        </div>
      )}

      <div className="equipment-layout inventory-detail-layout">
        <section className="panel detail-main">
          <div className="detail-section">
            <h3>{t("Identificación del equipo")}</h3>
            <div className="data-grid">
              {[
                ["Fabricante", equipment.manufacturer],
                ["Modelo", equipment.model],
                ["Número de serie", equipment.serial_number || "Restringido o no registrado"],
                ["No. de inventario", equipment.inventory_code],
                ["Tipo de equipo", equipment.equipment_type],
                ["Estado", statusLabels[equipment.status]],
                ["Año de fabricación", equipment.manufacture_year?.toString() || "No registrado"],
                ["Año de adquisición", equipment.acquisition_year?.toString() || "No registrado"],
              ].map(([label, value]) => <div key={label}><span>{t(label!)}</span><strong>{value}</strong></div>)}
            </div>
          </div>
          <div className="detail-section">
            <h3>{t("Ubicación")}</h3>
            <div className="data-grid">
              <div><span>{t("Área hospitalaria")}</span><strong>{equipment.hospital_area || "No registrada"}</strong></div>
              <div><span>{t("Ubicación específica")}</span><strong>{equipment.location || "No registrada"}</strong></div>
              <div><span>{t("Resguardo del equipo")}</span><strong>{equipment.custodian_location_text || "No registrado"}</strong></div>
            </div>
          </div>

          {!restricted && (
            <>
              <InventoryEnrichmentDetails data={bundle.enrichment} />
              <div className="detail-section">
                <h3>{t("Evaluación de riesgo")}</h3>
                {!currentRisk ? <p className="detail-empty">{t("No existe una evaluación de riesgo visible.")}</p> : (
                  <div className="risk-summary">
                    <Badge tone={riskTone(currentRisk.category)}>{riskLabels[currentRisk.category]}</Badge>
                    <strong>{currentRisk.total_score}{" "}{t("puntos")}</strong>
                    <span>{t("Función")}{" "}{currentRisk.function_score}{" "}{t("· Aplicación clínica")}{" "}{currentRisk.clinical_application_score}{" "}{t("· Mantenimiento")}{" "}{currentRisk.maintenance_requirement_score}</span>
                    <small>{currentRisk.methodology_name} · {currentRisk.methodology_version}</small>
                  </div>
                )}
              </div>
              <div className="detail-section">
                <h3>{t("Manuales y documentos")}</h3>
                {documents.length === 0 ? <p className="detail-empty">{t("No hay documentos vinculados.")}</p> : (
                  <div className="document-list">
                    {documents.map((document) => {
                      const href = safeDocumentUrl(document.url);
                      return (
                        <article key={document.id}>
                          <FileText size={20} />
                          <div><strong>{document.title || (document.document_type === "manual_usuario" ? "Manual de usuario" : "Manual de servicio")}</strong><span>{document.document_type.replace(/_/g, " ")}{" "}{t("· Vínculo registrado ·")}{" "}{document.review_status}</span></div>
                          {href ? <a href={href} target="_blank" rel="noreferrer" title={t("Abrir el vínculo registrado; la disponibilidad del archivo depende del sitio externo")}>{t("Abrir vínculo")}{" "}<ExternalLink size={14} /></a> : <Badge tone="warning">{t("Enlace por revisar")}</Badge>}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="detail-section">
                <h3>{t("Rutinas de mantenimiento")}</h3>
                {programs.length === 0 ? <p className="detail-empty">{t("No hay rutinas vinculadas.")}</p> : (
                  <div className="program-list">
                    {programs.map((program) => (
                      <article className="maintenance-routine-card" key={program.id}>
                        <button type="button" className="row-action routine-download" aria-label={`Descargar checklist: ${program.name}`} title={t("Descargar checklist TXT")} onClick={() => downloadRoutine(program)}><Download size={18} /></button>
                        <div className="routine-heading"><Wrench size={18} /><strong>{program.name}</strong>{program.requires_review && <Badge tone="warning">{t("Revisión pendiente")}</Badge>}</div>
                        <p>{program.procedure_text}</p>
                        <span>{program.interval_months ? `Cada ${program.interval_months} meses` : t("Periodicidad pendiente de definición")}</span>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="detail-aside">
          <EquipmentQr equipmentId={equipment.id} inventoryCode={equipment.inventory_code} />
          {isOperationalCompletionEnabled && role !== "usuario" && <PrivateAttachmentPanel relation={{ equipmentId: equipment.id }} title={t("Archivos privados del equipo")} />}
          {isBusinessCompletionEnabled && role !== "usuario" && <EquipmentTimeline equipmentId={equipment.id} />}
          <section className="panel inventory-summary-card">
            <h3>{t("Resumen técnico")}</h3>
            <div><span>{t("Nivel de riesgo")}</span><strong>{equipment.current_risk_category ? riskLabels[equipment.current_risk_category] : t("No visible")}</strong></div>
            <div><span>{t("Puntuación")}</span><strong>{equipment.current_risk_score ?? "—"}</strong></div>
            <div><span>{t("Documentos")}</span><strong>{restricted ? t("Restringidos") : documents.length}</strong></div>
            <div><span>{t("Rutinas")}</span><strong>{restricted ? t("Restringidas") : programs.length}</strong></div>
          </section>
          {role === "jefe" && pendingIssues.length > 0 && (
            <section className="panel inventory-issues-card">
              <h3>{t("Incidencias del inventario")}</h3>
              {pendingIssues.map((issue) => (
                <article key={issue.id}>
                  <Badge tone={issue.severity === "error" ? "danger" : issue.severity === "advertencia" ? "warning" : "info"}>{issue.severity}</Badge>
                  <strong>{inventoryIssueLabel(issue.issue_code)}</strong>
                  <p>{inventoryIssueDescription(issue)}</p>
                  <small>{t("Estado de revisión:")}{" "}{issue.review_status}</small>
                </article>
              ))}
            </section>
          )}
        </aside>
      </div>
      {role === "jefe" && <InventoryAdministration bundle={bundle} onChanged={onChanged} />}
    </>
  );
}

function EquipmentTimeline({ equipmentId }: { equipmentId: string }) {
  const [rows, setRows] = useState<ActivityTimelineEntry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { getEquipmentActivity(equipmentId).then(setRows).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No fue posible cargar el historial.")); }, [equipmentId]);
  return <section className="panel"><h3>{t("Historial del equipo")}</h3><div className="audit-list">{rows.map((row, index) => <article key={`${row.event_type}-${row.reference}-${index}`}><div><strong>{row.reference}</strong><small>{new Date(row.event_time).toLocaleString("es-MX")} · {row.event_type} · {row.description}</small></div></article>)}</div>{rows.length === 0 && !error && <small>{t("Sin actividad registrada.")}</small>}{error && <small className="form-error">{error}</small>}</section>;
}

function EquipmentQr({ equipmentId, inventoryCode }: { equipmentId: string; inventoryCode: string }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const target = `${window.location.origin}${window.location.pathname}?equipment=${encodeURIComponent(equipmentId)}`;

  useEffect(() => {
    QRCode.toDataURL(target, { width: 320, margin: 2, errorCorrectionLevel: "M" })
      .then(setImage)
      .catch(() => setError("No fue posible generar el código QR."));
  }, [target]);

  function printLabel() {
    if (!image) return;
    const popup = window.open("", "_blank", "width=520,height=620");
    if (!popup) { setError("El navegador bloqueó la ventana de impresión."); return; }
    popup.opener = null;
    popup.document.write(`<title>Etiqueta ${inventoryCode}</title><style>body{font-family:Arial;text-align:center;padding:24px}img{width:320px}small{display:block;margin-top:12px}</style><h1>BioMedGest</h1><img src="${image}" alt="QR"><h2>${inventoryCode}</h2><small>Inicia sesión para consultar la ficha autorizada.</small><script>onload=()=>print()</script>`);
    popup.document.close();
  }

  return <section className="panel equipment-qr"><h3><QrCode size={18} />{" "}{t("Etiqueta QR")}</h3>{image && <img src={image} alt={`Código QR del equipo ${inventoryCode}`} />}<p>{t("El código contiene únicamente un enlace con el identificador técnico del equipo.")}</p><div className="qr-actions"><a className="row-action" href={image} download={`BioMedGest-${inventoryCode}.png`}>{t("Exportar PNG")}</a><button type="button" className="row-action" onClick={printLabel}>{t("Imprimir")}</button></div>{error && <small className="form-error">{error}</small>}</section>;
}

export function EquipmentDetail({
  equipmentId,
  role,
  onBack,
  api = defaultInventoryApi,
  configured = isSupabaseConfigured,
}: {
  equipmentId: string | null;
  role: Role;
  onBack: () => void;
  api?: InventoryApi;
  configured?: boolean;
}) {
  const [bundle, setBundle] = useState<EquipmentInventoryBundle | null>(null);
  const [loading, setLoading] = useState(Boolean(configured && equipmentId));
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!configured || !equipmentId) return;
    let active = true;
    setLoading(true);
    setError("");
    api.getBundle(equipmentId, role)
      .then((result) => { if (active) setBundle(result); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Error de consulta no identificado.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, configured, equipmentId, reloadToken, role]);

  return (
    <>
      <div className="equipment-detail-toolbar"><button className="back-link" onClick={onBack}><ArrowLeft size={17} />{" "}{t("Volver al inventario")}</button>{role === "jefe" && bundle && !loading && !error && <InventoryEquipmentManager prominent equipmentId={bundle.equipment.id} onChanged={(id) => { if (id) setReloadToken((value) => value + 1); else onBack() }} />}</div>
      {!configured ? <PendingConfiguration /> : !equipmentId ? (
        <ErrorState message="No se seleccionó ningún equipo." onRetry={onBack} />
      ) : loading ? <LoadingState message="Cargando ficha del equipo..." /> : error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
      ) : bundle ? <><DetailContent bundle={bundle} role={role} onChanged={() => setReloadToken((value) => value + 1)} /></> : null}
    </>
  );
}
