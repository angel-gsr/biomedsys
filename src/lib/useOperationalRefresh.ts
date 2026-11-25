import {useEffect,useRef} from "react"
export function useOperationalRefresh(refresh:()=>void,tables:string[]){
 const callback=useRef(refresh);callback.current=refresh;const key=tables.join(",")
 useEffect(()=>{const update=()=>callback.current();window.addEventListener("focus",update);window.addEventListener("biomedgest:reports-changed",update);window.addEventListener("biomedgest:operations-changed",update);const timer=window.setInterval(update,15000)
 return()=>{clearInterval(timer);window.removeEventListener("focus",update);window.removeEventListener("biomedgest:reports-changed",update);window.removeEventListener("biomedgest:operations-changed",update)}
 },[key])
}
