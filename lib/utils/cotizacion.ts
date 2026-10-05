// lib/utils/cotizacion.ts
import { createClient } from '@/lib/supabase/client'

/**
 * Genera un ID temporal para borradores de cotización
 */
export function generarIdTemporal(pedidoId: string): string {
    return `TEMP-${pedidoId.slice(0, 6).toUpperCase()}`
}

/**
 * Genera el siguiente número de cotización usando SECUENCIA de Postgres
 * Esto es 100% seguro con múltiples usuarios al mismo tiempo
 */
export async function generarNumeroCotizacion(
    supabase: ReturnType<typeof createClient>
): Promise<string> {
    const { data, error } = await supabase.rpc('siguiente_numero_cotizacion')

    if (error) {
        console.error('Error generando número cotización:', error)
        throw error
    }

    return data as string
}

/**
 * Genera el siguiente número de factura
 */
export function generarNumeroFactura(): string {
    const year = new Date().getFullYear()
    const random = Math.floor(Math.random() * 99999)
        .toString()
        .padStart(5, '0')
    return `FAC-${year}-${random}`
}

/**
 * Formatea una fecha para mostrar en la cotización
 */
export function formatearFechaCotizacion(fecha: string | Date): string {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha
    return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

/**
 * Calcula la fecha de vencimiento (15 días después)
 */
export function calcularVencimiento(fecha: string | Date): string {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha
    const vencimiento = new Date(date)
    vencimiento.setDate(vencimiento.getDate() + 15)
    return vencimiento.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

/**
 * Determina el estado visual de la cotización
 */
export type EstadoCotizacion = 'borrador' | 'pendiente' | 'oficial' | 'rechazado'

export function getEstadoCotizacion(estadoPedido: string): EstadoCotizacion {
    switch (estadoPedido) {
        case 'pendiente':
            return 'borrador'
        case 'aprobado_bodega':
            return 'pendiente'
        case 'aprobado_cartera':
        case 'despachado':
        case 'entregado':
            return 'oficial'
        case 'rechazado_bodega':
        case 'rechazado_cartera':
            return 'rechazado'
        default:
            return 'borrador'
    }
}

/**
 * Texto de la marca de agua según estado
 */
export function getMarcaAgua(estado: EstadoCotizacion): string | null {
    switch (estado) {
        case 'borrador':
            return 'BORRADOR'
        case 'pendiente':
            return 'PENDIENTE APROBACIÓN'
        case 'rechazado':
            return 'RECHAZADO'
        case 'oficial':
            return null
    }
}