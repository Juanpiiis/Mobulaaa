// lib/utils/dataExcel.ts

// ==========================================
// 1. Lista de colores conocidos
// ==========================================
export const COLORES_CONOCIDOS = [
  'BLANCO', 'NEGRO', 'GRIS', 'AZUL', 'ROJO', 'VERDE', 'MORADO', 'ROSADO', 
  'DORADO', 'PLATEADO', 'BEIGE', 'AMARILLO', 'NARANJA', 'DORADO/ROSADO', 
  'AZUL CLARO', 'AZUL OSCURO', 'MORADA', 'DOROADO'
]

// ==========================================
// 2. Diccionario para unificar nombres DUPLICADOS o con errores de tipeo
// ==========================================
export const MAPEO_DUPLICADOS: Record<string, string> = {
  'EASY-1 BLANCO POWER BANK': 'EASY 1 POWERBANK',
  'CC30 GRIS CARGADOR DE CARRO': 'CC30 NEGRO CARGADORES',
  'SV01 PLATEADO PARLANTE': 'SV01 GRIS PARLANTES',
  'SV80 NEGRO. PARLANTE': 'SV80 NEGRO PARLANTES',
  'TW11 PLATEADO SMART WATCH': 'TW11 NEGRO SMART WATCH',
  'F6001 PLATEADO CELULAR': 'F6001 NEGRO CELULAR',
  'F6001 VERDE CELULAR': 'F6001 NEGRO CELULAR',
  'X8 ULTRA 3 PLATEADO SMART WACH': 'X8 ULTRA 3 DORADO SMART WACH',
  'IW12 MINI NARANJA 2 SMARTWACH': 'IW12 MINI SURTIDOS SMARTWACH',
  'BUDS2  BLANCO AUDIFONOS': 'BUDS2 BLANCO AUDIFONOS',
  'BEAN 1 NEGRO ADIFONOS': 'BEAN 1 NEGRO AUDIFONOS',
  'BUDS 2 PRO BEIGE AUDIFINOS': 'BUDS 2 PRO BEIGE AUDIFONOS',
  'FUTURE POD BLANCO AUDIFINOS': 'FUTURE POD BLANCO AUDIFONOS',
  'FUTURE POD MORADO AUDIFINOS': 'FUTURE POD MORADO AUDIFONOS',
  'X9 PRO DOROADO RELOJ SMART': 'X9 PRO DORADO RELOJ SMART',
  'S2 PRO DORADO. SMART WATCH': 'S2 PRO DORADO SMART WATCH',
  'H9 PRO MIN NEGRO SMART WATCH': 'H9 PRO MINI NEGRO SMART WATCH',
  'R2 PRO  NEGRO RELOJ SMART WATCH': 'R2 PRO NEGRO RELOJ SMART WATCH',
  'IW12 MINI ROSAOD SMART WACH': 'IW12 MINI ROSADO SMART WACH',
  'MS ULTRA 2 PLATEADO , SMARTWACH': 'MS ULTRA 2 PLATEADO SMARTWACH',
  'C1 LITEMORADO DIADEMA': 'C1 LITE MORADO DIADEMA',
}

// ==========================================
// 3. Tipos internos
// ==========================================
export interface ProductoCrudo {
  descripcion: string
  categoria: string
  modelo: string
  color: string | null
  cantidad_sistema: number
  cantidad_fisica: number | string
  estado: string
  observacion: string | null
}

export interface ProductoFinal {
  descripcion: string
  categoria: string
  modelo: string
  color: string | null
  cantidad_sistema: number
  cantidad_fisica: number
  colores: string[]
  estado: string
  observacion: string | null
}

