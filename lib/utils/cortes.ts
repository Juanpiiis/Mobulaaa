// lib/utils/cortes.ts
import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────
export interface FilaExcel {
    marca: string
    categoria: string
    referencia: string
    cantidad: number
    precio_mayorista: number | null
    precio_tat: number | null
    precio_unidad: number | null
}

export interface ProductoBD {
    id: string
    nombre: string
    referencia_excel: string | null
    marca: string | null
    categoria_excel: string | null
    precio: number | null
    precio_mayorista: number | null
    precio_tat: number | null
    cantidad_actual: number
}

export type TipoCambio = 'nuevo' | 'modificado' | 'ausente' | 'sin_cambio'

export interface DiferenciaItem {
    producto_id: string | null
    referencia_excel: string
    marca: string | null
    categoria_excel: string | null
    tipo_cambio: TipoCambio
    cantidad_anterior: number | null
    cantidad_nueva: number
    diferencia: number | null
    precio_mayorista_anterior: number | null
    precio_mayorista_nuevo: number | null
    precio_tat_anterior: number | null
    precio_tat_nuevo: number | null
    precio_unidad_anterior: number | null
    precio_unidad_nuevo: number | null
}

// ─────────────────────────────────────────────────────
// Parsear el Excel
// ─────────────────────────────────────────────────────
export async function parsearExcel(file: File): Promise<FilaExcel[]> {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

    if (rows.length < 2) {
        throw new Error('El archivo está vacío o no tiene datos')
    }

    // Fila 0 = encabezados
    const headers = rows[0].map(h => String(h).trim().toUpperCase())
    const esperado = ['MARCA', 'CATEGORIA', 'REFERENCIA', 'CANTIDAD', 'PRECIO MAYORISTA', 'PRECIO TAT', 'PRECIO UNIDAD']

    const idx = {
        marca: headers.indexOf('MARCA'),
        categoria: headers.indexOf('CATEGORIA'),
        referencia: headers.indexOf('REFERENCIA'),
        cantidad: headers.indexOf('CANTIDAD'),
        precio_mayorista: headers.indexOf('PRECIO MAYORISTA'),
        precio_tat: headers.indexOf('PRECIO TAT'),
        precio_unidad: headers.indexOf('PRECIO UNIDAD'),
    }

    if (idx.marca === -1 || idx.categoria === -1 || idx.referencia === -1 || idx.cantidad === -1) {
        throw new Error(
            `El Excel no tiene la plantilla esperada. Debe tener las columnas: ${esperado.join(' | ')}`
        )
    }

    const filas: FilaExcel[] = []
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        const referencia = String(row[idx.referencia] || '').trim()
        const cantidadRaw = row[idx.cantidad]
        const cantidad = typeof cantidadRaw === 'number' ? cantidadRaw : parseInt(String(cantidadRaw || '0'))

        if (!referencia) continue
        if (isNaN(cantidad)) continue

        const precio_mayorista = idx.precio_mayorista !== -1 && row[idx.precio_mayorista] !== ''
            ? Number(row[idx.precio_mayorista])
            : null
        const precio_tat = idx.precio_tat !== -1 && row[idx.precio_tat] !== ''
            ? Number(row[idx.precio_tat])
            : null
        const precio_unidad = idx.precio_unidad !== -1 && row[idx.precio_unidad] !== ''
            ? Number(row[idx.precio_unidad])
            : null

        filas.push({
            marca: String(row[idx.marca] || '').trim(),
            categoria: String(row[idx.categoria] || '').trim(),
            referencia,
            cantidad,
            precio_mayorista,
            precio_tat,
            precio_unidad,
        })
    }

    if (filas.length === 0) {
        throw new Error('El archivo no contiene productos válidos')
    }

    return filas
}

