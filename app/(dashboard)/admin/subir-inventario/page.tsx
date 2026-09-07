'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { ArrowUpTrayIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline'

export default function SubirInventarioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [bodegaId, setBodegaId] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  
  const supabase = createClient()
  const { bodegas } = useTienda()

  useEffect(() => {
    if (bodegas.length > 0) setBodegaId(bodegas[0]?.id || '')
  }, [bodegas])

  const handleUpload = async () => {
    if (!file || !bodegaId) {
      setError('Por favor selecciona un archivo y una bodega')
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
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Subir Conteo de Inventario</h1>
      <p className="text-sm text-gray-500 mb-6">Sube el archivo Excel (.xlsx). El sistema lo limpiará y procesará automáticamente.</p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Bodega / Tienda</label>
        <select
          value={bodegaId}
          onChange={e => setBodegaId(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A0087] outline-none"
          disabled={loading}
        >
          <option value="">Selecciona una bodega</option>
          {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
          dragActive ? 'border-[#1A0087] bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]) }}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <input id="file-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        
        {file ? (
          <div className="flex flex-col items-center">
            <DocumentArrowUpIcon className="w-12 h-12 text-[#1A0087] mb-3" />
            <p className="font-medium text-gray-800">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <ArrowUpTrayIcon className="w-12 h-12 text-gray-400 mb-3" />
            <p className="font-medium text-gray-600">Arrastra tu archivo aquí o haz clic para seleccionar</p>
            <p className="text-sm text-gray-400 mt-1">Formatos permitidos: .xlsx, .xls</p>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !file || !bodegaId}
        className="mt-6 w-full py-3 bg-[#1A0087] text-white font-semibold rounded-xl hover:bg-[#15006b] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Procesando inventario...
          </>
        ) : (
          <>
            <ArrowUpTrayIcon className="w-5 h-5" />
            Subir y Procesar
          </>
        )}
      </button>

      {error && <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm"><strong>Error:</strong> {error}</div>}

      {resultado && (
        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Resultado de la Carga</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-xl text-center">
              <p className="text-2xl font-bold text-green-600">{resultado.procesados}</p>
              <p className="text-sm text-gray-600">Productos procesados</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl text-center">
              <p className="text-2xl font-bold text-red-600">{resultado.errores}</p>
              <p className="text-sm text-gray-600">Productos con error</p>
            </div>
          </div>
          {resultado.erroresDetallados?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Detalle de errores:</h3>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {resultado.erroresDetallados.slice(0, 20).map((err: string, i: number) => (
                  <li key={i} className="text-xs text-red-600 bg-red-50 p-2 rounded">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}