// app/api/cotizacion/generar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { CotizacionDocument } from '@/components/cotizaciones/CotizacionDocument'
import { obtenerCarpetaAñoMes, subirPDFaDrive } from '@/lib/google/drive'
import {
    formatearFechaCotizacion,
    calcularVencimiento,
    getEstadoCotizacion,
    getMarcaAgua,
} from '@/lib/utils/cotizacion'
import React from 'react'

interface DetallePedidoRaw {
    cantidad_solicitada: number
    cantidad_aprobada: number | null
    precio_unitario: number | null
    tipo_precio: string | null
    descuento_porcentaje: number | null
    productos: {
        nombre: string
        codigo: string | null
        precio: number | null
        precio_mayorista: number | null
    } | null
}

interface PedidoRaw {
    id: string
    numero_cotizacion: string | null
    fecha: string
    estado: string
    observacion: string | null
    subtotal: number
    descuento_porcentaje: number
    descuento_valor: number
    descuento_manual_porcentaje: number | null
    total: number
    clientes: {
        nombre: string
        cc_nit: string | null
        telefono: string | null
        email: string | null
        direccion: string | null
    } | null
    bodegas: { nombre: string } | null
    detalle_pedido: DetallePedidoRaw[]
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { pedidoId } = body

        if (!pedidoId) {
            return NextResponse.json({ error: 'Falta pedidoId' }, { status: 400 })
        }

        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { data: perfil } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', user.id)
            .single()

        if (!perfil || !['admin', 'cartera'].includes(perfil.rol)) {
            return NextResponse.json(
                { error: 'Solo cartera y admin pueden generar cotizaciones' },
                { status: 403 }
            )
        }

        const { data: pedidoRaw, error: errPedido } = await supabase
            .from('pedidos')
            .select(`
                *,
                clientes(nombre, cc_nit, telefono, email, direccion),
                bodegas(nombre),
                detalle_pedido(
                    cantidad_solicitada,
                    cantidad_aprobada,
                    precio_unitario,
                    tipo_precio,
                    descuento_porcentaje,
                    productos(nombre, codigo, precio, precio_mayorista)
                )
            `)
            .eq('id', pedidoId)
            .single()

        if (errPedido || !pedidoRaw) {
            return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
        }

        const pedido = pedidoRaw as unknown as PedidoRaw

        if (!pedido.numero_cotizacion) {
            return NextResponse.json(
                { error: 'El pedido no tiene número de cotización asignado' },
                { status: 400 }
            )
        }

        const estadoCotizacion = getEstadoCotizacion(pedido.estado)
        const marcaAgua = getMarcaAgua(estadoCotizacion)

        const items = (pedido.detalle_pedido || []).map((d) => {
            const cantidad = d.cantidad_aprobada ?? d.cantidad_solicitada
            const precioBase = d.productos?.precio_mayorista ?? d.productos?.precio ?? 0
            const precio = d.precio_unitario ?? precioBase
            const subido = d.precio_unitario != null && d.precio_unitario > precioBase

            const descuentoPorcentaje = Math.min(
                Math.max(Number(d.descuento_porcentaje) || 0, 0),
                20
            )
            const bruto = precio * cantidad
            const valorDescuento = bruto * (descuentoPorcentaje / 100)
            const totalNeto = bruto - valorDescuento

            return {
                codigo: d.productos?.codigo || null,
                nombre: d.productos?.nombre || 'Producto',
                cantidad,
                precio,
                total: totalNeto,
                subido,
                precioBase,
                descuentoPorcentaje,
                valorDescuento,
            }
        })

        const subtotalBruto = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
        const totalDescProductos = items.reduce((s, i) => s + i.valorDescuento, 0)
        const subtotalConDescProductos = subtotalBruto - totalDescProductos

        const descGlobalPct = Math.min(
            Math.max(
                Number(pedido.descuento_manual_porcentaje ?? pedido.descuento_porcentaje) || 0,
                0
            ),
            100
        )
        const descGlobalValor = subtotalConDescProductos * (descGlobalPct / 100)
        const totalFinal = subtotalConDescProductos - descGlobalValor

        const pdfData = {
            numeroCotizacion: pedido.numero_cotizacion,
            fecha: formatearFechaCotizacion(pedido.fecha),
            estado: estadoCotizacion,
            marcaAgua,
            cliente: pedido.clientes,
            items,
            subtotal: subtotalBruto,
            descuentoPorcentaje: descGlobalPct,
            descuentoValor: descGlobalValor,
            total: totalFinal,
            observacion: pedido.observacion,
            fechaVencimiento: calcularVencimiento(pedido.fecha),
        }

        const pdfBuffer = await renderToBuffer(
            React.createElement(CotizacionDocument, { data: pdfData }) as any
        )

        const nombreArchivo = `${pedido.numero_cotizacion}.pdf`

        let fileId: string | null = null
        let url: string | null = null
        let driveError: string | null = null

        try {
            const nombreBodega = pedido.bodegas?.nombre || 'General'
            const fechaPedido = new Date(pedido.fecha)
            const carpetaMesId = await obtenerCarpetaAñoMes(nombreBodega, fechaPedido)
            const subida = await subirPDFaDrive(nombreArchivo, pdfBuffer, carpetaMesId)
            fileId = subida.fileId
            url = subida.url
            console.log('✅ PDF subido a Drive:', url)
        } catch (err: any) {
            driveError = err?.message || 'Error desconocido subiendo a Drive'
            console.warn('⚠️ Drive falló, pero el PDF se entrega igual:', driveError)
        }

        const { error: errUpdate } = await supabase
            .from('pedidos')
            .update({ pdf_url: url, pdf_drive_id: fileId })
            .eq('id', pedidoId)

        if (errUpdate) {
            console.error('Error guardando link en BD:', errUpdate)
        }

        const pdfBase64 = pdfBuffer.toString('base64')

        return NextResponse.json({
            ok: true,
            url,
            fileId,
            driveError,
            numeroCotizacion: pedido.numero_cotizacion,
            nombreArchivo,
            pdfBase64,
        })
    } catch (error: any) {
        console.error('Error generando cotización:', error)
        return NextResponse.json(
            { error: error.message || 'Error al generar cotización' },
            { status: 500 }
        )
    }
}