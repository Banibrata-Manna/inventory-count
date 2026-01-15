import { liveQuery } from 'dexie';
import { useProductMaster } from './useProductMaster';
import api from '@/services/RemoteAPI';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/appInitializer'
import { ScanEvent } from '@/services/commonDatabase'
import { useProductStore } from '@/stores/productStore';

interface RecordScanParams {
  inventoryCountImportId: string;
  lotId?: string;
  productId?: string;
  productIdentifier?: string;
  scannedLotId?: string;
  quantity: number;
  locationSeqId?: string | null;
}

/**
 * Utility Functions
 */
function currentMillis(): number {
  return Date.now();
}
/* Stateless functions */
  /** Records a scan event */
  async function recordScan(params: RecordScanParams): Promise<void> {
    const event: ScanEvent = {
      inventoryCountImportId: params.inventoryCountImportId,
      lotId: params.lotId || null,
      scannedLotId: params.scannedLotId || null,
      productId: params.productId || null,
      locationSeqId: params.locationSeqId || null,
      scannedValue: params.productIdentifier,
      quantity: params.quantity,
      createdAt: currentMillis(),
      aggApplied: 0
    };
    await db.scanEvents.add(event);
  }

  /**
   * Records a scan event and immediately aggregates it into the inventory count record.
   * This allows for instant UI updates via IndexDB live queries.
   */
  async function recordScanAndAggregate(params: RecordScanParams): Promise<void> {
    const now = currentMillis();

    // 1. Create Scan Event (marked as applied to avoid double-aggregation by worker)
    const event: ScanEvent = {
      inventoryCountImportId: params.inventoryCountImportId,
      lotId: params.lotId || null,
      scannedLotId: params.scannedLotId || null,
      productId: params.productId || null,
      locationSeqId: params.locationSeqId || null,
      scannedValue: params.productIdentifier,
      quantity: params.quantity,
      createdAt: now,
      aggApplied: 1
    };
    await db.scanEvents.add(event);

    // 2. Identify and update the target inventory count record in a transaction
    await db.transaction('rw', db.inventoryCountRecords, async () => {
      let existing;

      if (params.lotId || params.scannedLotId) {
        // LPN mode: match by lot ID or lot identifier within the same location
        existing = await db.inventoryCountRecords
          .where('inventoryCountImportId').equals(params.inventoryCountImportId)
          .and(item =>
            item.locationSeqId === params.locationSeqId &&
            (item.lotId === params.lotId || (!!params.scannedLotId && item.lotIdentifier === params.scannedLotId))
          ).first();
      } else {
        // Product mode: match by product ID or product identifier within the same location
        existing = await db.inventoryCountRecords
          .where('inventoryCountImportId').equals(params.inventoryCountImportId)
          .and(item =>
            item.locationSeqId === params.locationSeqId &&
            ((!!params.productId && item.productId === params.productId) || (!!params.productIdentifier && item.productIdentifier === params.productIdentifier))
          ).first();
      }

      if (existing) {
        await db.inventoryCountRecords.put({
          ...existing,
          quantity: (Number(existing.quantity) || 0) + Number(params.quantity),
          lastScanAt: now,
          lastUpdatedAt: now
        });
      } else {
        // Create a new record if it doesn't exist (undirected scan)
        const facilityId = useProductStore().getCurrentFacility.facilityId;
        await db.inventoryCountRecords.add({
          inventoryCountImportId: params.inventoryCountImportId,
          uuid: uuidv4(),
          productId: params.productId || null,
          lotId: params.lotId || null,
          productIdentifier: params.productIdentifier || '',
          lotIdentifier: params.scannedLotId || null,
          locationSeqId: params.locationSeqId || null,
          quantity: Number(params.quantity),
          status: 'active',
          facilityId: facilityId || '',
          createdAt: now,
          lastScanAt: now,
          lastUpdatedAt: now,
          isRequested: 'N',
          systemQuantityOnHand: 0
        });
      }
    });
  }

  async function storeInventoryCountItems(items: any[]) {
    if (!items?.length) return;

    // await useProductMaster().upsertInventoryFromSessionItems(items);
    try {
      // Normalize or enrich data before storing if needed
      const facilityId = useProductStore().getCurrentFacility.facilityId || '';
      const normalized = items.map((item: any) => ({
        inventoryCountImportId: item.inventoryCountImportId,
        productId: item.productId || null,
        lotId: item.lotId || null,
        uuid: item.uuid || uuidv4(),
        isRequested: item.isRequested || 'Y',
        productIdentifier: item.productIdentifier || null,
        lotIdentifier: item.lotIdentifier || null,
        locationSeqId: item.locationSeqId || null,
        quantity: item.quantity || 0,
        status: 'active',
        facilityId,
        createdAt: item.createdDate || currentMillis(),
        lastScanAt: item.lastUpdatedStamp || currentMillis(),
        lastUpdatedAt: item.lastUpdatedStamp || currentMillis(),
        lastSyncedAt: item.lastUpdatedStamp || currentMillis(), //Important: to ignore the items during first aggregation
        lastSyncedBatchId: null,
        aggApplied: 0,
        isBlocked: item.isBlocked
      }));

      // Dexie table name for inventory count items
      const table = db.table('inventoryCountRecords');

      // Insert or update efficiently
      await table.bulkPut(normalized);

    } catch (err) {
      console.error('[IndexedDB] Failed to store batch', err);
    }
  }

  async function searchInventoryItemsByIdentifier(inventoryCountImportId: string, keyword: string, segment: string) {
    if (!keyword?.trim()) return []    

    const value = keyword.trim().toLowerCase()

    let tableQuery = db.table('inventoryCountRecords').where('inventoryCountImportId').equals(inventoryCountImportId)
    let searchByProductIdQuery = db.table('inventoryCountRecords').where('inventoryCountImportId').equals(inventoryCountImportId)

    if (segment === 'counted') {
      tableQuery = tableQuery.and(item => item.quantity > 0)
      searchByProductIdQuery = searchByProductIdQuery.and(item => item.quantity > 0)
    } else if (segment === 'uncounted') {
      tableQuery = tableQuery.and(item => item.quantity === 0)
      searchByProductIdQuery = searchByProductIdQuery.and(item => item.quantity === 0)
    } else if (segment === 'undirected') {
      tableQuery = tableQuery.and(item => item.isRequested === 'N')
      searchByProductIdQuery = searchByProductIdQuery.and(item => item.isRequested === 'N')
    } else if (segment === 'unmatched') {
      tableQuery = tableQuery.and(item => !item.productId)
      searchByProductIdQuery = searchByProductIdQuery.and(item => !item.productId)
    }

    let resultSet = [];
    if (segment !== 'uncounted') {
      resultSet = await tableQuery
      .and(item => (item.productIdentifier || '').toLowerCase().includes(value))
      .toArray()
    }

    if (!resultSet.length) {
      const productIds = await useProductMaster().searchProducts(value)
      if (productIds) {
        resultSet = await searchByProductIdQuery
          .and(item => (productIds.includes(item.productId)))
          .toArray()
      }
    }
    // enrich with product info if cached
    for (const item of resultSet) {
      if (item.productId) {
        const product = await db.table('products').get(item.productId)
        if (product) item.product = product
      }
    }

    const productIds = [...new Set(resultSet.map(item => item.productId).filter(Boolean))] as string[]
    if (productIds.length) {
      const inventoryRecords = await db.productInventory
        .where('productId')
        .anyOf(productIds)
        .toArray()

      const inventoryMap = new Map(
        inventoryRecords.map((item: any) => [`${item.productId}::${item.facilityId}`, item])
      )

      resultSet = resultSet.map(item => ({
        ...item,
        inventory: item.productId ? inventoryMap.get(`${item.productId}::${item.facilityId}`) : undefined
      }))
    }
    return resultSet
  }

  async function getInventoryCountImportItems(inventoryCountImportId: string) {
    try {
      const records = await db.inventoryCountRecords
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .toArray();

      return records || [];
    } catch (err) {
      console.error('Error fetching inventory records from IndexedDB:', err);
      return [];
    }
  }

  async function getInventoryCountImportItemsCount(inventoryCountImportId: string, locationSeqId: string): Promise<number> {
    try {
      const count = await db.inventoryCountRecords
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .and(item => item.locationSeqId === locationSeqId)
        .count();

      return count;
    } catch (err) {
      console.error('Error counting inventory records from IndexedDB:', err);
      return 0;
    }
  }

  async function getInventoryCountImportByProductIdAndLocation(inventoryCountImportId: string, productId: string, locationSeqId: string) {
  if (!inventoryCountImportId || !productId) return ''; 
  try {
    const record = await db.inventoryCountRecords
      .where('inventoryCountImportId')
      .equals(inventoryCountImportId)
      .and(item => item.productId === productId)
      .and(item => item.locationSeqId === locationSeqId)
      .first();

    return record || null;
  } catch (err) {
    console.error('Failed to check direction status', err);
    return null;
  }
}

  async function getSessionProductIds(inventoryCountImportId: string, locationSeqId: string): Promise<string[]> {  
    try {
      const items = await db.inventoryCountRecords
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .and(item => item.locationSeqId === locationSeqId)
        .toArray();

      if (!items.length) return [];

      const counted = [];
      const uncounted = [];

      for (const item of items) {
        if (!item.productId) continue;
        if (item.quantity >= 0) counted.push(item.productId);
        else uncounted.push(item.productId);
      }

      // --- Deduplicate while preserving category order ---
      const distinctProducts = new Set<string>();

      const ordered = [
        ...counted.filter(id => !distinctProducts.has(id) && distinctProducts.add(id)),
        ...uncounted.filter(id => !distinctProducts.has(id) && distinctProducts.add(id)),
      ];

      return ordered;
    } catch (err) {
      console.error("Error fetching ordered productIds:", err);
      return [];
    }
  }

  async function getInventoryCountImportItemsByProductIds(inventoryCountImportId: string, productIds: any[]) {
    if (!inventoryCountImportId || !productIds.length) return [];
    // Assumes you have access to the Dexie db instance
    return db.inventoryCountRecords
      .where('inventoryCountImportId').equals(inventoryCountImportId)
      .and(item => productIds.includes(item.productId))
      .toArray();
  }


  function groupByProductAndSum(items: any[]) {
    const map = new Map<string, any>();
  
    for (const item of items) {
      if (!item.productId) continue;
      const key = String(item.productId).trim();
  
      if (!map.has(key)) {
        map.set(key, { ...item });
      } else {
        const existing = map.get(key);
        existing.quantity = (Number(existing.quantity) || 0) + (Number(item.quantity) || 0);
        existing.lastUpdatedAt = Math.max(
          Number(existing.lastUpdatedAt || 0),
          Number(item.lastUpdatedAt || 0)
        );
      }
    }
  
    return [...map.values()];
  }

  const getCurrentLocationSeqId = (inventoryCountImportId: string) => 
    liveQuery(async () => {
      const record = await db.lastSessionAndLocation
      .where('inventoryCountImportId')
      .equals(inventoryCountImportId)
      .first();
      return record?.locationSeqId || '';
    });

  const getLastLocationSeqId = async (inventoryCountImportId: string) => {
    const record = await db.lastSessionAndLocation
      .where('inventoryCountImportId')
      .equals(inventoryCountImportId)
      .first();
    return record?.locationSeqId || '';
  }

  const getLastSessionProductId = async (inventoryCountImportId: string, locationSeqId: string) => {
    const record = await db.lastSessionAndLocation
      .where('inventoryCountImportId')
      .equals(inventoryCountImportId)
      .and(r => r.locationSeqId === locationSeqId)
      .first();
    return record?.productId || '';
  }

  const getUnmatchedItems = (inventoryCountImportId: string, locationSeqId: string) =>
    liveQuery(async () => {  
      const items = await db.inventoryCountRecords
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .and(item => item.locationSeqId === locationSeqId)
        .filter(item => !item.productId)
        .toArray()

      const productIds = [...new Set(items.map(item => item.productId).filter(Boolean))] as any;
      const products = await db.products.bulkGet(productIds)
      const productMap = new Map(products.filter(Boolean).map((product: any) => [product.productId, product]))

      return items.map(item => ({
        ...item,
        product: productMap.get(item.productId || '')
      }))
    });

  const getCountedItems = (inventoryCountImportId: string, locationSeqId: string) =>
    liveQuery(async () => {  
      const items = await db.inventoryCountRecords
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .and(item => item.locationSeqId === locationSeqId)
        .filter(item => ((item.isRequested === 'Y' || item.isRequested === null) && Boolean(item.productId)))
        .toArray()

      const grouped = groupByProductAndSum(items)
      .filter(item => (Number(item.quantity) || 0) > 0)
      .sort((predecessor, successor) => Number(successor.lastUpdatedAt || 0) - Number(predecessor.lastUpdatedAt || 0));

      const productIds = grouped.map(item => item.productId);
      const products = await db.products.bulkGet(productIds)
      const productMap = new Map(products.filter(Boolean).map((product: any) => [product.productId, product]))
      return grouped.map(item => ({
        ...item,
        product: productMap.get(item.productId)
      }))
    });

  const getUncountedItems = (inventoryCountImportId: string, locationSeqId: string) =>
    liveQuery(async () => {  
      const items = await db.inventoryCountRecords
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .and(item => item.locationSeqId === locationSeqId)
        .toArray()

      const grouped = groupByProductAndSum(items)
      .filter(item => (Number(item.quantity) || 0) === 0);

      const productIds = grouped.map(item => item.productId);
      const products = await db.products.bulkGet(productIds)
      const productMap = new Map(products.filter(Boolean).map((product: any) => [product.productId, product]))


      const inventoryRecords = await db.productInventory
      .where('productId')
      .anyOf(productIds)
      .toArray()

      const inventoryMap = new Map(
        inventoryRecords.map((item: any) => [`${item.productId}::${item.facilityId}`, item])
      )
      return grouped.map(item => ({
        ...item,
        product: productMap.get(item.productId),
        inventory: inventoryMap.get(`${item.productId}::${item.facilityId}`)
      }))
    });

  const getUndirectedItems = (inventoryCountImportId: string, locationSeqId: string) =>
    liveQuery(async () => {    
      const items = await db.table('inventoryCountRecords')
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .and(item => item.locationSeqId === locationSeqId)
        .filter(item => item.isRequested === 'N' && Boolean(item.productId))
        .toArray();

      const grouped = groupByProductAndSum(items)
        .filter(item => (Number(item.quantity) || 0) > 0);

      const productIds = grouped.map(item => item.productId);
      const products = await db.products.bulkGet(productIds)
      const productMap = new Map(products.filter(Boolean).map((product: any) => [product.productId, product]))

      return grouped.map(item => ({
        ...item,
        product: productMap.get(item.productId)
      }))
    });

  const getScanEvents = (inventoryCountImportId: string, locationSeqId: string) =>
    liveQuery(async () => {    
      const events = await db.scanEvents
        .where('inventoryCountImportId')
        .equals(inventoryCountImportId)
        .and(event => event.locationSeqId === locationSeqId)
        .reverse()
        .sortBy('createdAt');

      const enriched = await Promise.all(
        events.map(async event => {
          if (event.productId) {
            const product = await db.products.get(event.productId);
            return { ...event, product };
          }
          return event;
        })
      );

      return enriched || [];
    });

  const getTotalCountedUnits = (inventoryCountImportId: string, locationSeqId: string) =>
  liveQuery(async () => { 
    const items = await db.inventoryCountRecords
      .where('inventoryCountImportId')
      .equals(inventoryCountImportId)
      .and(item => item.locationSeqId === locationSeqId)
      .toArray()

    return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  })

  const mapSessionAndLocation = async (inventoryCountImportId: string, productId: string, locationSeqId: string) => {
    await db.lastSessionAndLocation.put({
      inventoryCountImportId,
      productId,
      locationSeqId: locationSeqId
    });
  }

   /* API call functions moved from CountService.ts */   
