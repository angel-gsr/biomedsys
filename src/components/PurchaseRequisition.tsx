import { useEffect, useState } from "react"

import {
  ArrowLeft,
  Download,
  FileText,
  Plus,
  Printer,
  Save,
  Trash2,
  Pencil,
} from "lucide-react"

import {
  getCurrentProfile,
  listUserDepartments,
  type Profile,
  type Quote,
} from "../lib/supabase"

import {
  blankPurchaseItem,
  getPurchaseRequisition,
  purchaseTotals,
  savePurchaseRequisition,
  type PurchaseInput,
  type PurchaseRequisition as Requisition,
  type PurchaseResult,
} from "../lib/purchaseRequisition"

import { purchaseRequisitionPdf } from "../lib/purchaseRequisitionPdf"

import { Button } from "./ui"

import { t } from "../lib/i18n"

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value)

export function PurchaseRequisition({
  quote,
  initial,
  onBack,
  onSaved,
}: {
  quote?: Quote
  initial?: Requisition
  onBack: () => void
  onSaved: (result: PurchaseResult) => void
}) {
  const [record, setRecord] = useState<Requisition | null>(initial || null),
    [editing, setEditing] = useState(!initial),
    [loading, setLoading] = useState(Boolean(quote && !initial)),
    [error, setError] = useState("")

  useEffect(() => {
    if (!quote || initial) return
    let active = true
    getPurchaseRequisition(quote.id)
      .then((value) => {
        if (active) {
          setRecord(value)
          setEditing(!value)
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [quote?.id, initial])

  const locked = quote?.status === "aprobada" || quote?.status === "rechazada"

  return (
    <section className="purchase-requisition">
      <Button icon={ArrowLeft} variant="secondary" onClick={onBack}>
        {t("Volver a Cotizaciones")}
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">{t("Cargando requisición...")}</p>
      ) : editing && !locked ? (
        <PurchaseForm
          quote={quote}
          record={record}
          onCancel={() => (record ? setEditing(false) : onBack())}
          onSaved={(result) => {
            setRecord(result.requisition)
            setEditing(false)
            onSaved(result)
          }}
        />
      ) : record ? (
        <>
          <div className="page-intro">
            <div>
              <h2>
                {t("Requisición de compra")} · {record.requisition_number}
              </h2>
              <p>
                {quote?.quote_number} · {record.data.supplier}
              </p>
            </div>
            {!locked && (
              <Button
                icon={Pencil}
                variant="secondary"
                onClick={() => setEditing(true)}
              >
                {t("Editar requisición")}
              </Button>
            )}
          </div>
          <PurchaseDocument record={record} />
        </>
      ) : (
        <p>
          {t(
            "Esta cotización final no tiene una requisición de compra registrada.",
          )}
        </p>
      )}
    </section>
  )
}

function PurchaseForm({
  quote,
  record,
  onCancel,
  onSaved,
}: {
  quote?: Quote
  record: Requisition | null
  onCancel: () => void
  onSaved: (result: PurchaseResult) => void
}) {
  const [form, setForm] = useState<PurchaseInput>(
    () =>
      record?.data || {
        hospital: "",
        department: "",
        purpose: quote?.equipment_description || "",
        supplier: quote?.supplier || "",
        supplier_phone: "",
        supplier_email: "",
        supplier_address: "",
        payment_terms: "",
        required_on: "",
        delivery_on: "",
        fixed_asset: false,
        out_of_line: false,
        currency: quote?.currency || "MXN",
        tax_percent: "",
        notes: quote?.notes || "",
        items: [
          {
            ...blankPurchaseItem(),
            description: quote?.equipment_description || "",
            unit_cost: quote?.amount || "0",
          },
        ],
      },
  )

  const [profile, setProfile] = useState<Profile | null>(null),
    [departments, setDepartments] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(quote?.status || "pendiente")

  useEffect(() => {
    let active = true
    Promise.all([getCurrentProfile(), listUserDepartments()])
      .then(([self, rows]) => {
        if (!active) return
        if (!self) throw new Error("La sesión expiró.")
        setProfile(self)
        setDepartments(rows)
        if (!record)
          setForm((old) => ({
            ...old,
            department: rows.includes(self.department || "")
              ? self.department || ""
              : "",
          }))
      })
      .catch((cause) => {
        if (active) setError(cause.message)
      })
    return () => {
      active = false
    }
  }, [])

  let totals: ReturnType<typeof purchaseTotals> | null = null,
    calculationError = ""
  try {
    totals = purchaseTotals(form.items, form.tax_percent)
  } catch (cause) {
    calculationError = (cause as Error).message
  }

  function update<K extends keyof PurchaseInput>(
    key: K,
    value: PurchaseInput[K],
  ) {
    setForm((old) => ({ ...old, [key]: value }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !profile || !totals) return
    setBusy(true)
    setError("")
    try {
      const result = await savePurchaseRequisition(
        form,
        quote?.id || null,
        record?.updated_at || null,
        status,
      )
      onSaved(result)
    } catch (cause) {
      setError(
        cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "No fue posible guardar la requisición.",
      )
    } finally {
      setBusy(false)
    }
  }

  const requester = record?.data.requester || profile

  const text = (
    key: keyof PurchaseInput,
    label: string,
    required = false,
    type = "text",
    limit = 200,
  ) => (
    <label className="field">
      <span>{t(label)}</span>
      <input
        aria-label={t(label)}
        required={required}
        type={type}
        maxLength={limit}
        value={String(form[key] || "")}
        onChange={(e) => update(key, e.target.value as never)}
      />
    </label>
  )

  return (
    <form className="panel purchase-form" onSubmit={save}>
      <h2>
        {t(
          record
            ? "Editar requisición de compra"
            : "Nueva requisición de compra",
        )}
      </h2>
      <p>
        {t(
          "Los importes se calculan por partida. Indica el IVA que corresponda; los espacios de firma se incluirán en el PDF.",
        )}
      </p>
      <fieldset disabled={busy} className="report-edit-fields">
        <h3>{t("Datos de la solicitud")}</h3>
        <div className="form-grid">
          {text("hospital", "Hospital *", true)}
          <label className="field">
            <span>{t("Departamento solicitante *")}</span>
            <select
              required
              value={form.department}
              onChange={(e) => update("department", e.target.value)}
            >
              <option value="">{t("Selecciona un departamento")}</option>
              {departments.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("Solicitante")}</span>
              <input aria-label={t("Solicitante")} readOnly value={requester?.full_name || ""} />
            <small>{requester?.institutional_id}</small>
          </label>
          {text("purpose", "Equipo o servicio *", true)}
          {text("required_on", "Fecha requerida", false, "date")}
          {text("delivery_on", "Fecha de entrega", false, "date")}
          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.fixed_asset}
              onChange={(e) => update("fixed_asset", e.target.checked)}
            />
            {t("Activo fijo")}
          </label>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.out_of_line}
              onChange={(e) => update("out_of_line", e.target.checked)}
            />
            {t("Fuera de línea")}
          </label>
        </div>
        <h3>{t("Proveedor y condiciones")}</h3>
        <div className="form-grid">
          {text("supplier", "Proveedor *", true)}
          {text("supplier_phone", "Teléfono del proveedor", false, "tel", 25)}
          {text("supplier_email", "Correo del proveedor", false, "email", 254)}
          {text(
            "supplier_address",
            "Dirección del proveedor",
            false,
            "text",
            500,
          )}
          {text("payment_terms", "Condiciones de pago", false, "text", 300)}
          <label className="field">
            <span>{t("Moneda")}</span>
            <select
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
            >
              {["MXN", "USD", "EUR"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <h3>{t("Partidas de compra")}</h3>
        <div className="purchase-items">
          {form.items.map((item, index) => (
            <section className="purchase-item" key={index}>
              <div className="purchase-item-head">
                <strong>
                  {t("Partida")} {index + 1}
                </strong>
                <Button
                  icon={Trash2}
                  variant="secondary"
                  disabled={form.items.length === 1}
                  onClick={() =>
                    update(
                      "items",
                      form.items.filter((_, i) => i !== index),
                    )
                  }
                >
                  {t("Quitar partida")}
                </Button>
              </div>
              <div className="form-grid">
                {([
                  {
                    key: "description",
                    label: "Descripción *",
                    type: "text",
                    max: 500,
                  },
                  {
                    key: "quantity",
                    label: "Cantidad *",
                    type: "number",
                    min: "0.01",
                    max: "100000",
                  },
                  {
                    key: "unit",
                    label: "Unidad de medida *",
                    type: "text",
                    max: 20,
                  },
                  {
                    key: "supplier_catalog",
                    label: "Catálogo del proveedor",
                    type: "text",
                    max: 80,
                  },
                  {
                    key: "unit_cost",
                    label: "Precio unitario *",
                    type: "number",
                    min: "0",
                    max: "9999999999.99",
                  },
                  {
                    key: "discount_percent",
                    label: "Descuento (%)",
                    type: "number",
                    min: "0",
                    max: "100",
                  },
                ] as const).map((field) => (
                  <label className="field" key={field.key}>
                    <span>{t(field.label)}</span>
                    <input
                      aria-label={`${t(field.label)} ${index + 1}`}
                      required={field.key !== "supplier_catalog"}
                      type={field.type}
                      step={field.type === "number" ? "0.01" : undefined}
                      min={"min" in field ? field.min : undefined}
                      max={field.type === "number" ? field.max : undefined}
                      maxLength={
                        field.type === "text" ? Number(field.max) : undefined
                      }
                      value={item[field.key] ?? ""}
                      onChange={(e) =>
                        update(
                          "items",
                          form.items.map((row, i) =>
                            i === index
                              ? { ...row, [field.key]: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="purchase-line-total">
                {t("Importe de la partida")}:{" "}
                {totals ? money(totals.lines[index].total, form.currency) : "—"}
              </p>
            </section>
          ))}
        </div>
        <Button
          icon={Plus}
          variant="secondary"
          disabled={form.items.length >= 50}
          onClick={() => update("items", [...form.items, blankPurchaseItem()])}
        >
          {t("Agregar partida")}
        </Button>
        <div className="form-grid purchase-summary">
          <label className="field">
            <span>{t("IVA aplicable (%) *")}</span>
            <input
              required
              aria-label={t("IVA aplicable (%) *")}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.tax_percent}
              onChange={(e) => update("tax_percent", e.target.value)}
            />
          </label>
          <dl>
            <div>
              <dt>{t("Subtotal después de descuentos")}</dt>
              <dd>{totals ? money(totals.subtotal, form.currency) : "—"}</dd>
            </div>
            <div>
              <dt>IVA</dt>
              <dd>{totals ? money(totals.tax, form.currency) : "—"}</dd>
            </div>
            <div>
              <dt>{t("Total")}</dt>
              <dd>{totals ? money(totals.total, form.currency) : "—"}</dd>
            </div>
          </dl>
          <label className="field span-2">
            <span>{t("Observaciones especiales")}</span>
            <textarea
              maxLength={2000}
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
            />
          </label>
          {quote && (
            <label className="field">
              <span>{t("Estado de la cotización")}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {(quote.status === "en_revision"
                  ? ["en_revision", "aprobada", "rechazada"]
                  : ["pendiente", "en_revision", "rechazada"]
                ).map((value) => (
                  <option key={value} value={value}>
                    {t(
                      ({
                        pendiente: "Pendiente",
                        en_revision: "En revisión",
                        aprobada: "Aprobada",
                        rechazada: "Rechazada",
                      } as Record<string, string>)[value],
                    )}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {calculationError && form.tax_percent !== "" && (
          <p className="form-error">{calculationError}</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button variant="secondary" onClick={onCancel}>
            {t("Cancelar")}
          </Button>
          <Button
            icon={Save}
            type="submit"
            disabled={busy || !profile || !totals}
          >
            {t(busy ? "Guardando..." : "Guardar y generar requisición")}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

function PurchaseDocument({ record }: { record: Requisition }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true,
      objectUrl = ""
    setUrl("")
    setError("")
    purchaseRequisitionPdf(record)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
      })
      .catch((cause) => {
        if (active) setError(cause?.message || "No fue posible generar el PDF.")
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [record, retry])

  return (
    <section className="panel purchase-document">
      <h3>{t("Documento de requisición de compra")}</h3>
      <p>
        {record.data.hospital} · {record.data.department} ·{" "}
        {money(Number(record.total), record.data.currency)}
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>
            {t("Reintentar PDF")}
          </Button>
        </div>
      ) : !url ? (
        <p role="status">{t("Generando PDF...")}</p>
      ) : (
        <>
          <div className="table-actions">
            <a
              className="btn btn-primary"
              href={url}
              download={`${record.requisition_number}.pdf`}
            >
              <Download size={18} />
              {t("Descargar requisición PDF")}
            </a>
            <a
              className="btn btn-secondary"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={18} />
              {t("Abrir PDF")}
            </a>
            <Button
              icon={Printer}
              variant="secondary"
              onClick={() => {
                try {
                  document
                    .querySelector<HTMLIFrameElement>(
                      `iframe[data-requisition="${record.id}"]`,
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
            data-requisition={record.id}
            title={t("Vista previa de requisición de compra")}
            src={url}
          />
        </>
      )}
    </section>
  )
}
