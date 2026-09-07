// app/api/subir-inventario/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { limpiarYProcesarExcel } from '@/lib/utils/dataExcel'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const bodegaId = formData.get('bodega_id') as string

  if (!file || !bodegaId) {
    return NextResponse.json({ error: 'Faltan datos (archivo o bodega)' }, { status: 400 })
  }

  const supabase = createClient()

  try {
    // 1. Leer Excel
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    
    // 👇 CAMBIO CLAVE: Recorrer TODAS las hojas del Excel
    let todosLosDatos: any[][] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      // Leer con header: 1 para que las filas sean arrays simples
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null })
      todosLosDatos = [...todosLosDatos, ...data]
    }
    
    // 2. Limpiar datos (procesa todas las hojas a la vez)
    const productosLimpios = limpiarYProcesarExcel(todosLosDatos)

    // 3. Registro del corte
    const { data: corte, error: corteError } = await supabase
      .from('cortes')
      .insert({ bodega_id: bodegaId, estado: 'finalizado', observaciones: 'Carga automática desde Excel' })
      .select('id')
      .single()

    if (corteError) {
      console.error('💥 ERROR AL CREAR CORTE:', corteError)
      return NextResponse.json({ error: `Error al crear el corte: ${corteError.message}` }, { status: 500 })
    }

    // 4. Procesar cada producto
    let procesados = 0
    let errores = 0
    const erroresDetallados: string[] = []

    for (const prod of productosLimpios) {
      try {
        // Buscar o crear categoría
        const { data: categoria } = await supabase
          .from('categorias')
          .select('id')
          .eq('nombre', prod.categoria)
          .maybeSingle()

        let categoriaId = categoria?.id
        if (!categoriaId) {
          const { data: nuevaCat } = await supabase
            .from('categorias')
            .insert({ nombre: prod.categoria })
            .select('id')
            .single()
          categoriaId = nuevaCat?.id
        }

        // Buscar o crear producto
        const { data: producto } = await supabase
          .from('productos')
          .select('id, nombre')
          .eq('nombre', prod.descripcion)
          .maybeSingle()

        let productoId = producto?.id
        if (!productoId) {
          const { data: nuevoProd } = await supabase
            .from('productos')
            .insert({
              nombre: prod.descripcion,
              categoria_id: categoriaId,
              modelo: prod.modelo,
              color: prod.color,
              sku: prod.descripcion.replace(/\s/g, '-').toUpperCase()
            })
            .select('id')
            .single()
          productoId = nuevoProd?.id
        }

        // Insertar en detalle_cortes
        const { error: detalleError } = await supabase
          .from('detalle_cortes')
          .insert({
            corte_id: corte.id,
            producto_id: productoId,
            cantidad_sistema: prod.cantidad_sistema,
            cantidad_fisica: prod.cantidad_fisica,
            observacion: prod.observacion
          })

        if (detalleError) {
          errores++
          erroresDetallados.push(`Error guardando ${prod.descripcion}: ${detalleError.message}`)
        } else {
          procesados++
        }
      } catch (e: any) {
        errores++
        erroresDetallados.push(`Error interno con ${prod.descripcion}: ${e.message}`)
      }
    }

    return NextResponse.json({
      message: 'Inventario subido y limpiado correctamente',
      total_modelos: productosLimpios.length,
      total_colores: productosLimpios.reduce((acc, p) => acc + p.colores.length, 0),
      procesados,
      errores,
      erroresDetallados
    })

  } catch (error) {
    console.error('Error general:', error)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}