const getInventoryCountImportSession = async (params: { inventoryCountImportId: string; }): Promise<any> => {
  return await api({
    url: `service/getInventoryCountImport`,
    method: 'POST',
    data: params
  });
}
async function discardSession(inventoryCountImportId: string): Promise<void> {
  try {
    await api({
      url: `inventory-cycle-count/cycleCounts/sessions/${inventoryCountImportId}`,
      method: 'PUT',
      data: {
        statusId: 'SESSION_VOIDED'
      }
    })
  } catch (err) {
    console.error(`useInventoryCountImport Failed to discard session ${inventoryCountImportId}`, err)
    throw err
  }
}

async function submitSession(inventoryCountImportId: string): Promise<void> {
  try {
    await api({
      url: `inventory-cycle-count/cycleCounts/sessions/${inventoryCountImportId}`,
      method: 'PUT',
      data: {
        statusId: 'SESSION_SUBMITTED'
      }
    })
  } catch (err) {
    console.error(`useInventoryCountImport Failed to submit InventoryCountImport ${inventoryCountImportId}`, err)
    throw err
  }
}

const updateSession = async (payload: any): Promise <any> => {
  return api({
    url: `service/updateInventoryCountSession`,
    method: "POST",
    data: payload
  })
}

const bulkUploadInventoryCounts = async (payload: any): Promise <any> => {
  return api({
    url: `inventory-cycle-count/cycleCounts/upload`,
    method: "post",
    ...payload
  });
}

