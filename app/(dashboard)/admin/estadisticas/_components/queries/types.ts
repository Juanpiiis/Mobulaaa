export type PeriodoTipo = 'mes' | 'anio' | 'rango'

export interface FiltrosStats {
    tipo: PeriodoTipo
    desde: string   // ISO yyyy-mm-dd
    hasta: string   // ISO yyyy-mm-dd
    bodegaId: string | null
    comparar: boolean
}

export interface RangoFechas {
    actual: { desde: Date; hasta: Date }
    anterior: { desde: Date; hasta: Date }
}

export const ESTADOS_VENTA = [
    'aprobado_cartera',
    'en_preparacion',
    'listo_para_despacho',
    'despachado',
    'entregado',
] as const

export const ESTADOS_PERDIDA = [
    'cancelado',
    'rechazado_cartera',
    'rechazado_bodega',
] as const