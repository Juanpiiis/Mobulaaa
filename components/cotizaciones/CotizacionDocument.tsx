// components/cotizaciones/CotizacionDocument.tsx
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from '@react-pdf/renderer'

// ─────────────────────────────────────────
// ESTILOS DEL PDF
// ─────────────────────────────────────────
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#232323',
    },
    // Marca de agua (simulada con texto grande rotado)
    watermarkContainer: {
        position: 'absolute',
        top: 300,
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity: 0.08,
        transform: 'rotate(-30deg)',
    },
    watermark: {
        fontSize: 80,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
        textAlign: 'center',
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 2,
        borderBottomColor: '#1A0087',
        paddingBottom: 12,
        marginBottom: 20,
    },
    brand: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: '#1A0087',
    },
    brandSub: {
        fontSize: 7,
        color: '#828282',
        letterSpacing: 3,
        marginTop: 2,
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    docTitle: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        color: '#232323',
    },
    docNumber: {
        fontSize: 11,
        fontFamily: 'Courier',
        color: '#1A0087',
        marginTop: 3,
    },
    docDate: {
        fontSize: 8,
        color: '#828282',
        marginTop: 4,
    },
    // Cliente
    sectionTitle: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: '#828282',
        letterSpacing: 1,
        marginBottom: 6,
        marginTop: 4,
    },
    clienteBox: {
        backgroundColor: '#F7F7F9',
        padding: 12,
        borderRadius: 6,
        marginBottom: 20,
    },
    clienteNombre: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: '#232323',
        marginBottom: 4,
    },
    clienteInfo: {
        fontSize: 9,
        color: '#555555',
        marginBottom: 2,
    },
    label: {
        fontFamily: 'Helvetica-Bold',
        color: '#828282',
    },
    // Tabla
    table: {
        marginBottom: 16,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1A0087',
        padding: 8,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
    },
    tableHeaderCell: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    tableRowAlt: {
        backgroundColor: '#FAFAFA',
    },
    colCodigo: { width: '15%' },
    colProducto: { width: '40%' },
    colCantidad: { width: '10%', textAlign: 'center' },
    colPrecio: { width: '17.5%', textAlign: 'right' },
    colTotal: { width: '17.5%', textAlign: 'right' },
    // Totales
    totalsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
        marginBottom: 20,
    },
    totalsBox: {
        width: 220,
    },
    totalsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
        fontSize: 9,
    },
    totalsLabel: {
        color: '#828282',
    },
    totalsValue: {
        fontFamily: 'Helvetica-Bold',
        color: '#232323',
    },
    totalsGrand: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        marginTop: 4,
        borderTopWidth: 2,
        borderTopColor: '#1A0087',
    },
    totalsGrandLabel: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: '#232323',
    },
    totalsGrandValue: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: '#1A0087',
    },
    descuentoRow: {
        color: '#10B981',
    },
    // Observaciones
    obsBox: {
        backgroundColor: '#F7F7F9',
        padding: 10,
        borderRadius: 4,
        marginBottom: 20,
    },
    obsText: {
        fontSize: 9,
        color: '#232323',
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        paddingTop: 8,
        textAlign: 'center',
    },
    footerText: {
        fontSize: 7,
        color: '#828282',
        marginBottom: 2,
    },
    footerBrand: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: '#1A0087',
        marginTop: 4,
    },
})

// ─────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────
export interface CotizacionData {
    numeroCotizacion: string
    fecha: string
    estado: 'borrador' | 'pendiente' | 'oficial' | 'rechazado'
    marcaAgua: string | null
    cliente: {
        nombre: string
        cc_nit: string | null
        telefono: string | null
        email: string | null
        direccion: string | null
    } | null
    items: {
        codigo: string | null
        nombre: string
        cantidad: number
        precio: number
        total: number
    }[]
    subtotal: number
    descuentoPorcentaje: number
    descuentoValor: number
    total: number
    observacion: string | null
    fechaVencimiento: string
}

// ─────────────────────────────────────────
// FORMATO DE MONEDA
// ─────────────────────────────────────────
function formatCOP(v: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(v)
}