const cloneSession = async (payload: any): Promise <any> => {
  return api({
    url: `inventory-cycle-count/cycleCounts/sessions/${payload.inventoryCountImportId}/cloneDirectedCount`,
    method: "post",
    data: payload
  })
}

const getSessionItemsByImportId = async (inventoryCountImportId: string, params: any): Promise<any> => {
  return await api({
    url: `service/getInventoryCountSessionItems`,
    method: 'POST',
    data: {
      inventoryCountImportId,
      ...params
    }
  });
}

const approveInventoryCountSessionItem = async (payload: any): Promise<any> => {
  return await api({
    url: `service/approveInventoryCountSessionItem`,
    method: 'POST',
    data: payload
  });
}

const rejectInventoryCountSessionItem = async (payload: any): Promise<any> => {
  return await api({
    url: `service/rejectInventoryCountSessionItem`,
    method: 'POST',
    data: payload
  });
}

const updateSessionItem = async (params: any): Promise<any> => {
  return await api({
    url: `inventory-cycle-count/cycleCounts/sessions/${params.inventoryCountImportId}/items`,
    method: 'PUT',
    data: params
  });
}

const deleteSessionItem = async (params: any): Promise<any> => {
  return await api({
    url: `inventory-cycle-count/cycleCounts/sessions/${params.inventoryCountImportId}/items`,
    method: 'DELETE',
    data: params.data
  });
}

