// lib/utils/dataExcel.ts

// ─────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────
export interface ProductoLimpio {
  nombre: string
  marca: string
  categoria: string
  codigo: string
  cantidad: number
  precio: number          // precio de venta (precio unidad)
  precio_mayorista: number
  precio_tat: number
  activo: boolean
}

export interface ResultadoLimpieza {
  productos: ProductoLimpio[]
  errores: string[]
  duplicadosUnificados: string[]
}

// ─────────────────────────────────────────
// LIMPIEZA BÁSICA DE TEXTO
// ─────────────────────────────────────────
export function limpiarTexto(str: any): string {
  if (str === null || str === undefined) return ''
  return str.toString().trim().replace(/\s+/g, ' ')
}

// Correcciones de typos (solo en el NOMBRE)
const CORRECCIONES_TYPOS: Array<[RegExp, string]> = [
  [/\bADIFONOS\b/gi, 'AUDIFONOS'],
  [/\bADIFONO\b/gi, 'AUDIFONO'],
  [/\bAUDIFINOS\b/gi, 'AUDIFONOS'],
  [/\bAUDIFINO\b/gi, 'AUDIFONO'],
  [/\bSMARTWACH\b/gi, 'SMARTWATCH'],
  [/\bSMARWACH\b/gi, 'SMARTWATCH'],
  [/\bSMARWATCH\b/gi, 'SMARTWATCH'],
  [/\bSMARTWACHT\b/gi, 'SMARTWATCH'],
  [/\bDOROADO\b/gi, 'DORADO'],
  [/\bAMARRILLO\b/gi, 'AMARILLO'],
]

export function aplicarCorrecciones(texto: string): string {
  let resultado = texto
  for (const [regex, reemplazo] of CORRECCIONES_TYPOS) {
    resultado = resultado.replace(regex, reemplazo)
  }
  return resultado
}

// ─────────────────────────────────────────
// NORMALIZAR MARCA
// ─────────────────────────────────────────
export function normalizarMarca(marcaRaw: string): string {
  const m = limpiarTexto(marcaRaw).toUpperCase()
  if (!m) return 'SIN MARCA'
  if (m === 'G-TIDE' || m === 'G TIDE' || m === 'G_TIDE') return 'GTIDE'
  if (m === 'AURA FIT' || m === 'AURA_FIT') return 'AURAFIT'
  if (m === 'BLACK VIEW' || m === 'BLACK_VIEW') return 'BLACKVIEW'
  return m
}

// ─────────────────────────────────────────
// NORMALIZAR CATEGORÍA
// ─────────────────────────────────────────
export function normalizarCategoria(catRaw: string): string {
  const c = limpiarTexto(catRaw).toUpperCase()
  return c || 'SIN CATEGORIA'
}