// ==========================================
// 4. Función principal (corregida para tu excel)
// ==========================================
export function limpiarYProcesarExcel(data: any[][]): ProductoFinal[] {
  let categoriaActual = ''
  const productosCrudos: ProductoCrudo[] = []
  const productosVistos = new Set<string>() // Evitar duplicados por descripción

  for (const row of data) {
    // Verificar que la fila tenga al menos 4 columnas
    if (!Array.isArray(row) || row.length < 4) continue

    const descripcion = (row[0]?.toString() || '').trim()
    const existencia = Number(row[2]) || 0
    const fisicoRaw = row[3]
    const observacionRaw = (row[4]?.toString() || '').trim()

    // 🚨 SALTAR ENCABEZADOS Y FILAS BASURA
    if (
      !descripcion || 
      descripcion.includes('MOBULAA') || 
      descripcion.includes('Total de') || 
      descripcion.includes('Total Cantidad') ||
      descripcion.includes('Descripción') || // Encabezado
      descripcion.includes('Und. Medida') ||  // Encabezado
      descripcion.includes('Existencia') ||   // Encabezado
      descripcion.includes('Fisico') ||       // Encabezado
      descripcion.includes('Físico') ||       // Encabezado
      descripcion.includes('PRODUCTOS NO FABRICADOS') // Título
    ) {
      continue
    }

    // 🚨 DETECTAR CATEGORÍA NUEVA (Mayúsculas sin números)
    if (descripcion === descripcion.toUpperCase() && !/\d/.test(descripcion) && descripcion.length > 3) {
      categoriaActual = descripcion
      continue
    }

    // 🚨 CORREGIR NOMBRES (Mapeo de duplicados y tipeos)
    const nombreNormalizado = MAPEO_DUPLICADOS[descripcion] || descripcion

    // Evitar que se procese el mismo producto dos veces (duplicados)
    if (productosVistos.has(nombreNormalizado)) continue
    productosVistos.add(nombreNormalizado)

    // Detectar modelo y color
    let modelo = ''
    let color: string | null = null
    const palabras = nombreNormalizado.split(' ')

    for (const palabra of palabras) {
      const upper = palabra.toUpperCase().replace(/[.,]/g, '')
      if (COLORES_CONOCIDOS.includes(upper)) {
        color = upper
        break
      }
    }

    for (const palabra of palabras) {
      if (/\d/.test(palabra) && /[A-Za-z]/.test(palabra)) {
        modelo = palabra.toUpperCase().replace(/[.,]/g, '')
        break
      }
    }

    // Manejar observaciones especiales y cantidad física
    let cantidadFisica: number | string = existencia
    let estado = 'normal'
    let observacion = observacionRaw || null

    if (typeof fisicoRaw === 'number' && !isNaN(fisicoRaw)) {
      cantidadFisica = fisicoRaw
    } else if (typeof fisicoRaw === 'string') {
      // Casos especiales
      if (fisicoRaw.includes('SIN CONTEO')) { 
        estado = 'sin_conteo'
        observacion = 'SIN CONTEO'
      }
      else if (fisicoRaw.includes('DUPLICADO')) estado = 'duplicado'
      else if (fisicoRaw.includes('SUMAR')) estado = 'unificado'
      else if (fisicoRaw.includes('NO ESTABA')) estado = 'nuevo'
      else if (fisicoRaw.includes('NO PERTENECE')) estado = 'nuevo'
      else if (fisicoRaw.includes('ROBO')) estado = 'robo'
      else if (fisicoRaw.includes('SE SUMA AL SURTIDO')) estado = 'unificado'
      else if (fisicoRaw.includes('MISMO COLOR')) estado = 'unificado'
      else if (fisicoRaw.includes('COLORES TROCADOS')) estado = 'duplicado'
    }

    // Para productos "unificados" (sumar a otro), la cantidad física es la del sistema
    if (estado === 'unificado') {
      cantidadFisica = existencia
    }

    productosCrudos.push({
      descripcion: nombreNormalizado,
      categoria: categoriaActual,
      modelo,
      color,
      cantidad_sistema: existencia,
      cantidad_fisica: fisicoRaw, // Guardamos el valor original para la API
      estado,
      observacion
    })
  }

  // ==========================================
  // 5. Unificar por modelo (para estadísticas de colores)
  // ==========================================
  const mapaPorModelo = new Map<string, ProductoFinal>()

  for (const prod of productosCrudos) {
    if (prod.estado === 'sin_conteo' || prod.estado === 'duplicado') {
      continue
    }

    const key = prod.modelo || prod.descripcion

    if (!mapaPorModelo.has(key)) {
      mapaPorModelo.set(key, {
        descripcion: prod.descripcion,
        categoria: prod.categoria,
        modelo: prod.modelo,
        color: prod.color,
        cantidad_sistema: prod.cantidad_sistema,
        cantidad_fisica: prod.cantidad_fisica as number,
        colores: prod.color ? [prod.color] : [],
        estado: prod.estado,
        observacion: prod.observacion
      })
    } else {
      const existente = mapaPorModelo.get(key)!
      if (prod.color && !existente.colores.includes(prod.color)) {
        existente.colores.push(prod.color)
      }
      // Si es 'unificado', sumamos la cantidad física al modelo existente
      if (prod.estado === 'unificado') {
        existente.cantidad_fisica += prod.cantidad_fisica as number
      }
    }
  }

  return Array.from(mapaPorModelo.values())
}

// ==========================================
// 6. Funciones de formateo (NUEVAS)
// ==========================================
export function formatNum(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return new Intl.NumberFormat('es-CO').format(num)
}

export function formatDateShort(dateString: string | Date): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}