import Dexie, { Table } from 'dexie'

export interface Product {
  productId: string
  productName?: string
  parentProductName?: string
  internalName?: string
  mainImageUrl?: string
  goodIdentifications?: { type: string; value: string }[]
  updatedAt: number
}

export interface ProductInventory {
  productId: string
  facilityId: string
  availableToPromiseTotal: number
  quantityOnHandTotal: number
  updatedAt: number
}

export interface InventoryCountImportItem {
  inventoryCountImportId: string
  productId: string | null
  lotId: string | null
  uuid: string
  productIdentifier: string
  locationSeqId?: string | null
  quantity: number
  status: 'active' | 'closed'
  facilityId: string
  createdAt: number
  lastScanAt: number
  lastUpdatedAt?: number
  lastSyncedAt?: number | null
  lastSyncedBatchId?: string | null
  aggApplied?: number
  isRequested?: string,
  systemQuantityOnHand: number
}

export interface ScanEvent {
  id?: number
  scannedValue?: string
  scannedLotId?: string | null
  lotId?: string | null
  productId?: string | null
  inventoryCountImportId: string
  locationSeqId?: string | null
  quantity: number
  createdAt: number
  aggApplied: number
}

export interface LotAndProduct {
  lotId: string
  productId: string
}

export interface AppPreferences {
  key: string
  value: string
}

export interface LastSessionAndLocation {
  inventoryCountImportId: string
  locationSeqId: string
}

export class CommonDB extends Dexie {
  products!: Table<Product, string>
  productIdentification!: Table<{ productId: string; identKey: string; value: string }, [string, string]>
  productInventory!: Table<ProductInventory, [string, string]>
  inventoryCountRecords!: Table<InventoryCountImportItem, [string, string]>
  scanEvents!: Table<ScanEvent, number>
  appPreferences!: Table<AppPreferences, string>
  lotAndProduct!: Table<LotAndProduct, [string, string]>
  lastSessionAndLocation!: Table<LastSessionAndLocation, [string, string]>

  constructor(omsInstance: string) {
    super(`${omsInstance}-CommonDB`)

    this.version(1).stores({
      products: 'productId, updatedAt',
      productIdentification: '[productId+identKey], identKey, value',
      productInventory: '[productId+facilityId], productId, facilityId',
      inventoryCountRecords: '[inventoryCountImportId+uuid], inventoryCountImportId, uuid, productIdentifier, productId, quantity, isRequested',
      scanEvents: '++id, inventoryCountImportId, scannedValue, scannedLotId, productId, lotId, aggApplied',
      appPreferences: 'key',
      lotAndProduct: '[lotId+productId], lotId, productId',
      lastSessionAndLocation: '[inventoryCountImportId+locationSeqId], inventoryCountImportId, locationSeqId'
    })
  }
}

export function createCommonDB(omsInstance: string) {
  return new CommonDB(omsInstance);
}