import{act,renderHook}from"@testing-library/react"
import{afterEach,expect,it,vi}from"vitest"
import{useOperationalRefresh}from"./useOperationalRefresh"
afterEach(()=>vi.useRealTimers())
it("refreshes on focus, mutations and every 15 seconds, and stops after leaving the view",()=>{
 vi.useFakeTimers();const refresh=vi.fn();const view=renderHook(()=>useOperationalRefresh(refresh,["maintenances"]))
 act(()=>window.dispatchEvent(new Event("focus")));expect(refresh).toHaveBeenCalledTimes(1)
 act(()=>window.dispatchEvent(new Event("biomedgest:operations-changed")));expect(refresh).toHaveBeenCalledTimes(2)
 act(()=>vi.advanceTimersByTime(15000));expect(refresh).toHaveBeenCalledTimes(3)
 view.unmount();act(()=>{vi.advanceTimersByTime(15000);window.dispatchEvent(new Event("focus"))});expect(refresh).toHaveBeenCalledTimes(3)
})