// ─────────────────────────────────────────
// COMPONENTE PDF
// ─────────────────────────────────────────
export function CotizacionDocument({ data }: { data: CotizacionData }) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Marca de agua */}
                {data.marcaAgua && (
                    <View style={styles.watermarkContainer} fixed>
                        <Text style={styles.watermark}>{data.marcaAgua}</Text>
                    </View>
                )}

                {/* Encabezado */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.brand}>MOBULAA</Text>
                        <Text style={styles.brandSub}>TECNOLOGÍA</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.docTitle}>COTIZACIÓN</Text>
                        <Text style={styles.docNumber}>{data.numeroCotizacion}</Text>
                        <Text style={styles.docDate}>{data.fecha}</Text>
                    </View>
                </View>

                {/* Datos del cliente */}
                <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
                <View style={styles.clienteBox}>
                    <Text style={styles.clienteNombre}>
                        {data.cliente?.nombre || 'Sin cliente'}
                    </Text>
                    {data.cliente?.cc_nit && (
                        <Text style={styles.clienteInfo}>
                            <Text style={styles.label}>CC/NIT: </Text>
                            {data.cliente.cc_nit}
                        </Text>
                    )}
                    {data.cliente?.telefono && (
                        <Text style={styles.clienteInfo}>
                            <Text style={styles.label}>Teléfono: </Text>
                            {data.cliente.telefono}
                        </Text>
                    )}
                    {data.cliente?.email && (
                        <Text style={styles.clienteInfo}>
                            <Text style={styles.label}>Email: </Text>
                            {data.cliente.email}
                        </Text>
                    )}
                    {data.cliente?.direccion && (
                        <Text style={styles.clienteInfo}>
                            <Text style={styles.label}>Dirección: </Text>
                            {data.cliente.direccion}
                        </Text>
                    )}
                </View>

                {/* Tabla de productos */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.colCodigo]}>
                            CÓDIGO
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.colProducto]}>
                            PRODUCTO
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.colCantidad]}>
                            CANT.
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.colPrecio]}>
                            PRECIO
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.colTotal]}>
                            TOTAL
                        </Text>
                    </View>

                    {data.items.map((item, i) => (
                        <View
                            key={i}
                            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                        >
                            <Text style={[styles.colCodigo, { fontSize: 8, color: '#828282' }]}>
                                {item.codigo || '—'}
                            </Text>
                            <Text style={[styles.colProducto, { fontSize: 9 }]}>
                                {item.nombre}
                            </Text>
                            <Text style={[styles.colCantidad, { fontSize: 9 }]}>
                                {item.cantidad}
                            </Text>
                            <Text style={[styles.colPrecio, { fontSize: 9, color: '#555' }]}>
                                {formatCOP(item.precio)}
                            </Text>
                            <Text
                                style={[
                                    styles.colTotal,
                                    { fontSize: 9, fontFamily: 'Helvetica-Bold' },
                                ]}
                            >
                                {formatCOP(item.total)}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Totales */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalsRow}>
                            <Text style={styles.totalsLabel}>Subtotal</Text>
                            <Text style={styles.totalsValue}>{formatCOP(data.subtotal)}</Text>
                        </View>
                        {data.descuentoPorcentaje > 0 && (
                            <View style={styles.totalsRow}>
                                <Text style={[styles.totalsLabel, styles.descuentoRow]}>
                                    Descuento ({data.descuentoPorcentaje}%)
                                </Text>
                                <Text style={[styles.totalsValue, styles.descuentoRow]}>
                                    - {formatCOP(data.descuentoValor)}
                                </Text>
                            </View>
                        )}
                        <View style={styles.totalsGrand}>
                            <Text style={styles.totalsGrandLabel}>Total</Text>
                            <Text style={styles.totalsGrandValue}>
                                {formatCOP(data.total)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Observaciones */}
                {data.observacion && (
                    <>
                        <Text style={styles.sectionTitle}>OBSERVACIONES</Text>
                        <View style={styles.obsBox}>
                            <Text style={styles.obsText}>{data.observacion}</Text>
                        </View>
                    </>
                )}

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Cotización válida por 15 días</Text>
                    <Text style={styles.footerText}>
                        Vence el {data.fechaVencimiento}
                    </Text>
                    <Text style={styles.footerBrand}>
                        MOBULAA - Tecnología de alta calidad
                    </Text>
                </View>
            </Page>
        </Document>
    )
}