// ─────────────────────────────────────────
// GENERAR CÓDIGO ÚNICO (slug)
// ─────────────────────────────────────────
export function generarCodigo(nombre: string): string {
  return nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

// ─────────────────────────────────────────
// PARSEAR PRECIO
// ─────────────────────────────────────────
function parsearPrecio(valor: any): number {
  if (valor === null || valor === undefined || valor === '') return 0
  const str = valor.toString().replace(/[^0-9.-]/g, '')
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

// ─────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────
export function limpiarYProcesarExcel(filas: any[][]): ResultadoLimpieza {
  const errores: string[] = []
  const duplicadosUnificados: string[] = []
  const productosMap = new Map<string, ProductoLimpio>()

  // Detectar header
  let inicioIdx = 0
  let idxMarca = 0
  let idxCategoria = 1
  let idxReferencia = 2
  let idxCantidad = 3
  let idxPrecioMayorista = 4
  let idxPrecioTat = 5
  let idxPrecioUnidad = 6

  if (filas.length > 0) {
    const primeraFila = filas[0].map((c) => limpiarTexto(c).toUpperCase())
    if (
      primeraFila.includes('MARCA') ||
      primeraFila.includes('REFERENCIA') ||
      primeraFila.includes('CATEGORIA')
    ) {
      inicioIdx = 1
      const h = primeraFila

      const iMarca = h.indexOf('MARCA')
      const iCat = h.indexOf('CATEGORIA')
      const iRef = h.indexOf('REFERENCIA')
      const iCant = h.indexOf('CANTIDAD')
      const iPrecioMay = h.findIndex((x) => x.includes('PRECIO MAYORISTA'))
      const iPrecioTat = h.findIndex((x) => x.includes('PRECIO TAT'))
      const iPrecioUni = h.findIndex((x) => x.includes('PRECIO UNIDAD'))

      if (iMarca >= 0) idxMarca = iMarca
      if (iCat >= 0) idxCategoria = iCat
      if (iRef >= 0) idxReferencia = iRef
      if (iCant >= 0) idxCantidad = iCant
      if (iPrecioMay >= 0) idxPrecioMayorista = iPrecioMay
      if (iPrecioTat >= 0) idxPrecioTat = iPrecioTat
      if (iPrecioUni >= 0) idxPrecioUnidad = iPrecioUni
    }
  }

  // Procesar filas
  for (let i = inicioIdx; i < filas.length; i++) {
    const fila = filas[i]
    if (!fila || fila.length === 0) continue

    try {
      const marcaRaw = limpiarTexto(fila[idxMarca])
      const categoriaRaw = limpiarTexto(fila[idxCategoria])
      const referenciaRaw = limpiarTexto(fila[idxReferencia])
      const cantidadRaw = fila[idxCantidad]
      const precioMayoristaRaw = fila[idxPrecioMayorista]
      const precioTatRaw = fila[idxPrecioTat]
      const precioUnidadRaw = fila[idxPrecioUnidad]

      if (!referenciaRaw) {
        errores.push(`Fila ${i + 1}: Sin referencia`)
        continue
      }

      const cantidad = parseInt(String(cantidadRaw)) || 0
      if (cantidad < 0) {
        errores.push(`Fila ${i + 1}: Cantidad inválida (${cantidadRaw})`)
        continue
      }

      // Nombre
      const nombre = limpiarTexto(aplicarCorrecciones(referenciaRaw))

      // Marca / categoría
      const marca = normalizarMarca(marcaRaw)
      const categoria = normalizarCategoria(categoriaRaw)

      // Código
      const codigo = generarCodigo(nombre)

      // ✅ Precios
      const precio_mayorista = parsearPrecio(precioMayoristaRaw)
      const precio_tat = parsearPrecio(precioTatRaw)
      const precio_unidad = parsearPrecio(precioUnidadRaw)

      // Duplicados
      if (productosMap.has(codigo)) {
        const existente = productosMap.get(codigo)!
        existente.cantidad += cantidad
        // Si el existente tiene precio 0 y este trae precio, actualizar
        if (existente.precio === 0 && precio_unidad > 0) {
          existente.precio = precio_unidad
          existente.precio_mayorista = precio_mayorista
          existente.precio_tat = precio_tat
        }
        duplicadosUnificados.push(
          `${nombre}: +${cantidad} (total: ${existente.cantidad})`
        )
      } else {
        productosMap.set(codigo, {
          nombre,
          marca,
          categoria,
          codigo,
          cantidad,
          precio: precio_unidad,
          precio_mayorista,
          precio_tat,
          activo: true,
        })
      }
    } catch (err: any) {
      errores.push(`Fila ${i + 1}: ${err.message}`)
    }
  }

  return {
    productos: Array.from(productosMap.values()),
    errores,
    duplicadosUnificados,
  }
}

// ─────────────────────────────────────────
// UTILIDADES DE FORMATO
// ─────────────────────────────────────────

export function formatNum(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('es-CO').format(num)
}

export function formatDateShort(fecha: string | Date | null | undefined): string {
  if (!fecha) return '—'
  try {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatDateTime(fecha: string | Date | null | undefined): string {
  if (!fecha) return '—'
  try {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}