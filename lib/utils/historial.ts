// lib/utils/historial.ts
import { createClient } from '@/lib/supabase/client'

export type AccionHistorial =
    | 'creado'
    | 'editado'
    | 'aprobado_bodega'
    | 'rechazado_bodega'
    | 'aprobado_cartera'
    | 'rechazado_cartera'
    | 'despachado'
    | 'entregado'
    | 'revertido'
    | 'cancelado'
    | 'cotizacion_generada'

interface RegistrarCambioParams {
    pedidoId: string
    accion: AccionHistorial
    estadoAnterior?: string | null
    estadoNuevo?: string | null
    cambios?: Record<string, any> | null
    observacion?: string | null
}

export async function registrarCambioHistorial({
    pedidoId,
    accion,
    estadoAnterior = null,
    estadoNuevo = null,
    cambios = null,
    observacion = null,
}: RegistrarCambioParams): Promise<void> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.error('No hay usuario autenticado para registrar historial')
        return
    }

    const { data: perfil } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', user.id)
        .single()

    const { error } = await supabase.from('pedidos_historial').insert({
        pedido_id: pedidoId,
        usuario_id: user.id,
        usuario_nombre: perfil?.nombre || 'Usuario',
        accion,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        cambios,
        observacion,
    })

    if (error) {
        console.error('Error registrando historial:', error)
    }
}

/**
 * Revierte un pedido despachado.
 * - Solo ADMIN
 * - Solo pedidos en 'despachado'
 * - DEVUELVE stock al inventario (movimiento tipo 'entrada')
 * - Vuelve el pedido a 'aprobado_cartera'
 * - Marca pedido.revertido = true
 */
export async function revertirCambio({
    pedidoId,
    historialId,
    motivo,
}: {
    pedidoId: string
    historialId: string
    motivo: string
}): Promise<{ ok: boolean; error?: string }> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { ok: false, error: 'No hay usuario autenticado' }
    }

    const { data: perfil, error: errPerfil } = await supabase
        .from('usuarios')
        .select('nombre, rol')
        .eq('id', user.id)
        .single()

    if (errPerfil || !perfil) {
        return { ok: false, error: 'No se pudo verificar el usuario' }
    }

    if (perfil.rol !== 'admin') {
        return { ok: false, error: 'Solo el administrador puede revertir pedidos' }
    }

    if (!motivo || motivo.trim().length < 10) {
        return { ok: false, error: 'El motivo debe tener al menos 10 caracteres' }
    }

    const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .select(`
            id, estado, bodega_id,
            detalle_pedido(id, cantidad_solicitada, cantidad_aprobada, producto_id)
        `)
        .eq('id', pedidoId)
        .single()

    if (errPedido || !pedido) {
        return { ok: false, error: 'Pedido no encontrado' }
    }

    if (pedido.estado !== 'despachado') {
        return {
            ok: false,
            error: `Solo se pueden revertir pedidos en estado "despachado". Estado actual: ${pedido.estado}`,
        }
    }

    const { data: histItem, error: errHist } = await supabase
        .from('pedidos_historial')
        .select('id, revertido')
        .eq('id', historialId)
        .single()

    if (errHist || !histItem) {
        return { ok: false, error: 'Evento de historial no encontrado' }
    }

    if (histItem.revertido) {
        return { ok: false, error: 'Este evento ya fue revertido anteriormente' }
    }

    const detalle = (pedido.detalle_pedido || []) as any[]

    for (const d of detalle) {
        const cantidad = d.cantidad_aprobada || d.cantidad_solicitada || 0
        if (cantidad <= 0) continue

        await supabase.from('movimientos').insert({
            producto_id: d.producto_id,
            bodega_destino_id: pedido.bodega_id,
            cantidad,
            tipo: 'entrada',
            usuario_id: user.id,
            fecha: new Date().toISOString(),
            observacion: `Reversión de despacho pedido ${pedidoId.slice(0, 8)}`,
        })

        const { data: inv } = await supabase
            .from('inventario')
            .select('id, cantidad_disponible')
            .eq('producto_id', d.producto_id)
            .eq('bodega_id', pedido.bodega_id)
            .single()

        if (inv) {
            await supabase
                .from('inventario')
                .update({ cantidad_disponible: inv.cantidad_disponible + cantidad })
                .eq('id', inv.id)
        } else {
            await supabase.from('inventario').insert({
                producto_id: d.producto_id,
                bodega_id: pedido.bodega_id,
                cantidad_disponible: cantidad,
                cantidad_minima: 0,
            })
        }
    }

    const { error: errMarcar } = await supabase
        .from('pedidos_historial')
        .update({
            revertido: true,
            revertido_en: new Date().toISOString(),
            revertido_por: user.id,
            motivo_reversion: motivo.trim(),
        })
        .eq('id', historialId)

    if (errMarcar) {
        return { ok: false, error: 'Error marcando historial: ' + errMarcar.message }
    }

    const { error: errUpdate } = await supabase
        .from('pedidos')
        .update({
            estado: 'aprobado_cartera',
            revertido: true,
        })
        .eq('id', pedidoId)

    if (errUpdate) {
        return { ok: false, error: 'Error actualizando pedido: ' + errUpdate.message }
    }

    const { error: errNuevo } = await supabase.from('pedidos_historial').insert({
        pedido_id: pedidoId,
        usuario_id: user.id,
        usuario_nombre: perfil.nombre || 'Admin',
        accion: 'revertido',
        estado_anterior: 'despachado',
        estado_nuevo: 'aprobado_cartera',
        observacion: `Reversión de despacho. Motivo: ${motivo.trim()}`,
        cambios: {
            motivo: motivo.trim(),
            historial_id_original: historialId,
        },
    })

    if (errNuevo) {
        console.error('Error registrando reversión:', errNuevo)
    }

    return { ok: true }
}

