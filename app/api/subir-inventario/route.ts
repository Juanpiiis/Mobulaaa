// app/api/subir-inventario/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { limpiarYProcesarExcel } from '@/lib/utils/dataExcel'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bodegaId = formData.get('bodega_id') as string

    if (!file || !bodegaId) {
      return NextResponse.json({ error: 'Faltan datos (archivo o bodega)' }, { status: 400 })
    }

    // Leer Excel (todas las hojas)
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)

    let todasLasFilas: any[][] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null })
      todasLasFilas = [...todasLasFilas, ...data]
    }

    if (todasLasFilas.length === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    // Limpiar
    const { productos, errores: erroresLimpieza, duplicadosUnificados } = limpiarYProcesarExcel(todasLasFilas)

    if (productos.length === 0) {
      return NextResponse.json({ error: 'No se encontraron productos válidos', detalle: erroresLimpieza }, { status: 400 })
    }

    const supabase = await createClient()

    // Categorías
    const categoriasUnicas = [...new Set(productos.map((p) => p.categoria))]
    for (const nombreCat of categoriasUnicas) {
      await supabase
        .from('categorias')
        .upsert({ nombre: nombreCat }, { onConflict: 'nombre', ignoreDuplicates: true })
    }

    const { data: categoriasDB } = await supabase.from('categorias').select('id, nombre')
    const categoriaMap = new Map<string, string>()
    categoriasDB?.forEach((c: any) => categoriaMap.set(c.nombre, c.id))

    let procesados = 0
    let errores = erroresLimpieza.length
    const erroresDetallados: string[] = [...erroresLimpieza]

    for (const prod of productos) {
      try {
        const categoria_id = categoriaMap.get(prod.categoria) || null

        const { data: productoDB, error: errProd } = await supabase
          .from('productos')
          .upsert(
            {
              nombre: prod.nombre,
              marca: prod.marca,
              categoria: prod.categoria,
              categoria_id,
              codigo: prod.codigo,
              precio: prod.precio,
              activo: prod.activo,
            },
            { onConflict: 'codigo' }
          )
          .select('id')
          .single()

        if (errProd || !productoDB) {
          errores++
          erroresDetallados.push(`Producto ${prod.nombre}: ${errProd?.message || 'sin ID'}`)
          continue
        }

        const { error: errInv } = await supabase
          .from('inventario')
          .upsert(
            {
              producto_id: productoDB.id,
              bodega_id: bodegaId,
              cantidad_disponible: prod.cantidad,
              cantidad_minima: 10,
            },
            { onConflict: 'producto_id,bodega_id' }
          )

        if (errInv) {
          errores++
          erroresDetallados.push(`Inventario ${prod.nombre}: ${errInv.message}`)
          continue
        }

        procesados++
      } catch (e: any) {
        errores++
        erroresDetallados.push(`Excepción ${prod.nombre}: ${e.message}`)
      }
    }

    return NextResponse.json({
      message: 'Inventario subido y limpiado correctamente',
      total_productos: productos.length,
      procesados,
      errores,
      duplicadosUnificados,
      erroresDetallados: erroresDetallados.slice(0, 50),
      categorias: categoriasUnicas,
    })
  } catch (error: any) {
    console.error('Error general:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar' }, { status: 500 })
  }
}