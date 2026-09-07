export type Rol = 'admin' | 'bodeguero' | 'vendedor' | 'cartera'

export type EstadoPedido = 'pendiente' | 'aprobado_bodega' | 'rechazado_bodega' | 'aprobado_cartera' | 'rechazado_cartera' | 'despachado' | 'entregado'
export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
  bodega_id?: string
  activo: boolean
}

export interface Bodega {
  id: string
  nombre: string
  direccion: string
  tipo: 'principal' | 'secundaria'
  activo: boolean
}

export interface Producto {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  codigo: string
  precio: number
  activo: boolean
}

export interface Inventario {
  id: string
  producto_id: string
  bodega_id: string
  cantidad_disponible: number
  cantidad_minima: number
}

export interface Movimiento {
  id: string
  producto_id: string
  bodega_origen_id?: string
  bodega_destino_id?: string
  cantidad: number
  tipo: 'entrada' | 'salida' | 'traslado'
  usuario_id: string
  fecha: string
  observacion?: string
}

export interface DetallePedido {
  id: string
  pedido_id: string
  producto_id: string
  cantidad_solicitada: number
  cantidad_aprobada?: number
}

export interface Pedido {
  id: string
  vendedor_id: string
  bodega_id: string
  estado: EstadoPedido
  fecha: string
  observacion?: string
  subtotal: number
  descuento_porcentaje: number
  descuento_valor: number
  total: number
  numero_factura?: string
}

export const DESCUENTOS = [
  { minimo: 5000000, porcentaje: 10 },
  { minimo: 2000000, porcentaje: 5 },
  { minimo: 1000000, porcentaje: 3 },
]

export const calcularDescuento = (subtotal: number): number => {
  const descuento = DESCUENTOS.find(d => subtotal >= d.minimo)
  return descuento?.porcentaje || 0
}

export const CATEGORIAS = [
  'AUDIFONO', 'CARGADOR', 'CABLES', 'RELOJ', 'PARLANTES', 
  'DIADEMAS', 'POWER BANK', 'CELULAR', 'TABLET', 'COMPUTADOR', 
  'VENTILADOR', 'OTROS'
]