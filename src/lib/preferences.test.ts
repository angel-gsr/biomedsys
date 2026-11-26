import {afterEach,expect,it} from "vitest"
import {setPreferences,themeAt,setPreferenceUser,preferences} from "./preferences"
import {t} from "./i18n"
afterEach(()=>{setPreferenceUser(null);localStorage.clear();setPreferences({theme:"light",language:"es"})})
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
it("isolates accounts and restores their own choices instead of the legacy shared preference",()=>{
 localStorage.setItem("biomedgest-preferences",JSON.stringify({theme:"dark",language:"en"}))
 setPreferenceUser("account-a");expect(preferences()).toEqual({theme:"auto",language:"es"})
 setPreferences({theme:"light",language:"es"})
 setPreferenceUser("account-b");expect(preferences()).toEqual({theme:"auto",language:"es"})
 setPreferences({theme:"dark",language:"en"})
 setPreferenceUser(null);expect(preferences()).toEqual({theme:"auto",language:"es"})
 setPreferenceUser("account-a");expect(preferences()).toEqual({theme:"light",language:"es"})
 setPreferenceUser("account-b");expect(preferences()).toEqual({theme:"dark",language:"en"})
})
it("ignores changes by other accounts but synchronizes tabs of the same account",()=>{
 setPreferenceUser("account-a");setPreferences({theme:"light",language:"es"})
 localStorage.setItem("biomedgest-preferences:user:account-b",JSON.stringify({theme:"dark",language:"en"}))
 window.dispatchEvent(new StorageEvent("storage",{key:"biomedgest-preferences:user:account-b"}))
 expect(preferences()).toEqual({theme:"light",language:"es"})
 localStorage.setItem("biomedgest-preferences:user:account-a",JSON.stringify({theme:"dark",language:"en"}))
 window.dispatchEvent(new StorageEvent("storage",{key:"biomedgest-preferences:user:account-a"}))
 expect(preferences()).toEqual({theme:"dark",language:"en"})
})
