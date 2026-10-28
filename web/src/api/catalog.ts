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
  /** 条码校验位提示（仅 EAN-13/UPC-A 校验位不符时非空，不拦截录入） */
  barcodeCheckWarning?: string | null
}

/** SKU 多码（阶段7，任务 7.1） */
export interface SkuBarcode {
  id: string
  tenantId: string
  skuId: string
  code: string
  kind: string // supplier | internal | ean13 | other
  createdAt: string
}

/** 条码反查结果（扫商品码定位 SKU） */
export interface BarcodeLookupResult {
  skuId: string
  code: string
  productName: string
  matchedBy: 'main' | 'alt'
  kind?: string | null
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
  // —— 条码 / 多码管理（阶段7，任务 7.1）——
  barcodeLookup: (code: string) =>
    http.get<BarcodeLookupResult | null>(
      '/catalog/sku/barcode-lookup?code=' + encodeURIComponent(code),
    ),
  listBarcodes: (skuId: string) => http.get<SkuBarcode[]>(`/catalog/sku/${skuId}/barcodes`),
  addBarcode: (skuId: string, code: string, kind?: string) =>
    http.post<SkuBarcode>(`/catalog/sku/${skuId}/barcodes`, { code, kind }),
  deleteBarcode: (id: string) => http.delete<void>(`/catalog/sku/barcodes/${id}`),
  setMainBarcode: (skuId: string, barcodeId: string) =>
    http.patch<Sku>(`/catalog/sku/${skuId}/barcodes/main`, { barcodeId }),
}
