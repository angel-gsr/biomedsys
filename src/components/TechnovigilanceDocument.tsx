import { useEffect, useState } from "react"
import { Download, Eye, Printer } from "lucide-react"
import { getTechnovigilanceDocument } from "../lib/technovigilance"
import { technovigilancePdf } from "../lib/technovigilancePdf"
import { Button } from "./ui"
import { t } from "../lib/i18n"
export function TechnovigilanceDocument({
  reportId,
  disabled,
}: {
  reportId: number
  disabled: boolean
}) {
  const [url, setUrl] = useState(""),
    [folio, setFolio] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  useEffect(() => {
    if (disabled) setUrl("")
  }, [disabled])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  async function generate() {
    setBusy(true)
    setError("")
    try {
      const data = await getTechnovigilanceDocument(reportId),
        blob = await technovigilancePdf(data)
      setFolio(data.report.report_number)
      setUrl(URL.createObjectURL(blob))
    } catch (cause) {
      setError(
        cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "No fue posible generar el documento de Tecnovigilancia.",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="tv-document">
      <h3>{t("Documento especial de Tecnovigilancia")}</h3>
      <p>
        {t(
          "Guarda el formulario completo antes de generar el PDF. El reporte de falla y la orden de servicio se conservan por separado.",
        )}
      </p>
      <Button
        icon={Eye}
        disabled={disabled || busy}
        onClick={() => void generate()}
      >
        {t(busy ? "Generando PDF..." : "Generar PDF de Tecnovigilancia")}
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {url && !disabled && (
        <>
          <div className="table-actions">
            <a
              className="btn btn-primary"
              download={`Tecnovigilancia-${folio}.pdf`}
              href={url}
            >
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
                  document
                    .querySelector<HTMLIFrameElement>(
                      `iframe[data-tv-report="${reportId}"]`,
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
            data-tv-report={reportId}
            title={t("Vista previa de Tecnovigilancia")}
            src={url}
          />
        </>
      )}
    </section>
  )
}
