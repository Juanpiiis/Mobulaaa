'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import {
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

interface Bodega {
  id: string
  nombre: string
}

export default function SubirInventarioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [bodegaId, setBodegaId] = useState('')
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const supabase = createClient()
  const { tiendaActual } = useTienda()

  // Cargar bodegas activas
  useEffect(() => {
    const cargarBodegas = async () => {
      const { data } = await supabase
        .from('bodegas')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')
      setBodegas(data || [])

      // Auto-seleccionar la primera, o la tienda actual
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
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bodega_id', bodegaId)

      const response = await fetch('/api/subir-inventario', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al subir')
      setResultado(data)
      setFile(null)
      const input = document.getElementById('file-upload') as HTMLInputElement
      if (input) input.value = ''
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#232323]">
          Subir Inventario
        </h1>
        <p className="text-sm text-[#828282] mt-1">
          Sube el archivo Excel (.xlsx) con productos, cantidades y precios
        </p>
      </div>

      {/* Selector de bodega */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#232323] mb-1.5">
          Bodega destino
        </label>
        <select
          value={bodegaId}
          onChange={(e) => setBodegaId(e.target.value)}
          className="w-full sm:max-w-md border border-gray-200 px-3 py-2.5 rounded-xl text-base min-h-[44px] focus:border-[#1A0087] focus:outline-none focus:ring-2 focus:ring-[#1A0087]/10"
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
              Formatos permitidos: .xlsx, .xls
            </p>
          </div>
        )}
      </div>

      {/* Botón */}
      <button
        onClick={handleUpload}
        disabled={loading || !file || !bodegaId}
        className="mt-6 w-full min-h-[44px] py-3 bg-[#1A0087] text-white font-semibold rounded-xl hover:bg-[#130066] active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Procesando inventario...
          </>
        ) : (
          <>
            <ArrowUpTrayIcon className="w-5 h-5" />
            Subir y Procesar
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
          <XCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
            <h2 className="text-lg font-bold text-[#232323]">
              Carga completada
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-2xl font-bold text-[#232323]">
                {resultado.total_productos || 0}
              </p>
              <p className="text-xs text-[#828282]">Total Excel</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center">
              <p className="text-2xl font-bold text-green-600">
                {resultado.procesados || 0}
              </p>
              <p className="text-xs text-[#828282]">Guardados OK</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl text-center">
              <p className="text-2xl font-bold text-red-600">
                {resultado.errores || 0}
              </p>
              <p className="text-xs text-[#828282]">Con error</p>
            </div>
          </div>

          {resultado.categorias && resultado.categorias.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-[#232323] mb-2">
                Categorías procesadas ({resultado.categorias.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resultado.categorias.map((cat: string) => (
                  <span
                    key={cat}
                    className="text-xs bg-[#1A0087]/10 text-[#1A0087] px-2.5 py-1 rounded-lg font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {resultado.duplicadosUnificados &&
            resultado.duplicadosUnificados.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#232323] mb-2">
                  Duplicados unificados ({resultado.duplicadosUnificados.length}):
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {resultado.duplicadosUnificados.slice(0, 20).map(
                    (err: string, i: number) => (
                      <li
                        key={i}
                        className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded"
                      >
                        {err}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

          {resultado.erroresDetallados &&
            resultado.erroresDetallados.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#232323] mb-2">
                  Errores ({resultado.erroresDetallados.length}):
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {resultado.erroresDetallados.slice(0, 20).map(
                    (err: string, i: number) => (
                      <li
                        key={i}
                        className="text-xs text-red-600 bg-red-50 p-2 rounded"
                      >
                        {err}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  )
}