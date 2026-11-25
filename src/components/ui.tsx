import { t } from "../lib/i18n";
import type { ElementType, ReactNode } from "react";
export function Button({ children, variant = "primary", icon: Icon, onClick, type = "button", className = "", disabled = false }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: ElementType; onClick?: () => void; type?: "button" | "submit"; className?: string; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${variant} ${className}`}>{Icon && <Icon size={18} aria-hidden="true" />}{typeof children === "string" ? t(children) : children}</button>;
}
export function PageIntro({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-intro"><div>{eyebrow && <span className="eyebrow">{t(eyebrow)}</span>}<h2>{t(title)}</h2><p>{t(description)}</p></div>{action}</div>;
}
