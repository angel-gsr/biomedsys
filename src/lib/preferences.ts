import { useSyncExternalStore } from "react"
export type Preferences = { language:"es"|"en";theme:"light"|"dark"|"auto" }
const key="biomedgest-preferences"
function read():Preferences{try{const saved=JSON.parse(localStorage.getItem(key)||"{}");return {language:saved.language==="en"?"en":"es",theme:["light","dark","auto"].includes(saved.theme)?saved.theme:"auto"}}catch{return {language:"es",theme:"auto"}}}
let current=read();const listeners=new Set<()=>void>()
export function preferences(){return current}
export function setPreferences(value:Preferences){current=value;localStorage.setItem(key,JSON.stringify(value));listeners.forEach(fn=>fn())}
export function usePreferences(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>current)}
export function themeAt(time:Date,theme:Preferences["theme"]){if(theme!=="auto")return theme;const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Mexico_City",hour:"2-digit",hourCycle:"h23"}).format(time));return hour>=6&&hour<18?"light":"dark"}
if(typeof window!=="undefined")window.addEventListener("storage",event=>{if(event.key===key){current=read();listeners.forEach(fn=>fn())}})
