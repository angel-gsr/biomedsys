import { useEffect, useState } from "react"

import { ImageOff } from "lucide-react"

import images from "../data/equipmentImages.json"

import { t } from "../lib/i18n"

type ReferenceImage = {
  src: string
  source: string
  author: string
  license: string
  licenseUrl: string
  title: string
  external?: boolean
}

const catalog = images as Record<string, ReferenceImage>

export function EquipmentReferenceImage({
  type,
  manufacturer,
  model,
  compact = false,
}: {
  type: string
  manufacturer: string
  model: string
  compact?: boolean
}) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "")

  const key = normalize(manufacturer) + "|" + normalize(model),
    reference = catalog[key]

  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [reference?.src])

  const picture =
    reference && !failed ? (
      <img
        src={reference.src}
        alt={`${t("Imagen de referencia")}: ${type}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    ) : (
      <div className="equipment-image-placeholder">
        <ImageOff size={compact ? 22 : 40} />
        {!compact && (
          <span>{t("No hay fotografía verificada de este modelo")}</span>
        )}
      </div>
    )

  if (compact)
    return (
      <span
        className="equipment-thumbnail"
        title={t(
          "Fotografía de referencia del modelo. No corresponde a la unidad física del hospital.",
        )}
      >
        {picture}
      </span>
    )

  return (
    <section className="panel equipment-reference-card">
      <h3>{t("Referencia visual")}</h3>
      <div className="equipment-reference-frame">{picture}</div>
      <p>
        {t(
          "Fotografía de referencia del modelo. No corresponde a la unidad física del hospital.",
        )}
      </p>
      {reference && !failed && (
        <details>
          <summary>{t("Créditos de la imagen")}</summary>
          <p>{reference.author}</p>
          <a href={reference.source} target="_blank" rel="noreferrer">
            {t("Ver imagen original")}
          </a>
          {" · "}
          <a
            href={reference.licenseUrl || reference.source}
            target="_blank"
            rel="noreferrer"
          >
            {reference.license}
          </a>
          <small>
            {t(
              reference.external
                ? "Fotografía enlazada desde su sitio de origen."
                : "Copia optimizada para visualización.",
            )}
          </small>
        </details>
      )}
    </section>
  )
}