// ─────────────────────────────────────────────────────
// Comparar con el estado actual
// ─────────────────────────────────────────────────────
export async function compararConUltimoCorte(
    supabase: any,
    filas: FilaExcel[],
    bodegaId: string
): Promise<DiferenciaItem[]> {
    // 1. Productos
    const { data: productosBD, error: errProd } = await supabase
        .from('productos')
        .select('id, nombre, referencia_excel, marca, categoria_excel, precio, precio_mayorista, precio_tat')
        .not('referencia_excel', 'is', null)

    if (errProd) throw new Error('Error cargando productos: ' + errProd.message)

    // 2. Inventario actual de la bodega
    const { data: inventarioBD, error: errInv } = await supabase
        .from('inventario')
        .select('producto_id, cantidad_disponible')
        .eq('bodega_id', bodegaId)

    if (errInv) throw new Error('Error cargando inventario: ' + errInv.message)

    const invMap = new Map<string, number>()
    for (const inv of inventarioBD || []) {
        invMap.set(inv.producto_id, inv.cantidad_disponible)
    }

    // 3. Mapa por referencia_excel
    const prodMap = new Map<string, ProductoBD>()
    for (const p of productosBD || []) {
        if (!p.referencia_excel) continue
        prodMap.set(p.referencia_excel, {
            id: p.id,
            nombre: p.nombre,
            referencia_excel: p.referencia_excel,
            marca: p.marca,
            categoria_excel: p.categoria_excel,
            precio: p.precio,
            precio_mayorista: p.precio_mayorista,
            precio_tat: p.precio_tat,
            cantidad_actual: invMap.get(p.id) || 0,
        })
    }

    const resultado: DiferenciaItem[] = []
    const referenciasEnExcel = new Set<string>()

    for (const fila of filas) {
        referenciasEnExcel.add(fila.referencia)
        const prod = prodMap.get(fila.referencia)

        if (!prod) {
            resultado.push({
                producto_id: null,
                referencia_excel: fila.referencia,
                marca: fila.marca,
                categoria_excel: fila.categoria,
                tipo_cambio: 'nuevo',
                cantidad_anterior: null,
                cantidad_nueva: fila.cantidad,
                diferencia: null,
                precio_mayorista_anterior: null,
                precio_mayorista_nuevo: fila.precio_mayorista,
                precio_tat_anterior: null,
                precio_tat_nuevo: fila.precio_tat,
                precio_unidad_anterior: null,
                precio_unidad_nuevo: fila.precio_unidad,
            })
            continue
        }

        const cantCambio = prod.cantidad_actual !== fila.cantidad
        const precioUniCambio = prod.precio !== fila.precio_unidad
        const precioMayCambio = prod.precio_mayorista !== fila.precio_mayorista
        const precioTatCambio = prod.precio_tat !== fila.precio_tat

        const hayCambio = cantCambio || precioUniCambio || precioMayCambio || precioTatCambio

        resultado.push({
            producto_id: prod.id,
            referencia_excel: fila.referencia,
            marca: fila.marca,
            categoria_excel: fila.categoria,
            tipo_cambio: hayCambio ? 'modificado' : 'sin_cambio',
            cantidad_anterior: prod.cantidad_actual,
            cantidad_nueva: fila.cantidad,
            diferencia: fila.cantidad - prod.cantidad_actual,
            precio_mayorista_anterior: prod.precio_mayorista,
            precio_mayorista_nuevo: fila.precio_mayorista,
            precio_tat_anterior: prod.precio_tat,
            precio_tat_nuevo: fila.precio_tat,
            precio_unidad_anterior: prod.precio,
            precio_unidad_nuevo: fila.precio_unidad,
        })
    }

    for (const prod of prodMap.values()) {
        if (referenciasEnExcel.has(prod.referencia_excel!)) continue
        const teniaStock = invMap.has(prod.id)
        if (!teniaStock) continue

        resultado.push({
            producto_id: prod.id,
            referencia_excel: prod.referencia_excel!,
            marca: prod.marca,
            categoria_excel: prod.categoria_excel,
            tipo_cambio: 'ausente',
            cantidad_anterior: prod.cantidad_actual,
            cantidad_nueva: 0,
            diferencia: -prod.cantidad_actual,
            precio_mayorista_anterior: prod.precio_mayorista,
            precio_mayorista_nuevo: null,
            precio_tat_anterior: prod.precio_tat,
            precio_tat_nuevo: null,
            precio_unidad_anterior: prod.precio,
            precio_unidad_nuevo: null,
        })
    }

    return resultado
}

