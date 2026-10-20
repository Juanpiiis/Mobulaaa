import { FiltrosStats, RangoFechas } from './types'

export function calcularRangos(f: FiltrosStats): RangoFechas {
    const desde = new Date(f.desde + 'T00:00:00')
    const hasta = new Date(f.hasta + 'T23:59:59')

    const ms = hasta.getTime() - desde.getTime()
    const anteriorHasta = new Date(desde.getTime() - 1000)
    const anteriorDesde = new Date(anteriorHasta.getTime() - ms)

    return {
        actual: { desde, hasta },
        anterior: { desde: anteriorDesde, hasta: anteriorHasta },
    }
}

export function iso(d: Date) {
    return d.toISOString()
}

export function etiquetaMes(d: Date) {
    return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
}

export function etiquetaDia(d: Date) {
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}