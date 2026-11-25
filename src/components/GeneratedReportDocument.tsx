import { useEffect, useState } from "react"
import { Download, Printer } from "lucide-react"
import { createReportPdf, getReportPreview } from "../lib/reportManagement"
import { Button } from "./ui"
import { t } from "../lib/i18n"
export function GeneratedReportDocument({ reportId }: { reportId: number }) {
  const [url, setUrl] = useState(""),
    [folio, setFolio] = useState(""),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true,
      objectUrl = ""
    setError("")
    setUrl("")
    getReportPreview(reportId)
      .then(async (data) => {
        const blob = await createReportPdf(data.report)
        if (active) {
          objectUrl = URL.createObjectURL(blob)
          setFolio(data.report.report_number)
          setUrl(objectUrl)
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause && typeof cause === "object" && "message" in cause
              ? String(cause.message)
              : "No fue posible generar el documento del reporte.",
          )
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [reportId, reload])
  return (
    <section className="generated-report-document">
      <h3>{t("Documento del reporte")}</h3>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={() => setReload((n) => n + 1)}>
            {t("Reintentar PDF")}
          </Button>
        </div>
      ) : !url ? (
        <p role="status">{t("Generando PDF...")}</p>
      ) : (
        <>
          <div className="table-actions">
            <a className="btn btn-primary" download={`${folio}.pdf`} href={url}>
              <Download size={18} />
              {t("Descargar reporte PDF")}
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
                  document
                    .querySelector<HTMLIFrameElement>(
                      `iframe[data-report-id="${reportId}"]`,
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
            data-report-id={reportId}
            title={t("Documento PDF del reporte")}
            className="report-pdf-preview"
            src={url}
          />
        </>
      )}
    </section>
  )
}
