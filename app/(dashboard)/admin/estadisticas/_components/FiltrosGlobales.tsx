'use client'
import { FiltrosStats, PeriodoTipo } from './queries/types'

interface Props {
    filtros: FiltrosStats
    onChange: (f: FiltrosStats) => void
    bodegas: { id: string; nombre: string }[]
    tiendaActualId?: string | null
}

export function FiltrosGlobales({ filtros, onChange, bodegas, tiendaActualId }: Props) {
    const setTipo = (tipo: PeriodoTipo) => {
        const hoy = new Date()
        if (tipo === 'mes') {
            const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
            onChange({ ...filtros, tipo, desde: desde.toISOString().slice(0, 10), hasta: hoy.toISOString().slice(0, 10) })
        } else if (tipo === 'anio') {
            const desde = new Date(hoy.getFullYear(), 0, 1)
            onChange({ ...filtros, tipo, desde: desde.toISOString().slice(0, 10), hasta: hoy.toISOString().slice(0, 10) })
        } else {
            onChange({ ...filtros, tipo })
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
            <div>
                <label className="text-xs text-gray-500 block mb-1">Periodo</label>
                <div className="flex bg-gray-100 rounded-lg p-1">
                    {(['mes', 'anio', 'rango'] as PeriodoTipo[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTipo(t)}
                            className={`px-3 py-1.5 text-sm rounded-md ${filtros.tipo === t ? 'bg-[#1A0087] text-white' : 'text-gray-600'}`}
                        >
                            {t === 'mes' ? 'Mes' : t === 'anio' ? 'Año' : 'Rango'}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-xs text-gray-500 block mb-1">Desde</label>
                <input
                    type="date"
                    value={filtros.desde}
                    onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
            </div>
            <div>
                <label className="text-xs text-gray-500 block mb-1">Hasta</label>
                <input
                    type="date"
                    value={filtros.hasta}
                    onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
            </div>

            <div>
                <label className="text-xs text-gray-500 block mb-1">Bodega</label>
                <select
                    value={filtros.bodegaId || tiendaActualId || ''}
                    onChange={(e) => onChange({ ...filtros, bodegaId: e.target.value || null })}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                    <option value="">Todas</option>
                    {bodegas.map((b) => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 ml-auto">
                <input
                    type="checkbox"
                    checked={filtros.comparar}
                    onChange={(e) => onChange({ ...filtros, comparar: e.target.checked })}
                    className="w-4 h-4"
                />
                Comparar vs periodo anterior
            </label>
        </div>
    )
}