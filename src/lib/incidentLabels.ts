export function formatIncidentLabel(value: string) {
  return value.trim().replace(/\p{L}/u, letter => letter.toLocaleUpperCase("es-MX"))
}