const getSessionLock = async (payload: any): Promise<any> => {
  return await api({
    url: `service/getSessionLock`,
    method: 'POST',
    data: payload
  });
}

  const lockSession = async (payload: any): Promise<any> => {
    return await api({
      url: `service/createSessionLock`,
      method: 'POST',
      data: payload
    });
  }

  const releaseSession = async (payload: any): Promise<any> => {
    return await api({
      url: `service/updateInventoryCountImportLock`,
      method: 'POST',
      data: payload
    });
  }

  async function getInventoryCountImportItemCount(inventoryCountImportId: string, params: any) {
    return api({
      url: `service/getInventoryCountImportItemCount`,
      method: 'POST',
      data: { inventoryCountImportId, ...params }
    })
  }

  async function getServiceJobDetail(jobName: string) {
    return api({
      url: `admin/serviceJobs/${jobName}`,
      method: 'GET'
    })
  }
  
/**
 * Composable to manage InventoryCountImport related operations using singleton pattern
 */
export function useInventoryCountImport() {
    
  return {
    bulkUploadInventoryCounts,
    cloneSession,
    discardSession,
    getCountedItems,
    getCurrentLocationSeqId,
    getInventoryCountImportByProductIdAndLocation,
    getInventoryCountImportItemCount,
    getInventoryCountImportItems,
    getInventoryCountImportItemsByProductIds,
    getInventoryCountImportItemsCount,
    getInventoryCountImportSession,
    getScanEvents,
    getServiceJobDetail,
    getSessionItemsByImportId,
    getSessionProductIds,
    getSessionLock,
    getLastLocationSeqId,
    getTotalCountedUnits,
    getUncountedItems,
    getUndirectedItems,
    getUnmatchedItems,
    lockSession,
    mapSessionAndLocation,
    recordScan,
    recordScanAndAggregate,
    releaseSession,
    searchInventoryItemsByIdentifier,
    storeInventoryCountItems,
    submitSession,
    updateSession,
    updateSessionItem,
    deleteSessionItem,
    approveInventoryCountSessionItem,
    rejectInventoryCountSessionItem,
    getLastSessionProductId
  };
}
