'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'

interface Producto { id: string; nombre: string; categoria: string; codigo: string }

const CATEGORIAS = ['AUDIFONO', 'CARGADOR', 'CABLES', 'RELOJ', 'PARLANTES', 'DIADEMAS', 'POWER BANK', 'CELULAR', 'TABLET', 'COMPUTADOR', 'VENTILADOR', 'OTROS']

export default function EntradasPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [form, setForm] = useState({ producto_id: '', cantidad: '', observacion: '' })
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [exito, setExito] = useState(false)
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data: p } = await supabase.from('productos').select('id, nombre, categoria, codigo').eq('activo', true).order('nombre')
      setProductos(p || [])
      setProductosFiltrados(p || [])
    }
    cargar()
  }, [])

  useEffect(() => {
    let filtrados = productos
    if (busqueda) filtrados = filtrados.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo.toLowerCase().includes(busqueda.toLowerCase()))
    if (filtroCategoria) filtrados = filtrados.filter(p => p.categoria === filtroCategoria)
    setProductosFiltrados(filtrados)
  }, [busqueda, filtroCategoria, productos])

  const seleccionarProducto = (p: Producto) => {
    setProductoSeleccionado(p)
    setForm({ ...form, producto_id: p.id })
    setBusqueda(p.nombre)
    setProductosFiltrados([])
  }

  const handleGuardar = async () => {
    if (!form.producto_id || !form.cantidad || !tiendaActual) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('movimientos').insert({
      producto_id: form.producto_id,
      bodega_destino_id: tiendaActual.id,
      cantidad: parseInt(form.cantidad),
      tipo: 'entrada',
      usuario_id: user?.id,
      fecha: new Date().toISOString(),
      observacion: form.observacion
    })

    const { data: inv } = await supabase
      .from('inventario')
      .select('id, cantidad_disponible')
      .eq('producto_id', form.producto_id)
      .eq('bodega_id', tiendaActual.id)
      .single()

    if (inv) {
      await supabase.from('inventario').update({
        cantidad_disponible: inv.cantidad_disponible + parseInt(form.cantidad)
      }).eq('id', inv.id)
    } else {
      await supabase.from('inventario').insert({
        producto_id: form.producto_id,
        bodega_id: tiendaActual.id,
        cantidad_disponible: parseInt(form.cantidad),
        cantidad_minima: 0
      })
    }

    setForm({ producto_id: '', cantidad: '', observacion: '' })
    setProductoSeleccionado(null)
    setBusqueda('')
    setLoading(false)
    setExito(true)
    setTimeout(() => setExito(false), 3000)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Entrada de Mercancía</h1>
        <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
      </div>

      {exito && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">✅ Entrada registrada y stock actualizado</div>}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <select className="w-full border p-2 rounded mb-3" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="block text-sm font-medium mb-1">Buscar producto</label>
          <input className="w-full border p-2 rounded" placeholder="Nombre o código..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setProductoSeleccionado(null); setForm({ ...form, producto_id: '' }) }} />
          {busqueda && !productoSeleccionado && productosFiltrados.length > 0 && (
            <div className="border rounded mt-1 max-h-48 overflow-y-auto shadow">
              {productosFiltrados.slice(0, 20).map(p => (
                <div key={p.id} className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b" onClick={() => seleccionarProducto(p)}>
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-gray-400 ml-2">{p.codigo}</span>
                </div>
              ))}
            </div>
          )}
          {productoSeleccionado && <div className="mt-2 p-2 bg-blue-50 rounded text-sm">✅ <span className="font-medium">{productoSeleccionado.nombre}</span> — {productoSeleccionado.categoria}</div>}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Cantidad que entra</label>
          <input className="w-full border p-2 rounded" type="number" min="1" placeholder="0" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Observación (opcional)</label>
          <input className="w-full border p-2 rounded" placeholder="Ej: Llegó proveedor, factura #123" value={form.observacion} onChange={e => setForm({ ...form, observacion: e.target.value })} />
        </div>

        <button onClick={handleGuardar} disabled={loading || !form.producto_id || !form.cantidad} className="w-full bg-green-600 text-white p-3 rounded hover:bg-green-700 disabled:opacity-50 font-medium">
          {loading ? 'Registrando...' : 'Registrar Entrada'}
        </button>
      </div>
    </div>
  )
}