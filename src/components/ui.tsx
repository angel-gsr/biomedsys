import type { ElementType, ReactNode } from "react";
export function Button({ children, variant = "primary", icon: Icon, onClick, type = "button", className = "" }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: ElementType; onClick?: () => void; type?: "button" | "submit"; className?: string }) {
  return <button type={type} onClick={onClick} className={`btn btn-${variant} ${className}`}>{Icon && <Icon size={18} aria-hidden="true" />}{children}</button>;
}
export function PageIntro({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-intro"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2><p>{description}</p></div>{action}</div>;
}
