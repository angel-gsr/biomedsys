const sessionKey = "biomedgest-tab-session"
const documentKey = `biomedgest-${crypto.randomUUID()}`
const tabKey = (key: string) => sessionKey + (key.startsWith(documentKey) ? key.slice(documentKey.length) : `-${key}`)
// Auth's BroadcastChannel uses storageKey. Keep it unique to this document while
// sessionStorage preserves this tab's credentials across reloads.
export const tabAuthOptions = {
  storageKey: documentKey,
  storage: {
    getItem: (key: string) => sessionStorage.getItem(tabKey(key)),
    setItem: (key: string, value: string) => sessionStorage.setItem(tabKey(key), value),
    removeItem: (key: string) => sessionStorage.removeItem(tabKey(key)),
  },
}
