import { Accessibility, Baby, Biohazard, Bomb, Crosshair, DoorOpen, Flame, HeartPulse, ShieldAlert, Siren, Stethoscope, Tornado, Unplug, UserSearch, Users, type LucideIcon } from "lucide-react"

const icons: Record<string, LucideIcon> = {
  ambar: UserSearch, azul: HeartPulse, cafe: Tornado, negro: Bomb,
  rojo: Flame, rosa: Baby, verde: DoorOpen, amarillo: Biohazard,
  blanco: Accessibility, magenta: Unplug, morado: ShieldAlert,
  naranja: Users, oro: Stethoscope, plata: Crosshair,
}

export function HospitalCodeIcon({ code, color }: { code: string; color: string }) {
  const Icon = icons[code] || Siren
  const dark = ["amarillo", "blanco", "oro", "plata"].includes(code)
  return <span className="hospital-color" style={{ backgroundColor: color, color: dark ? "#18324a" : "#ffffff" }} aria-hidden="true"><Icon size={28} strokeWidth={2} /></span>
}
