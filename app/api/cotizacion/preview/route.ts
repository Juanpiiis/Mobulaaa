// app/api/cotizacion/preview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { CotizacionDocument } from '@/components/cotizaciones/CotizacionDocument'
import {
    formatearFechaCotizacion,
    calcularVencimiento,
    getEstadoCotizacion,
    getMarcaAgua,
} from '@/lib/utils/cotizacion'
import React from 'react'

// ─────────────────────────────────────────────
// Tipos locales para evitar dependencia del
// tipo generado por Supabase (que puede no
// tener aún las columnas nuevas).
// ─────────────────────────────────────────────
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

        if (!perfil || !['admin', 'cartera', 'bodeguero', 'vendedor'].includes(perfil.rol)) {
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
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
            numeroCotizacion:
                pedido.numero_cotizacion ||
                `Borrador #${String(pedido.id).slice(0, 8)}`,
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

        const nombreArchivo = pedido.numero_cotizacion
            ? `${pedido.numero_cotizacion}.pdf`
            : `Borrador-${String(pedido.id).slice(0, 8)}.pdf`

        const pdfBase64 = pdfBuffer.toString('base64')

        return NextResponse.json({
            ok: true,
            nombreArchivo,
            pdfBase64,
        })
    } catch (error: any) {
        console.error('Error generando preview:', error)
        return NextResponse.json(
            { error: error.message || 'Error al generar la vista previa' },
            { status: 500 }
        )
    }
}