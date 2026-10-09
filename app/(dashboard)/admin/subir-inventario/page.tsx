'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { useRouter } from 'next/navigation'
import {
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

interface Bodega {
  id: string
  nombre: string
}

interface ResumenCorte {
  total: number
  nuevos: number
  modificados: number
  ausentes: number
  sin_cambios: number
}

export default function SubirInventarioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [bodegaId, setBodegaId] = useState('')
  const [notas, setNotas] = useState('')
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(false)
  const [corteCreado, setCorteCreado] = useState<{ corteId: string; resumen: ResumenCorte } | null>(null)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [aplicando, setAplicando] = useState(false)

  const supabase = createClient()
  const { tiendaActual } = useTienda()
  const router = useRouter()

  // Cargar bodegas activas
  useEffect(() => {
    const cargarBodegas = async () => {
      const { data } = await supabase
        .from('bodegas')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')
      setBodegas(data || [])

      if (data && data.length > 0) {
        if (tiendaActual) {
          setBodegaId(tiendaActual.id)
        } else {
          setBodegaId(data[0].id)
        }
      }
    }
    cargarBodegas()
  }, [tiendaActual, supabase])

  const handleUpload = async () => {
    if (!file || !bodegaId) {
      setError('Selecciona un archivo y una bodega')
      return
    }

    setLoading(true)
    setError('')
    setCorteCreado(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bodega_id', bodegaId)
      if (notas.trim()) formData.append('notas', notas.trim())

      const response = await fetch('/api/cortes/crear', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al crear corte')

      setCorteCreado({
        corteId: data.corteId,
        resumen: data.resumen,
      })

      setFile(null)
      const input = document.getElementById('file-upload') as HTMLInputElement
      if (input) input.value = ''
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAplicarAhora = async () => {
    if (!corteCreado) return

    const confirmar = window.confirm(
      '⚠️ ¿Estás seguro de aplicar este corte al inventario?\n\n' +
      'Esto va a:\n' +
      '• Actualizar el stock de los productos\n' +
      '• Crear productos nuevos\n' +
      '• Registrar movimientos de entrada/salida\n\n' +
      'Esta acción se puede revertir después.'
    )
    if (!confirmar) return

    setAplicando(true)
    try {
      const response = await fetch('/api/cortes/aplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corteId: corteCreado.corteId }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al aplicar')

      alert(
        `✅ Corte aplicado correctamente\n\n` +
        `Movimientos generados: ${data.movimientos || 0}`
      )

      // Redirigir al detalle del corte
      router.push(`/admin/cortes/${corteCreado.corteId}`)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      {/* HEADER */}
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4">
          <h1 className="text-2xl font-bold text-[#232323]">
            Subir Inventario
          </h1>
          <p className="text-sm text-[#828282] mt-0.5">
            Sube el Excel y crea un corte para comparar diferencias
          </p>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-6">

        {/* INFO */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 space-y-1">
            <p className="font-semibold">¿Cómo funciona?</p>
            <p>1. Subes el Excel con el inventario actual</p>
            <p>2. El sistema lo compara con el estado actual de la BD</p>
            <p>3. Se muestran las diferencias (nuevos, modificados, ausentes)</p>
            <p>4. Tú decides si <strong>aplicarlo al inventario</strong> o solo guardarlo como referencia</p>
          </div>
        </div>

        {/* Formulario (solo si no hay corte creado) */}
        {!corteCreado && (
          <>
            {/* Selector de bodega */}
            <div>
              <label className="block text-sm font-medium text-[#232323] mb-1.5">
                Bodega destino
              </label>
              <select
                value={bodegaId}
                onChange={(e) => setBodegaId(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 bg-white"
                disabled={loading}
              >
                <option value="">Selecciona una bodega</option>
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-colors cursor-pointer ${dragActive
                  ? 'border-[#1A0087] bg-[#1A0087]/5'
                  : 'border-gray-300 bg-white hover:bg-gray-50'
                }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
              }}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />

              {file ? (
                <div className="flex flex-col items-center">
                  <DocumentArrowUpIcon className="w-12 h-12 text-[#1A0087] mb-3" />
                  <p className="font-medium text-[#232323]">{file.name}</p>
                  <p className="text-sm text-[#828282]">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <ArrowUpTrayIcon className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="font-medium text-[#232323]">
                    Arrastra tu archivo aquí o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-[#828282] mt-1">
                    Formatos: .xlsx, .xls
                  </p>
                  <p className="text-xs text-[#828282] mt-3 max-w-sm">
                    Columnas esperadas: MARCA · CATEGORIA · REFERENCIA · CANTIDAD · PRECIO MAYORISTA · PRECIO TAT · PRECIO UNIDAD
                  </p>
                </div>
              )}
            </div>

            {/* Notas (opcional) */}
            <div>
              <label className="block text-sm font-medium text-[#232323] mb-1.5">
                Notas (opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Corte mensual de octubre, llegó mercancía de China..."
                rows={2}
                disabled={loading}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10 resize-none bg-white"
              />
            </div>

            {/* Botón subir */}
            <button
              onClick={handleUpload}
              disabled={loading || !file || !bodegaId}
              className="w-full min-h-[48px] py-3 bg-[#1A0087] text-white font-semibold rounded-xl hover:bg-[#130066] active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Procesando Excel...
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  Crear Corte
                </>
              )}
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
            <XCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Resultado del corte creado */}
        {corteCreado && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-7 h-7 text-green-600" />
              <div>
                <h2 className="text-lg font-bold text-[#232323]">
                  Corte creado exitosamente
                </h2>
                <p className="text-xs text-[#828282]">
                  El stock NO se ha modificado todavía
                </p>
              </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-[#232323]">
                  {corteCreado.resumen.total}
                </p>
                <p className="text-xs text-[#828282] mt-1">Total productos</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {corteCreado.resumen.nuevos}
                </p>
                <p className="text-xs text-[#828282] mt-1">➕ Nuevos</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {corteCreado.resumen.modificados}
                </p>
                <p className="text-xs text-[#828282] mt-1">📝 Modificados</p>
              </div>
              <div className="bg-red-50 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-red-600">
                  {corteCreado.resumen.ausentes}
                </p>
                <p className="text-xs text-[#828282] mt-1">❌ Ausentes</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-green-600">
                  {corteCreado.resumen.sin_cambios}
                </p>
                <p className="text-xs text-[#828282] mt-1">✅ Sin cambios</p>
              </div>
            </div>

            {/* Advertencia si hay ausentes */}
            {corteCreado.resumen.ausentes > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800">
                  <p className="font-semibold">Hay {corteCreado.resumen.ausentes} productos ausentes</p>
                  <p>Estos productos existen en la BD pero no en el Excel. Si aplicas el corte, se pondrá su stock en 0.</p>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setCorteCreado(null)
                  setNotas('')
                }}
                disabled={aplicando}
                className="flex-1 min-h-[48px] py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Subir otro Excel
              </button>
              <button
                onClick={() => {
                  router.push(`/admin/cortes/${corteCreado.corteId}`)
                }}
                disabled={aplicando}
                className="flex-1 min-h-[48px] py-3 border border-[#1A0087] rounded-xl text-sm font-semibold text-[#1A0087] bg-white hover:bg-[#1A0087]/5 disabled:opacity-50 transition-colors"
              >
                Ver detalle del corte
              </button>
              <button
                onClick={handleAplicarAhora}
                disabled={aplicando}
                className="flex-1 min-h-[48px] py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {aplicando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Aplicar al inventario
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}