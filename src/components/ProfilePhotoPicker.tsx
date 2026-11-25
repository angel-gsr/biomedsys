import { t } from "../lib/i18n"
import { useEffect,useRef,useState } from "react"
import { Camera } from "lucide-react"
import { resizeProfilePhoto } from "../lib/profilePhotos"
import { ProfileAvatar } from "./ProfileAvatar"
export function ProfilePhotoPicker({file,onChange,profile,onRemove}:{file:File|null;onChange:(file:File|null)=>void;profile?:{full_name:string;avatar_path?:string|null};onRemove?:()=>void}) {
 const input=useRef<HTMLInputElement>(null),[preview,setPreview]=useState<string|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false)
 useEffect(()=>{if(!file){setPreview(null);return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file])
 return <div className="profile-photo-picker field span-2"><span>{t("Foto de perfil (opcional)")}</span><div className="table-actions">{preview?<span className="avatar"><img src={preview} alt={t("Vista previa de perfil")} /></span>:profile?<ProfileAvatar profile={profile}/>:null}<input hidden ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("Cargar foto de perfil")} disabled={busy} onChange={async e=>{const image=e.target.files?.[0];e.target.value="";if(!image)return;setBusy(true);setError("");try{onChange(await resizeProfilePhoto(image))}catch(cause){setError(cause instanceof Error?cause.message:"No fue posible procesar la foto")}finally{setBusy(false)}}}/><button type="button" className="row-action" disabled={busy} onClick={()=>input.current?.click()}><Camera size={20}/>{busy?t("Procesando imagen..."):t("Cargar foto")}</button>{(file || profile?.avatar_path) && <button type="button" className="row-action" onClick={()=>{onChange(null);onRemove?.()}}>{t("Quitar foto")}</button>}</div><small>{file?`${Math.ceil(file.size/1024)} KB · `:""}{t("Miniatura de 192 × 192 px; máximo 64 KB.")}</small>{error && <p role="alert" className="form-error">{error}</p>}</div>
}
