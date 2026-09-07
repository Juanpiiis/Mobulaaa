/**
 * Formatea un número con separadores de miles (es-CO)
 * Ejemplo: 1234567 -> "1.234.567"
 */
export function formatNum(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return new Intl.NumberFormat('es-CO').format(num)
}

/**
 * Formatea un número con separadores de miles y decimales (es-CO)
 * Ejemplo: 1234567.89 -> "1.234.567,89"
 */
export function formatDecimal(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

/**
 * Formatea un número compacto (para gráficos)
 * Ejemplo: 15000 -> "15K", 1500000 -> "1.5M"
 */
export function formatCompact(num: number): string {
  return new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(num)
}

/**
 * Formatea una fecha a formato legible en español (es-CO)
 * Ejemplo: 2026-09-06 -> "6 de septiembre de 2026"
 */
export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Formatea una fecha corta (para tablas y gráficos)
 * Ejemplo: 2026-09-06 -> "06/09/2026"
 */
export function formatDateShort(dateString: string | Date): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Formatea una fecha y hora a formato legible en español
 * Ejemplo: 2026-09-06 14:30 -> "6 de septiembre de 2026, 02:30 p.m."
 */
export function formatDateTime(dateString: string | Date): string {
  const date = new Date(dateString)
  return date.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Calcula el número de días transcurridos desde una fecha hasta hoy
 * Ejemplo: "días desde" -> 45
 */
export function diasDesde(fecha: string | Date): number {
  const date = new Date(fecha)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Formatea un porcentaje (0 a 100)
 * Ejemplo: 0.85 -> "85%"
 */
export function formatPercent(valor: number): string {
  return `${Math.round(valor * 100)}%`
}