// ─────────────────────────────────────────────────────
// Crear corte (recibe supabase)
// ─────────────────────────────────────────────────────
export async function crearCorte(
    supabase: any,
    {
        archivoNombre,
        bodegaId,
        diferencias,
        notas,
    }: {
        archivoNombre: string
        bodegaId: string
        diferencias: DiferenciaItem[]
        notas?: string
    }
): Promise<{ ok: boolean; corteId?: string; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'No autenticado' }

    const { data: perfil } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', user.id)
        .single()

    const totales = {
        total: diferencias.length,
        nuevos: diferencias.filter(d => d.tipo_cambio === 'nuevo').length,
        modificados: diferencias.filter(d => d.tipo_cambio === 'modificado').length,
        ausentes: diferencias.filter(d => d.tipo_cambio === 'ausente').length,
        sin_cambios: diferencias.filter(d => d.tipo_cambio === 'sin_cambio').length,
    }

    const { data: corte, error: errCorte } = await supabase
        .from('cortes')
        .insert({
            usuario_id: user.id,
            usuario_nombre: perfil?.nombre || 'Admin',
            archivo_nombre: archivoNombre,
            bodega_id: bodegaId,
            total_productos: totales.total,
            total_nuevos: totales.nuevos,
            total_modificados: totales.modificados,
            total_ausentes: totales.ausentes,
            total_sin_cambios: totales.sin_cambios,
            notas: notas || null,
        })
        .select('id')
        .single()

    if (errCorte || !corte) {
        return { ok: false, error: errCorte?.message || 'Error creando corte' }
    }

    const detalles = diferencias.map(d => ({
        corte_id: corte.id,
        producto_id: d.producto_id,
        referencia_excel: d.referencia_excel,
        marca: d.marca,
        categoria_excel: d.categoria_excel,
        bodega_id: bodegaId,
        tipo_cambio: d.tipo_cambio,
        cantidad_anterior: d.cantidad_anterior,
        cantidad_nueva: d.cantidad_nueva,
        diferencia: d.diferencia,
        precio_mayorista_anterior: d.precio_mayorista_anterior,
        precio_mayorista_nuevo: d.precio_mayorista_nuevo,
        precio_tat_anterior: d.precio_tat_anterior,
        precio_tat_nuevo: d.precio_tat_nuevo,
        precio_unidad_anterior: d.precio_unidad_anterior,
        precio_unidad_nuevo: d.precio_unidad_nuevo,
    }))

    const { error: errDetalle } = await supabase
        .from('cortes_detalle')
        .insert(detalles)

    if (errDetalle) {
        await supabase.from('cortes').delete().eq('id', corte.id)
        return { ok: false, error: 'Error guardando detalle: ' + errDetalle.message }
    }

    return { ok: true, corteId: corte.id }
}

