import {afterEach,expect,it} from "vitest"
import {setPreferences,themeAt} from "./preferences"
import {t} from "./i18n"
afterEach(()=>setPreferences({theme:"light",language:"es"}))
it("uses Puebla time for automatic mode, independently of device time zone",()=>{
 expect(themeAt(new Date("2026-11-25T11:59:00Z"),"auto")).toBe("dark")
 expect(themeAt(new Date("2026-11-25T12:00:00Z"),"auto")).toBe("light")
 expect(themeAt(new Date("2026-11-25T23:59:00Z"),"auto")).toBe("light")
 expect(themeAt(new Date("2026-11-26T00:00:00Z"),"auto")).toBe("dark")
 expect(themeAt(new Date("2026-11-25T12:00:00Z"),"dark")).toBe("dark")
})
it("translates interface labels and leaves unknown user data unchanged",()=>{
 setPreferences({theme:"dark",language:"en"})
 expect(t("Configuración")).toBe("Settings")
 expect(t("Nombres *")).toBe("Given names *")
 expect(t("Paciente demo con texto original")).toBe("Paciente demo con texto original")
 setPreferences({theme:"light",language:"es"});expect(t("Configuración")).toBe("Configuración")
})
