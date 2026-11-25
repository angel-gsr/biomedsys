import { useEffect } from "react"
import { supabase } from "../lib/supabase"
export function UserPresence({ profileId }: { profileId: string }) {
  useEffect(() => {
    const id = crypto.randomUUID()
    const touch = () => { void Promise.resolve(supabase?.rpc("touch_my_presence", { tab_session_id: id, connected: true })).catch(() => undefined) }
    touch()
    const interval = window.setInterval(touch, 30000)
    window.addEventListener("focus", touch)
    return () => { clearInterval(interval); window.removeEventListener("focus", touch); void Promise.resolve(supabase?.rpc("touch_my_presence", { tab_session_id: id, connected: false })).catch(() => undefined) }
  }, [profileId])
  return null
}
