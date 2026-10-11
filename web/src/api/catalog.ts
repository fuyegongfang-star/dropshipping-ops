import http from './http'

export interface Product {
  id: string
  tenantId: string
  title: string
  spu: string | null
  createdAt: string
}

export interface Sku {
  id: string
  tenantId: string
  productId: string
  code: string
  platformSku: string | null
  supplierSku: string | null
  barcode: string | null
  weightG: number
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  createdAt: string
}

export const catalogApi = {
  products: () => http.get<Product[]>('/catalog/products'),
  skus: (platformSku?: string, supplierSku?: string) => {
    const params = new URLSearchParams()
    if (platformSku) params.set('platformSku', platformSku)
    if (supplierSku) params.set('supplierSku', supplierSku)
    const qs = params.toString()
    return http.get<Sku[]>('/catalog/skus' + (qs ? `?${qs}` : ''))
  },
}
