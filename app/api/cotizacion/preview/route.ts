// app/api/cotizacion/preview/route.ts
// Genera un PDF de cotización SIN subirlo a Drive.
// Se usa para mostrar/descargar el borrador mientras el pedido no ha sido aprobado por cartera.
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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { pedidoId } = body

        if (!pedidoId) {
            return NextResponse.json({ error: 'Falta pedidoId' }, { status: 400 })
        }

        const supabase = await createClient()

        // 1. Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        // 2. Verificar rol (vendedor, bodeguero, cartera, admin pueden ver)
        const { data: perfil } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', user.id)
            .single()

        if (!perfil || !['admin', 'cartera', 'bodeguero', 'vendedor'].includes(perfil.rol)) {
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
        }

        // 3. Cargar pedido
        const { data: pedido, error: errPedido } = await supabase
            .from('pedidos')
            .select(`
                *,
                clientes(nombre, cc_nit, telefono, email, direccion),
                bodegas(nombre),
                detalle_pedido(cantidad_solicitada, cantidad_aprobada, productos(nombre, codigo, precio))
            `)
            .eq('id', pedidoId)
            .single()

        if (errPedido || !pedido) {
            return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
        }

        // 4. Preparar datos
        const estadoCotizacion = getEstadoCotizacion(pedido.estado)
        const marcaAgua = getMarcaAgua(estadoCotizacion)

        const items = (pedido.detalle_pedido || []).map((d: any) => {
            const cantidad = d.cantidad_aprobada || d.cantidad_solicitada
            const precio = d.productos?.precio || 0
            return {
                codigo: d.productos?.codigo || null,
                nombre: d.productos?.nombre || 'Producto',
                cantidad,
                precio,
                total: precio * cantidad,
            }
        })

        const pdfData = {
            numeroCotizacion: pedido.numero_cotizacion || `Borrador #${String(pedido.id).slice(0, 8)}`,
            fecha: formatearFechaCotizacion(pedido.fecha),
            estado: estadoCotizacion,
            marcaAgua,
            cliente: pedido.clientes,
            items,
            subtotal: pedido.subtotal || 0,
            descuentoPorcentaje: pedido.descuento_porcentaje || 0,
            descuentoValor: pedido.descuento_valor || 0,
            total: pedido.total || 0,
            observacion: pedido.observacion,
            fechaVencimiento: calcularVencimiento(pedido.fecha),
        }

        // 5. Generar PDF
        const pdfBuffer = await renderToBuffer(
            React.createElement(CotizacionDocument, { data: pdfData }) as any
        )

        // 6. Nombre del archivo
        const nombreArchivo = pedido.numero_cotizacion
            ? `${pedido.numero_cotizacion}.pdf`
            : `Borrador-${String(pedido.id).slice(0, 8)}.pdf`

        // 7. Devolver como JSON con base64 (para que el frontend lo descargue sin problemas)
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