import { t } from "../lib/i18n"
import { useEffect,useState } from "react"
import { profilePhotoUrl } from "../lib/profilePhotos"
export function ProfileAvatar({profile}:{profile:{full_name:string;avatar_path?:string|null}}) {
 const [url,setUrl]=useState<string|null>(null)
 useEffect(()=>{let active=true;setUrl(null);if(profile.avatar_path)profilePhotoUrl(profile.avatar_path).then(url=>{if(active)setUrl(url)}).catch(()=>undefined);return()=>{active=false}},[profile.avatar_path])
 return <span className="avatar">{url?<img src={url} alt={t("Foto de perfil")} onError={()=>setUrl(null)} />:profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join("")}</span>
}
