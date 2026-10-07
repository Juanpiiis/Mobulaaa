'use client'

import { useState, useEffect } from 'react'
import {
    XMarkIcon,
    MagnifyingGlassIcon,
    UserIcon,
    PhoneIcon,
    UserPlusIcon,
    MapPinIcon,
    IdentificationIcon,
} from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { ClienteNuevoForm } from './ClienteNuevoForm'
import type { Cliente } from '@/types/clientes'

interface Props {
    abierto: boolean
    onClose: () => void
    onSeleccionar: (cliente: Cliente) => void
    onVerHistorial: (cliente: Cliente) => void
}

type ModoBusqueda = 'cc' | 'nombre'

// ─────────────────────────────────────────────────────
// Validaciones
// ─────────────────────────────────────────────────────
const soloNumeros = (str: string) => /^\d*$/.test(str)
const soloLetras = (str: string) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'.]*$/.test(str)

export function ClienteBuscadorModal({ abierto, onClose, onSeleccionar, onVerHistorial }: Props) {
    const [modo, setModo] = useState<ModoBusqueda>('cc')
    const [terminoCC, setTerminoCC] = useState('')
    const [terminoNombre, setTerminoNombre] = useState('')
    const [resultados, setResultados] = useState<Cliente[]>([])
    const [buscando, setBuscando] = useState(false)
    const [error, setError] = useState('')
    const [modoRegistro, setModoRegistro] = useState(false)
    const [clienteSeleccionadoTmp, setClienteSeleccionadoTmp] = useState<Cliente | null>(null)

    const supabase = createClient()

    const termino = modo === 'cc' ? terminoCC : terminoNombre
    const debounced = useDebounce(termino.trim(), 300)

    // Reset al abrir/cerrar
    useEffect(() => {
        if (abierto) {
            setModo('cc')
            setTerminoCC('')
            setTerminoNombre('')
            setResultados([])
            setError('')
            setModoRegistro(false)
            setClienteSeleccionadoTmp(null)
        }
    }, [abierto])

    // Al cambiar de modo, limpia los resultados
    useEffect(() => {
        setResultados([])
        setClienteSeleccionadoTmp(null)
        setError('')
    }, [modo])

    // Búsqueda con debounce
    useEffect(() => {
        setClienteSeleccionadoTmp(null)

        if (!debounced || debounced.length < 2) {
            setResultados([])
            setBuscando(false)
            return
        }

        const buscar = async () => {
            setBuscando(true)
            setError('')

            try {
                let data: Cliente[] | null = null
                let err: any = null

                if (modo === 'cc') {
                    // Solo busca por CC/NIT (parcial)
                    const res = await supabase
                        .from('clientes')
                        .select('*')
                        .eq('activo', true)
                        .ilike('cc_nit', `%${debounced}%`)
                        .order('nombre', { ascending: true })
                        .limit(10)
                    data = res.data as Cliente[] | null
                    err = res.error
                } else {
                    // Solo busca por nombre (parcial)
                    const res = await supabase
                        .from('clientes')
                        .select('*')
                        .eq('activo', true)
                        .ilike('nombre', `%${debounced}%`)
                        .order('nombre', { ascending: true })
                        .limit(10)
                    data = res.data as Cliente[] | null
                    err = res.error
                }

                if (err) {
                    console.error('Error buscando clientes:', err)
                    setError('Error al buscar clientes')
                    setResultados([])
                    return
                }

                setResultados(data || [])
            } catch (e: any) {
                console.error(e)
                setError('Error inesperado al buscar')
                setResultados([])
            } finally {
                setBuscando(false)
            }
        }

        buscar()
    }, [debounced, modo, supabase])

    const handleSeleccionar = (cliente: Cliente) => {
        setClienteSeleccionadoTmp(cliente)
    }

    const handleContinuar = () => {
        if (!clienteSeleccionadoTmp) return
        onSeleccionar(clienteSeleccionadoTmp)
        onClose()
    }

    const handleCreado = (nuevo: Cliente) => {
        setModoRegistro(false)
        onSeleccionar(nuevo)
        onClose()
    }

    const iniciarRegistro = () => {
        setModoRegistro(true)
    }

    const sinResultados = debounced.length >= 2 && !buscando && resultados.length === 0 && !clienteSeleccionadoTmp
    const esModoCC = modo === 'cc'

    if (!abierto) return null

    // Preparar datos para el form de nuevo cliente
    const ccParaForm = esModoCC ? terminoCC.trim() : ''
    const nombreParaForm = !esModoCC ? terminoNombre.trim() : ''
    // Si escribió solo números en modo nombre, no lo pasamos como nombre
    const nombreValidoParaForm = nombreParaForm && !soloNumeros(nombreParaForm) ? nombreParaForm : ''

    return (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#1A0087]/10 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-[#1A0087]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#232323]">Buscar cliente</h2>
                            <p className="text-[11px] text-[#828282]">
                                Encuentra o crea un cliente
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        aria-label="Cerrar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* CONTENIDO */}
                <div className="flex-1 overflow-y-auto">

                    {/* MODO BÚSQUEDA */}
                    {!modoRegistro && !clienteSeleccionadoTmp && (
                        <div className="p-5 space-y-4">

                            {/* TABS */}
                            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setModo('cc')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${esModoCC
                                        ? 'bg-white text-[#1A0087] shadow-sm'
                                        : 'text-[#828282] hover:text-[#232323]'
                                        }`}
                                >
                                    <IdentificationIcon className="w-4 h-4" />
                                    Por CC/NIT
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModo('nombre')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${!esModoCC
                                        ? 'bg-white text-[#1A0087] shadow-sm'
                                        : 'text-[#828282] hover:text-[#232323]'
                                        }`}
                                >
                                    <UserIcon className="w-4 h-4" />
                                    Por nombre
                                </button>
                            </div>

                            {/* INPUT según modo */}
                            <div>
                                <label className="block text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                    {esModoCC ? 'CC / NIT' : 'Nombre del cliente'}
                                </label>
                                <div className="relative">
                                    {esModoCC ? (
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={terminoCC}
                                            onChange={(e) => {
                                                const valor = e.target.value.replace(/\D/g, '')
                                                setTerminoCC(valor)
                                                setError('')
                                            }}
                                            placeholder="Escribe el CC o NIT..."
                                            className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#1A0087]/20 focus:border-[#1A0087]"
                                            autoFocus
                                            maxLength={15}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={terminoNombre}
                                            onChange={(e) => {
                                                const valor = e.target.value
                                                if (soloLetras(valor) || valor === '') {
                                                    setTerminoNombre(valor)
                                                    setError('')
                                                }
                                            }}
                                            placeholder="Escribe el nombre del cliente..."
                                            className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#1A0087]/20 focus:border-[#1A0087]"
                                            autoFocus
                                            maxLength={100}
                                        />
                                    )}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {buscando ? (
                                            <div className="w-5 h-5 border-2 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* BOTÓN CREAR NUEVO CLIENTE — SIEMPRE VISIBLE */}
                            <button
                                type="button"
                                onClick={iniciarRegistro}
                                className="w-full min-h-[48px] py-3 border-2 border-dashed border-[#1A0087]/40 rounded-xl text-sm font-semibold text-[#1A0087] hover:bg-[#1A0087]/5 active:bg-[#1A0087]/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <UserPlusIcon className="w-5 h-5" />
                                Crear nuevo cliente
                            </button>

                            {/* Estado idle */}
                            {debounced.length < 2 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2">
                                    <span className="text-blue-600 text-sm shrink-0">💡</span>
                                    <p className="text-xs text-blue-800">
                                        Escribe al menos 2 caracteres para buscar, o crea un cliente nuevo
                                    </p>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                    <p className="text-xs text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Resultados */}
                            {resultados.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-[#828282] uppercase tracking-wide mb-2">
                                        {resultados.length} {resultados.length === 1 ? 'cliente' : 'clientes'} encontrado{resultados.length === 1 ? '' : 's'}
                                    </p>
                                    <div className="space-y-2">
                                        {resultados.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => handleSeleccionar(c)}
                                                className="w-full text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-[#1A0087] hover:bg-[#1A0087]/5 active:scale-[0.98] transition-all"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-[#1A0087]/10 flex items-center justify-center shrink-0">
                                                        <UserIcon className="w-5 h-5 text-[#1A0087]" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-sm text-[#232323] truncate">
                                                            {c.nombre}
                                                        </p>
                                                        <p className="text-xs text-[#828282] mt-0.5">
                                                            CC/NIT: {c.cc_nit}
                                                        </p>
                                                        {c.telefono && (
                                                            <p className="text-xs text-[#828282] mt-0.5 flex items-center gap-1">
                                                                <PhoneIcon className="w-3 h-3" />
                                                                {c.telefono}
                                                            </p>
                                                        )}
                                                        {c.direccion && (
                                                            <p className="text-xs text-[#828282] mt-0.5 flex items-center gap-1 truncate">
                                                                <MapPinIcon className="w-3 h-3 shrink-0" />
                                                                <span className="truncate">{c.direccion}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sin resultados */}
                            {sinResultados && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                                    <p className="text-xs text-yellow-800">
                                        ⚠️ No hay clientes que coincidan con "<span className="font-medium">{debounced}</span>"
                                    </p>
                                    <p className="text-[11px] text-yellow-700 mt-1">
                                        Puedes crear uno nuevo con el botón de arriba
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CLIENTE SELECCIONADO — CONFIRMACIÓN */}
                    {!modoRegistro && clienteSeleccionadoTmp && (
                        <div className="p-5 space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
                                <span className="text-green-600 text-sm font-semibold">✓ Cliente seleccionado</span>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[#1A0087]/10 flex items-center justify-center shrink-0">
                                        <UserIcon className="w-6 h-6 text-[#1A0087]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-[#232323] text-base">
                                            {clienteSeleccionadoTmp.nombre}
                                        </p>
                                        <p className="text-sm text-[#828282] mt-1">
                                            CC/NIT: {clienteSeleccionadoTmp.cc_nit}
                                        </p>
                                        {clienteSeleccionadoTmp.telefono && (
                                            <p className="text-sm text-[#828282] mt-0.5 flex items-center gap-1.5">
                                                <PhoneIcon className="w-3.5 h-3.5" />
                                                {clienteSeleccionadoTmp.telefono}
                                            </p>
                                        )}
                                        {clienteSeleccionadoTmp.direccion && (
                                            <p className="text-sm text-[#828282] mt-0.5 flex items-center gap-1.5">
                                                <MapPinIcon className="w-3.5 h-3.5" />
                                                {clienteSeleccionadoTmp.direccion}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setClienteSeleccionadoTmp(null)}
                                        className="flex-1 min-h-[48px] px-4 py-2.5 text-sm border border-gray-300 rounded-xl text-[#232323] hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium"
                                    >
                                        Volver a buscar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onVerHistorial(clienteSeleccionadoTmp)}
                                        className="flex-1 min-h-[48px] px-4 py-2.5 text-sm border border-gray-300 rounded-xl text-[#232323] hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium"
                                    >
                                        Ver historial
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleContinuar}
                                        className="flex-1 min-h-[48px] px-4 py-2.5 text-sm bg-[#1A0087] text-white rounded-xl hover:bg-[#130066] active:scale-[0.98] transition-all font-semibold"
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODO REGISTRO */}
                    {modoRegistro && (
                        <div className="p-5">
                            <ClienteNuevoForm
                                ccNit={ccParaForm}
                                nombreInicial={nombreValidoParaForm}
                                telefonoInicial=""
                                onCreado={handleCreado}
                                onCancelar={() => setModoRegistro(false)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}