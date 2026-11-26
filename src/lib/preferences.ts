import { useSyncExternalStore } from "react"
export type Preferences = { language:"es"|"en";theme:"light"|"dark"|"auto" }
const prefix="biomedgest-preferences:user:"
let userId:string|null=null
const defaults=():Preferences=>({language:"es",theme:"auto"})
function normalize(saved:Partial<Preferences>):Preferences{return {language:saved?.language==="en"?"en":"es",theme:saved && ["light","dark","auto"].includes(saved.theme||"")?saved.theme!:"auto"}}
function read():Preferences{if(!userId)return defaults();try{return normalize(JSON.parse(localStorage.getItem(prefix+userId)||"{}"))}catch{return defaults()}}
let current=defaults();const listeners=new Set<()=>void>()
export function setPreferenceUser(id:string|null){if(userId===id)return;userId=id;current=read();listeners.forEach(fn=>fn())}
export function preferences(){return current}
export function setPreferences(value:Preferences){current=normalize(value);if(userId){try{localStorage.setItem(prefix+userId,JSON.stringify(current))}catch{/* Apply for this session when storage is unavailable. */}}listeners.forEach(fn=>fn())}
export function usePreferences(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>current)}
export function themeAt(time:Date,theme:Preferences["theme"]){if(theme!=="auto")return theme;const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Mexico_City",hour:"2-digit",hourCycle:"h23"}).format(time));return hour>=6&&hour<18?"light":"dark"}
if(typeof window!=="undefined")window.addEventListener("storage",event=>{if(userId && (event.key===prefix+userId || event.key===null)){current=read();listeners.forEach(fn=>fn())}})
