// app/api/cotizacion/generar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { CotizacionDocument } from '@/components/cotizaciones/CotizacionDocument'
import { buscarOCrearSubcarpeta, subirPDFaDrive } from '@/lib/google/drive'
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

        // 2. Verificar rol
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
            return NextResponse.json(
                { error: 'Pedido no encontrado' },
                { status: 404 }
            )
        }

        if (!pedido.numero_cotizacion) {
            return NextResponse.json(
                { error: 'El pedido no tiene número de cotización asignado' },
                { status: 400 }
            )
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
            numeroCotizacion: pedido.numero_cotizacion,
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

        // 6. Nombre del archivo y subcarpeta
        const fecha = new Date(pedido.fecha)
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
        ]
        const nombreSubcarpeta = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`
        const nombreArchivo = `${pedido.numero_cotizacion}.pdf`

        // 7. Subir a Drive
        const subcarpetaId = await buscarOCrearSubcarpeta(nombreSubcarpeta)
        const { fileId, url } = await subirPDFaDrive(
            nombreArchivo,
            pdfBuffer,
            subcarpetaId
        )

        // 8. Guardar en BD
        const { error: errUpdate } = await supabase
            .from('pedidos')
            .update({
                pdf_url: url,
                pdf_drive_id: fileId,
            })
            .eq('id', pedidoId)

        if (errUpdate) {
            console.error('Error guardando link:', errUpdate)
            return NextResponse.json(
                {
                    error: 'PDF subido pero no se pudo guardar el link en la BD',
                    url,
                    fileId,
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            ok: true,
            url,
            fileId,
            numeroCotizacion: pedido.numero_cotizacion,
            subcarpeta: nombreSubcarpeta,
            nombreArchivo,
        })
    } catch (error: any) {
        console.error('Error generando cotización:', error)
        return NextResponse.json(
            { error: error.message || 'Error al generar cotización' },
            { status: 500 }
        )
    }
}