// ─────────────────────────────────────────────────────
// Aplicar corte (recibe supabase)
// ─────────────────────────────────────────────────────
export async function aplicarCorteAlInventario(
    supabase: any,
    corteId: string
): Promise<{ ok: boolean; error?: string; movimientos?: number }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'No autenticado' }

    const { data: corte, error: errCorte } = await supabase
        .from('cortes')
        .select('id, bodega_id, aplicado, revertido')
        .eq('id', corteId)
        .single()

    if (errCorte || !corte) return { ok: false, error: 'Corte no encontrado' }
    if (corte.aplicado) return { ok: false, error: 'Este corte ya fue aplicado' }
    if (corte.revertido) return { ok: false, error: 'Este corte ya fue revertido' }

    const { data: detalle, error: errDetalle } = await supabase
        .from('cortes_detalle')
        .select('*')
        .eq('corte_id', corteId)

    if (errDetalle || !detalle) return { ok: false, error: 'Error cargando detalle' }

    let movimientosCreados = 0

    for (const d of detalle) {
        if (d.tipo_cambio === 'sin_cambio') continue

        if (d.tipo_cambio === 'nuevo') {
            const { data: nuevoProd, error: errNuevo } = await supabase
                .from('productos')
                .insert({
                    nombre: d.referencia_excel,
                    referencia_excel: d.referencia_excel,
                    marca: d.marca,
                    categoria_excel: d.categoria_excel,
                    precio: d.precio_unidad_nuevo,
                    precio_mayorista: d.precio_mayorista_nuevo,
                    precio_tat: d.precio_tat_nuevo,
                    activo: true,
                })
                .select('id')
                .single()

            if (errNuevo || !nuevoProd) {
                console.error('Error creando producto nuevo:', errNuevo)
                continue
            }

            await supabase.from('inventario').insert({
                producto_id: nuevoProd.id,
                bodega_id: corte.bodega_id,
                cantidad_disponible: d.cantidad_nueva,
                cantidad_minima: 0,
            })

            await supabase.from('movimientos').insert({
                producto_id: nuevoProd.id,
                bodega_destino_id: corte.bodega_id,
                cantidad: d.cantidad_nueva,
                tipo: 'entrada',
                usuario_id: user.id,
                observacion: `Alta por corte de inventario`,
            })
            movimientosCreados++
            continue
        }

        if (d.tipo_cambio === 'modificado' && d.producto_id) {
            const { data: inv } = await supabase
                .from('inventario')
                .select('id, cantidad_disponible')
                .eq('producto_id', d.producto_id)
                .eq('bodega_id', corte.bodega_id)
                .maybeSingle()

            if (inv) {
                await supabase
                    .from('inventario')
                    .update({ cantidad_disponible: d.cantidad_nueva })
                    .eq('id', inv.id)
            } else {
                await supabase.from('inventario').insert({
                    producto_id: d.producto_id,
                    bodega_id: corte.bodega_id,
                    cantidad_disponible: d.cantidad_nueva,
                    cantidad_minima: 0,
                })
            }

            if (
                d.precio_unidad_nuevo !== d.precio_unidad_anterior ||
                d.precio_mayorista_nuevo !== d.precio_mayorista_anterior ||
                d.precio_tat_nuevo !== d.precio_tat_anterior
            ) {
                await supabase
                    .from('productos')
                    .update({
                        precio: d.precio_unidad_nuevo,
                        precio_mayorista: d.precio_mayorista_nuevo,
                        precio_tat: d.precio_tat_nuevo,
                    })
                    .eq('id', d.producto_id)
            }

            if (d.diferencia && d.diferencia !== 0) {
                await supabase.from('movimientos').insert({
                    producto_id: d.producto_id,
                    bodega_destino_id: corte.bodega_id,
                    cantidad: Math.abs(d.diferencia),
                    tipo: d.diferencia > 0 ? 'entrada' : 'salida',
                    usuario_id: user.id,
                    observacion: `Ajuste por corte de inventario`,
                })
                movimientosCreados++
            }
            continue
        }

        if (d.tipo_cambio === 'ausente' && d.producto_id) {
            const { data: inv } = await supabase
                .from('inventario')
                .select('id, cantidad_disponible')
                .eq('producto_id', d.producto_id)
                .eq('bodega_id', corte.bodega_id)
                .maybeSingle()

            if (inv && inv.cantidad_disponible > 0) {
                await supabase
                    .from('inventario')
                    .update({ cantidad_disponible: 0 })
                    .eq('id', inv.id)

                await supabase.from('movimientos').insert({
                    producto_id: d.producto_id,
                    bodega_origen_id: corte.bodega_id,
                    cantidad: inv.cantidad_disponible,
                    tipo: 'salida',
                    usuario_id: user.id,
                    observacion: `Ausente en corte de inventario`,
                })
                movimientosCreados++
            }
        }
    }

    await supabase
        .from('cortes')
        .update({
            aplicado: true,
            aplicado_en: new Date().toISOString(),
            aplicado_por: user.id,
        })
        .eq('id', corteId)

    return { ok: true, movimientos: movimientosCreados }
}

// ─────────────────────────────────────────────────────
// Revertir corte (recibe supabase)
// ─────────────────────────────────────────────────────
export async function revertirCorte(
    supabase: any,
    corteId: string,
    motivo: string
): Promise<{ ok: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'No autenticado' }

    if (!motivo || motivo.trim().length < 10) {
        return { ok: false, error: 'El motivo debe tener al menos 10 caracteres' }
    }

    const { data: corte, error: errCorte } = await supabase
        .from('cortes')
        .select('id, aplicado, revertido')
        .eq('id', corteId)
        .single()

    if (errCorte || !corte) return { ok: false, error: 'Corte no encontrado' }
    if (corte.aplicado) return { ok: false, error: 'No se puede revertir un corte aplicado' }
    if (corte.revertido) return { ok: false, error: 'Este corte ya fue revertido' }

    const { error } = await supabase
        .from('cortes')
        .update({
            revertido: true,
            revertido_en: new Date().toISOString(),
            revertido_por: user.id,
            motivo_reversion: motivo.trim(),
        })
        .eq('id', corteId)

    if (error) return { ok: false, error: error.message }

    return { ok: true }
}