/**
 * Cancela un pedido activo (pendiente, aprobado_bodega, aprobado_cartera).
 * - Solo ADMIN
 * - NO mueve stock
 * - Cambia estado a 'cancelado'
 * - Registra evento en historial con motivo
 */
export async function cancelarPedido({
    pedidoId,
    motivo,
}: {
    pedidoId: string
    motivo: string
}): Promise<{ ok: boolean; error?: string }> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { ok: false, error: 'No hay usuario autenticado' }
    }

    const { data: perfil, error: errPerfil } = await supabase
        .from('usuarios')
        .select('nombre, rol')
        .eq('id', user.id)
        .single()

    if (errPerfil || !perfil) {
        return { ok: false, error: 'No se pudo verificar el usuario' }
    }

    if (perfil.rol !== 'admin') {
        return { ok: false, error: 'Solo el administrador puede cancelar pedidos' }
    }

    if (!motivo || motivo.trim().length < 10) {
        return { ok: false, error: 'El motivo debe tener al menos 10 caracteres' }
    }

    const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .select('id, estado')
        .eq('id', pedidoId)
        .single()

    if (errPedido || !pedido) {
        return { ok: false, error: 'Pedido no encontrado' }
    }

    if (pedido.estado === 'cancelado') {
        return { ok: false, error: 'Este pedido ya está cancelado' }
    }

    if (['despachado', 'entregado'].includes(pedido.estado)) {
        return {
            ok: false,
            error: 'No se puede cancelar un pedido ya despachado o entregado',
        }
    }

    const estadoAnterior = pedido.estado

    const { error: errUpdate } = await supabase
        .from('pedidos')
        .update({ estado: 'cancelado' })
        .eq('id', pedidoId)

    if (errUpdate) {
        return { ok: false, error: 'Error actualizando pedido: ' + errUpdate.message }
    }

    const { error: errNuevo } = await supabase.from('pedidos_historial').insert({
        pedido_id: pedidoId,
        usuario_id: user.id,
        usuario_nombre: perfil.nombre || 'Admin',
        accion: 'cancelado',
        estado_anterior: estadoAnterior,
        estado_nuevo: 'cancelado',
        observacion: `Pedido cancelado. Motivo: ${motivo.trim()}`,
        cambios: { motivo: motivo.trim() },
    })

    if (errNuevo) {
        console.error('Error registrando cancelación:', errNuevo)
    }

    return { ok: true }
}

export const ACCION_LABELS: Record<AccionHistorial, string> = {
    creado: 'Pedido creado',
    editado: 'Pedido editado',
    aprobado_bodega: 'Aprobado por bodega',
    rechazado_bodega: 'Rechazado por bodega',
    aprobado_cartera: 'Aprobado por cartera',
    rechazado_cartera: 'Rechazado por cartera',
    despachado: 'Despachado',
    entregado: 'Entregado',
    revertido: 'Revertido',
    cancelado: 'Cancelado',
    cotizacion_generada: 'Cotización generada',
}

export const ACCION_COLORES: Record<AccionHistorial, string> = {
    creado: 'bg-blue-100 text-blue-700 border-blue-200',
    editado: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    aprobado_bodega: 'bg-green-100 text-green-700 border-green-200',
    rechazado_bodega: 'bg-red-100 text-red-700 border-red-200',
    aprobado_cartera: 'bg-green-100 text-green-700 border-green-200',
    rechazado_cartera: 'bg-red-100 text-red-700 border-red-200',
    despachado: 'bg-purple-100 text-purple-700 border-purple-200',
    entregado: 'bg-gray-100 text-gray-700 border-gray-200',
    revertido: 'bg-orange-100 text-orange-700 border-orange-200',
    cancelado: 'bg-red-100 text-red-700 border-red-200',
    cotizacion_generada: 'bg-[#1A0087]/10 text-[#1A0087] border-[#1A0087]/20',
}

export function formatearFechaHistorial(fecha: string): string {
    const date = new Date(fecha)
    return date.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}