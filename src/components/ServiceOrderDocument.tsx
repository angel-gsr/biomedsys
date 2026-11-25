import { t } from "../lib/i18n"

import { useEffect, useState } from "react"

import { Download, Eye, PenLine, Printer } from "lucide-react"

import type { MaintenanceSummary, ReportSummary } from "../lib/supabase"

import { Button } from "./ui"

import { SignaturePad } from "./LoanVoucher"

import {
  getServiceOrderDocument,
  issueServiceOrderDocument,
  type IssuedServiceOrder,
} from "../lib/serviceOrderDocuments"

import type { ServiceOrderPdfOptions } from "../lib/serviceOrderPdf"

import type { Role } from "../lib/supabase"

export function serviceOrderSections(
  item: MaintenanceSummary,
  report?: ReportSummary | null,
) {
  const date = (value?: string | null) =>
    value ? new Date(value).toLocaleString("es-MX") : "Pendiente"

  const label = (value?: string | null) =>
    value
      ? ({
          critica: "Crítica",
          alta: "Alta",
          ordinaria: "Ordinaria",
          programado: "Programado",
          en_proceso: "En proceso",
          completado: "Completado",
          cancelado: "Cancelado",
          operativo: "Operativo",
          en_reparacion: "En reparación",
          fuera_de_servicio: "Fuera de servicio",
        } as Record<string, string>)[value] || value
      : null

  return [
    {
      title: item.assigned_to ? "Asignación de la orden" : "Orden disponible",
      fields: [
        ["Orden", item.maintenance_number],
        ["Reporte", item.report_number || report?.report_number],
        ["Técnico", item.assigned_to_name],
        ["Prioridad", label(item.priority)],
        ["Atención programada", date(item.scheduled_at)],
        ["Estado", label(item.status)],
      ],
    },

    {
      title: "Equipo y ubicación",
      fields: [
        ["Inventario", item.equipment_identifier],
        [
          "Equipo",
          item.equipment?.equipment_type ||
            report?.equipment_snapshot?.equipment_type,
        ],
        ["Fabricante", item.equipment?.manufacturer || report?.manufacturer],
        ["Modelo", item.equipment?.model || report?.equipment_snapshot?.model],
        [
          "Serie",
          item.equipment?.serial_number ||
            report?.equipment_snapshot?.serial_number,
        ],
        ["Área", report?.service || item.equipment?.hospital_area],
        [
          "Ubicación del incidente",
          report?.location || item.equipment?.location,
        ],
      ],
    },

    {
      title: "Incidente reportado",
      fields: [
        ["Fecha del evento", report?.event_date],
        ["Tipo de incidente", report?.event_type],
        ["Problema", report?.incident_label || report?.description],
        ["Descripción", report?.description],
        ["Observaciones", report?.observations],
        ["Acción inicial", report?.action_taken],
        ["Resultado para el paciente", report?.patient_outcome],
      ],
    },

    {
      title: "Seguimiento técnico",
      fields: [
        ["Inicio de atención", date(item.record?.started_at)],
        ["Fin de atención", date(item.record?.completed_at)],
        ["Diagnóstico", item.record?.diagnosis],
        ["Trabajo realizado", item.record?.work_performed],
        ["Pruebas", item.record?.test_results],
        ["Condición final", label(item.record?.equipment_condition)],
        ["Observaciones técnicas", item.record?.technical_notes],
        ["Validación", date(item.validated_at)],
        ["Notas de cierre", item.closure_notes],
        [
          "Actividades realizadas",
          item.activities
            ?.map(
              (a) =>
                `${a.completed ? "Completada" : "Pendiente"}: ${a.activity}`,
            )
            .join("\n"),
        ],
      ],
    },
  ]
}

export async function serviceOrderPdf(
  item: MaintenanceSummary,
  report?: ReportSummary | null,
  options: ServiceOrderPdfOptions = {},
) {
  const { buildServiceOrderPdf } = await import("../lib/serviceOrderPdf")

  const documentItem = options.final
    ? item
    : {
        ...item,
        record: null,
        activities: [],
        validated_at: null,
        closure_notes: null,
      }

  return buildServiceOrderPdf(
    item,
    serviceOrderSections(documentItem, report).filter(section=>options.final || section.title!=="Seguimiento técnico"),
    options,
  )
}

export function ServiceOrderDocument({
  item,
  report,
  role = "jefe",
}: {
  item: MaintenanceSummary
  report?: ReportSummary | null
  role?: Role
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [document, setDocument] = useState<IssuedServiceOrder | null>(null)

  const [signing, setSigning] = useState(false),
    [signature, setSignature] = useState<string | undefined>(),
    [url, setUrl] = useState("")

  const [fileName, setFileName] = useState(""),
    [finalPreview, setFinalPreview] = useState(false)

  useEffect(() => {
    setUrl("")
    setSignature(undefined)
    setSigning(false)
    setError("")
  }, [item.id, item.record?.updated_at])

  useEffect(() => {
    let active = true
    setDocument(null)
    getServiceOrderDocument(item.id)
      .then((value) => {
        if (active) setDocument(value)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause?.message || "No fue posible consultar el documento final.",
          )
      })
    return () => {
      active = false
    }
  }, [item.id, item.record?.updated_at])

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )

  const canIssue =
    role === "tecnico" &&
    Boolean(item.record?.completed_at) &&
    ["en_proceso", "completado"].includes(item.status)

  async function preview(final: boolean, issue = false) {
    setBusy(true)
    setError("")
    try {
      let saved = document

      if (issue) {
        saved = await issueServiceOrderDocument(item.id, signature)
        setDocument(saved)
        setSigning(false)
        setSignature(undefined)
      }

      if (final && !saved)
        throw new Error("Primero genera el informe técnico final.")

      const blob =
        final && saved
          ? await serviceOrderPdf(saved.snapshot.item, saved.snapshot.report, {
              final: true,
              signature: saved.signature_png,
              issuedAt: saved.issued_at,
              documentId: saved.id,
            })
          : await serviceOrderPdf(item, report)

      setUrl(URL.createObjectURL(blob))
      setFileName(
        `Orden-${item.maintenance_number.replace(/[^a-z0-9_-]/gi, "_")}${
          final ? "-Final" : "-Inicial"
        }.pdf`,
      )
      setFinalPreview(final)
    } catch (cause) {
      setError(
        cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "No fue posible generar el PDF. Intenta nuevamente.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="service-order-toolbar">
        <span
          className={`badge badge-${item.assigned_to ? "success" : "neutral"}`}
        >
          {t(
            item.assigned_to
              ? "Asignación confirmada"
              : "Pendiente de asignación",
          )}
        </span>
        <Button icon={Eye} disabled={busy} onClick={() => void preview(false)}>
          {t("Ver orden inicial / PDF")}
        </Button>
        {document && (
          <Button
            icon={Eye}
            variant="secondary"
            disabled={busy}
            onClick={() => void preview(true)}
          >
            {t("Ver informe final / PDF")}
          </Button>
        )}
      </div>
      <div className="service-order-grid">
        {serviceOrderSections(item, report).map((section) => (
          <section className="panel service-order-section" key={section.title}>
            <h3>{t(section.title)}</h3>
            <dl>
              {section.fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{t(label!)}</dt>
                  <dd>{value || t("Pendiente / no registrado")}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {role === "tecnico" && (
        <section className="panel service-order-signoff">
          <h3>{t("Documento final del seguimiento")}</h3>
          <p>
            {t(
              "Completa y guarda el seguimiento con fecha de finalización. El PDF utiliza el último seguimiento guardado. Puedes firmarlo con el dedo, lápiz o mouse, o dejar el espacio para firma en papel.",
            )}
          </p>
          {canIssue ? (
            <>
              <Button
                icon={PenLine}
                variant="secondary"
                disabled={busy}
                onClick={() => setSigning((value) => !value)}
              >
                {t(signing ? "Ocultar firma" : "Agregar firma del biomédico")}
              </Button>
              {signing && (
                <SignaturePad
                  label={t("Firma del ingeniero biomédico responsable")}
                  onChange={setSignature}
                />
              )}
              <Button
                icon={Download}
                disabled={busy}
                onClick={() => void preview(true, true)}
              >
                {t(
                  signature
                    ? "Guardar firma y generar informe final"
                    : "Generar informe final",
                )}
              </Button>
            </>
          ) : (
            <p>
              {t(
                "El informe final estará disponible al finalizar y guardar la atención.",
              )}
            </p>
          )}
          {document && (
            <p>
              {t("Último informe emitido:")}{" "}
              {new Date(document.issued_at).toLocaleString("es-MX")}
              {document.record_updated_at !== item.record?.updated_at && (
                <>
                  {" "}
                  ·{" "}
                  {t(
                    "El seguimiento tiene cambios posteriores; genera una versión actualizada.",
                  )}
                </>
              )}
            </p>
          )}
        </section>
      )}
      {busy && <p role="status">{t("Generando PDF...")}</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {url && (
        <section className="service-order-pdf panel">
          <h3>
            {t(
              finalPreview
                ? "Informe técnico final"
                : "Orden de servicio inicial",
            )}
          </h3>
          <div className="table-actions">
            <a className="btn btn-primary" href={url} download={fileName}>
              <Download size={18} />
              {t("Descargar PDF")}
            </a>
            <a
              className="btn btn-secondary"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {t("Abrir PDF")}
            </a>
            <Button
              icon={Printer}
              variant="secondary"
              onClick={() => {
                try {
                  window.document
                    .querySelector<HTMLIFrameElement>(
                      `iframe[data-service-order="${item.id}"]`,
                    )
                    ?.contentWindow?.print()
                } catch {
                  window.open(url, "_blank", "noopener,noreferrer")
                }
              }}
            >
              {t("Imprimir")}
            </Button>
          </div>
          <iframe
            className="report-pdf-preview"
            data-service-order={item.id}
            title={t("Vista previa de la orden de servicio")}
            src={url}
          />
        </section>
      )}
    </>
  )
}
