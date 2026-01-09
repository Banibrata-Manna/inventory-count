<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-back-button slot="start" :default-href="'/count-detail/' + workEffortId" />
        <ion-title>{{ translate("Session") }}</ion-title>
      </ion-toolbar>
      <ion-segment v-model="activeSegment">
        <ion-segment-button value="scan">
          <ion-label>{{ translate("SCAN") }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="review">
          <ion-label>{{ translate("REVIEW & SUBMIT") }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-header>

    <ion-content>
      <ion-segment-view>
        <ion-segment-content v-show="activeSegment === 'scan'" id="scan">
          <ion-item>
            <ion-label><h1>{{ currentLocationSeqId }}</h1></ion-label>
          </ion-item>
          <ion-item>
            <ion-input label="Lot Id" v-model="scannedLot" placeholder="scan lot"></ion-input>
          </ion-item>
          <ion-item>
            <div class="select-left">
              <ion-checkbox slot="start"></ion-checkbox>
              <span>
                {{ translate("No lot, scan primary product identifier", { primaryIdentifier: barcodeIdentifierDescription }) }}
              </span>
            </div>
          </ion-item>
          <ion-item>
            <ion-input :label="barcodeIdentifierDescription" v-model="scannedProdIndentifier" placeholder="scan product"></ion-input>
          </ion-item>
          <ion-item size="small" class="scan-input">
            <ion-input label="Quantity" type="number" min="1" placeholder="Enter quantity" v-model.number="scannedQuantity"></ion-input>
          </ion-item>

          <ion-button expand="block" class="scan-button ion-margin" @click="saveEvent">
            <ion-icon slot="start" :icon="barcodeOutline" />
            {{ translate("Save") }}
          </ion-button>

          <DynamicScroller :items="events" key-field="createdAt" class="virtual-list" :min-item-size="72" :buffer="60">
            <template #default="{ item, index, active }">
              <DynamicScrollerItem :item="item" :index="index" :active="active">
                <ion-item>
                  <div slot="start" class="img-preview">
                    <ion-thumbnail @click="openImagePreview(item.product?.mainImageUrl)">
                      <Image :src="item.product?.mainImageUrl || defaultImage" :key="item.product?.mainImageUrl"/>
                    </ion-thumbnail>
                      <ion-badge class="qty-badge" color="medium">
                        {{ item.quantity }}
                      </ion-badge>
                  </div>
                  <ion-label v-if="item.lotId">
                    <p v-if="item.productId">{{ useProductMaster().primaryId(item.product) }}</p>
                    <p v-else>{{ translate("Not Found") }}</p>
                    <h2>{{ item.lotId }}</h2>
                    <p>{{ translate("Lot") }}</p>
                  </ion-label>
                  <ion-label v-else>
                    {{ item.scannedValue }}
                    <p class="clickable-time">{{ timeAgo(item.createdAt) }}</p>
                  </ion-label>
                  <ion-badge slot="end" v-if="item.aggApplied === 0" color="primary">
                    {{ translate('unaggregated') }}
                  </ion-badge>
                </ion-item>
              </DynamicScrollerItem>
            </template>
          </DynamicScroller>
        </ion-segment-content>

        <ion-segment-content v-show="activeSegment === 'review'" id="review">
          <ion-item lines="none">
            <ion-label><h1>{{ currentLocationSeqId }}</h1></ion-label>
          </ion-item>

          <ion-card>
            <ion-card-header>
              <p class="overline">{{ translate("UNITS COUNTED") }}</p>
              <ion-card-title>{{ stats.totalUnits }}</ion-card-title>
            </ion-card-header>
            <ion-item>
              <ion-label>{{ translate("Unprocessed counts") }}</ion-label>
              <p slot="end">{{events.filter((event: any) => event.aggApplied === 0).length}}</p>
            </ion-item>
          </ion-card>
          <ion-item lines="none">
            <p class="overline">{{ translate("Uncounted Products") }}</p>
            <ion-note slot="end">{{ uncountedItems.length }}</ion-note>
          </ion-item>
          <DynamicScroller :items="uncountedItems" key-field="uuid" :buffer="60" class="virtual-list" :min-item-size="64" :emit-update="true">
            <template v-slot="{ item, index, active }">
              <DynamicScrollerItem :item="item" :index="index" :active="active">
                <ion-item>
                  <ion-thumbnail slot="start">
                    <Image :src="item.product?.mainImageUrl || defaultImage" :key="item.product?.mainImageUrl"/>
                  </ion-thumbnail>
                  <ion-label>
                    {{ useProductMaster().primaryId(item.product) }}
                    <p>{{ useProductMaster().secondaryId(item.product) }}</p>
                  </ion-label>
                  <ion-button fill="outline">{{ translate("Add Count") }}</ion-button>
                </ion-item>
              </DynamicScrollerItem>
            </template>
          </DynamicScroller>
          <!-- <ion-list>
            <ion-list-header>
              <ion-label>
                <p class="ion-text-capitalize">{{ translate("3 unmatched items") }}</p>
              </ion-label>
            </ion-list-header>

            <ion-card v-for="n in 1" :key="n">
              <ion-card-header>
                <div class="unmatched-item-header">
                  <ion-label>
                    10022001922
                    <p>10 scans ago</p>
                    <p>3 minutes ago</p>
                  </ion-label>
                  <ion-button fill="outline">
                    <ion-icon slot="start" :icon="searchOutline" />
                    {{ translate("MATCH") }}
                  </ion-button>
                </div>
              </ion-card-header>
              <ion-card-content>
                <ion-list class="timeline">
                  <ion-item lines="none">
                    <ion-thumbnail slot="start">
                      <ion-icon :icon="imageOutline" size="large" />
                    </ion-thumbnail>
                    <ion-label>
                      <p class="overline">3 ITEMS AGO</p>
                      primaryid
                      <p>Secondaryid</p>
                      <p>scanned value</p>
                    </ion-label>
                    <div slot="end" class="ion-text-end">
                      <p class="overline">last match</p>
                      <ion-icon :icon="chevronUpCircleOutline" color="medium" />
                    </div>
                  </ion-item>
                  <ion-item lines="none">
                    <ion-thumbnail slot="start">
                      <ion-icon :icon="imageOutline" size="large" />
                    </ion-thumbnail>
                    <ion-label>
                      <p class="overline">2 ITEMS LATER</p>
                      primaryid
                    </ion-label>
                    <div slot="end" class="ion-text-end">
                      <p class="overline">next match</p>
                      <ion-icon :icon="chevronDownCircleOutline" color="medium" />
                    </div>
                  </ion-item>
                </ion-list>
              </ion-card-content>
            </ion-card>
          </ion-list> -->
        </ion-segment-content>
      </ion-segment-view>
    </ion-content>
    <ion-footer v-if="activeSegment === 'scan'">
      <ion-toolbar>
        <ion-button expand="block" fill="outline" class="ion-margin">
          {{ translate("SCAN NEXT LOCATION") }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
    <ion-footer v-else>
      <ion-toolbar>
        <div class="footer-actions ion-margin">
          <ion-button expand="block" fill="outline" color="warning">
            {{ translate("VOID SESSION") }}
          </ion-button>
          <ion-button expand="block" fill="outline" color="success">
            {{ translate("SUBMIT SESSION") }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonAccordion,
  IonAccordionGroup,
  IonBackButton, 
  IonBadge,
  IonButton,
  IonCardTitle,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonCardHeader,
  IonContent,
  IonFooter, 
  IonHeader, 
  IonIcon, 
  IonInput,
  IonItem, 
  IonLabel, 
  IonList, 
  IonListHeader,
  IonNote, 
  IonPage,
  IonSegment, 
  IonSegmentButton, 
  IonSegmentContent,
  IonSegmentView,
  IonThumbnail, 
  IonTitle, 
  IonToolbar,
  onIonViewDidEnter,
  onIonViewDidLeave
} from '@ionic/vue';
import { barcodeOutline, chevronUpCircleOutline, chevronDownCircleOutline, imageOutline, searchOutline } from 'ionicons/icons';
/* global defineProps */
import { computed, ref, toRaw, watchEffect } from 'vue';
import { translate } from '@/i18n';
import { useProductStore } from '@/stores/productStore';
import { hasError, useAuthStore } from '@/stores/authStore';
import { useUserProfile } from '@/stores/userProfileStore';
import { useInventoryCountImport } from '@/composables/useInventoryCountImport';
import { loader, showToast } from '@/services/uiUtils';
import { DateTime } from 'luxon';
import { from, Subscription } from 'rxjs';
import { useProductMaster } from '@/composables/useProductMaster';
import { useInventoryCountRun } from '@/composables/useInventoryCountRun';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import defaultImage from "@/assets/images/defaultImage.png";
import Image from '@/components/Image.vue';
import { wrap, type Remote } from 'comlink'
import { LockHeartbeatWorker } from '@/workers/lockHeartbeatWorker';
import router from '@/router';

const props = defineProps<{
  workEffortId: string;
  inventoryCountTypeId: string;
  inventoryCountImportId: string;
}>();

const currentLocationSeqId = ref('');

const activeSegment = ref('scan');
const scannedProdIndentifier = ref('');
const scannedLot = ref('');
const scannedQuantity = ref(0);
let aggregationWorker: Worker | null = null;

const events = ref<any[]>([]);
const subscriptions: Subscription[] = [];
const inventoryCountImport = ref<any>(null);
const totalItems = ref(0);
const uncountedItems = ref<any[]>([]);
const isLoadingItems = ref(true);
const loadedItems = ref(0);

const workEffort = ref<any>(null);

const isImageModalOpen = ref(false)
const largeImage = ref("")

const currentLock = ref<any>(null);
const sessionLocked = ref(false);

const totalUnitsCount = ref(0);
const unmatchedItems = ref<any[]>([]);
const stats = ref({ totalUnits: 0, unmatched: 0 });

let lockWorker: Remote<LockHeartbeatWorker> | null = null;
let lockLeaseSeconds = 300;
let lockGracePeriod = 300;
const isNewLockAcquired = ref(false);
const getGoodIdentificationOptions = computed(() => useProductStore().getGoodIdentificationOptions);
const barcodeIdentifierPref = computed(() => useProductStore().getBarcodeIdentificationPref);
const barcodeIdentifierDescription = computed(() => getGoodIdentificationOptions.value?.find((opt: any) => opt.goodIdentificationTypeId === barcodeIdentifierPref.value)?.description);

watchEffect(() => {
  stats.value = {
    totalUnits: totalUnitsCount.value,
    unmatched: unmatchedItems.value.length
  }
})

onIonViewDidEnter(async () => {
  await loader.present("Loading Session...");

  try {
    await getWorkEffortDetails();
    subscriptions.push(
      from(useInventoryCountImport().getCurrentLocationSeqId(props.inventoryCountImportId)).subscribe((locSeqId: any) => {
        currentLocationSeqId.value = locSeqId;
      })
    );
    await startSession();
    if (!['SESSION_SUBMITTED', 'SESSION_VOIDED'].includes(inventoryCountImport.value?.statusId)) {
      await handleSessionLock();
    }
    subscriptions.push(
      from(useInventoryCountImport().getScanEvents(props.inventoryCountImportId, currentLocationSeqId.value)).subscribe((scans: any) => { events.value = scans; })
    );
    subscriptions.push(
      from(useInventoryCountImport().getTotalCountedUnits(props.inventoryCountImportId, currentLocationSeqId.value)).subscribe((total: any) => {
        totalUnitsCount.value = total;
      })
    );
    subscriptions.push(
      from(useInventoryCountImport().getUncountedItems(props.inventoryCountImportId, currentLocationSeqId.value)).subscribe((items: any) => (uncountedItems.value = items))
    )
    subscriptions.push(
      from(useInventoryCountImport().getUnmatchedItems(props.inventoryCountImportId, currentLocationSeqId.value)).subscribe((items: any) => (unmatchedItems.value = items))
    );

    aggregationWorker = new Worker(
        new URL('@/workers/backgroundAggregation.ts', import.meta.url), { type: 'module' }
      )

      aggregationWorker.onmessage = (event) => {
        const { type, count } = event.data
        if (type === 'aggregationComplete') {
          console.info(`Aggregated ${count} products from scans`)
        }
      }
      aggregationWorker.onerror = (err) => {
        console.error('[Worker Error]', err.message || err);
      };
      aggregationWorker.onmessageerror = (err) => {
        console.error('[Worker Message Error]', err);
      };
      // Run every 10 seconds
      // const productIdentifications = process.env.VUE_APP_PRDT_IDENT ? JSON.parse(JSON.stringify(process.env.VUE_APP_PRDT_IDENT)) : []
      const barcodeIdentification = useProductStore().getBarcodeIdentificationPref;

      aggregationWorker.postMessage({
        type: 'schedule',
        payload: {
          workEffortId: props.workEffortId,
          inventoryCountImportId: props.inventoryCountImportId,
          intervalMs: 8000,
          context: {
            omsUrl: useAuthStore().getBaseUrl,
            omsInstance: useAuthStore().getOMS,
            userLoginId: useUserProfile().getUserProfile?.userLoginId,
            maargUrl: useAuthStore().getBaseUrl,
            token: useAuthStore().token.value,
            barcodeIdentification: barcodeIdentification,
            inventoryCountTypeId: props.inventoryCountTypeId,
            facilityId: useProductStore().getCurrentFacility.facilityId
          }
        }
      })
  } catch (err) {
    console.error(err);
    showToast("Failed to load session");
  }
  loader.dismiss();
});

onIonViewDidLeave(() => {
  console.log("This is running");
  subscriptions.forEach(subscription => subscription.unsubscribe());
  subscriptions.length = 0;
});

async function handleSessionLock() {
  try {
    const userId = useUserProfile().getUserProfile?.userLoginId;
    const inventoryCountImportId = props.inventoryCountImportId;
    const currentDeviceId = useUserProfile().getDeviceId;

    // Fetch existing lock
    const existingLockResp = await useInventoryCountImport().getSessionLock({
      inventoryCountImportId,
      deviceId: currentDeviceId,
      userId,
    });
    const existingLock = existingLockResp?.data || null;
    currentLock.value = existingLock;

    // --- If existing lock found ---
    if (existingLock && Object.keys(existingLock).length > 0) {
      if (existingLock.userId !== userId || existingLock.deviceId !== currentDeviceId) {
        // Different user → lock session
        sessionLocked.value = true;
        showToast('This session is locked by another user.');
        console.warn('Session locked by another user:', existingLock);
        return;
      }

      // Same user + same device → continue, schedule worker
      sessionLocked.value = false;
      showToast('Existing lock found. Resuming session.');

      // Schedule heartbeat worker for existing lock
      let worker: Worker | null = null;
      if (!lockWorker) {
        worker = new Worker(
          new URL('@/workers/lockHeartbeatWorker.ts', import.meta.url),
          { type: 'module' }
        );
        lockWorker = wrap<Remote<LockHeartbeatWorker>>(worker);
      }

      const payload = {
        inventoryCountImportId,
        lock: JSON.parse(JSON.stringify(toRaw(currentLock.value))),
        leaseSeconds: lockLeaseSeconds,
        gracePeriod: lockGracePeriod,
        maargUrl: useAuthStore().getBaseUrl,
        token: useAuthStore().token.value,
        userId,
        deviceId: currentDeviceId
      };

      await lockWorker.startHeartbeat(payload);

      // Message listener
      if (worker) {
        worker.onmessage = async (event: any) => {
          const { type, thruDate } = event.data;
          if (type === 'heartbeatSuccess') {
            currentLock.value.thruDate = thruDate;
          } else if (type === 'lockForceReleased') {
            showToast('Session lock was force-released by another user.');
            console.warn('Session lock force-released12:', currentLock.value);
            await releaseSessionLock();
            if (lockWorker) await lockWorker.stopHeartbeat();
            router.push('/tabs/count');
          } else if (type === 'lockExpired') {
            showToast('Session lock expired. Please reacquire the lock.');
            await releaseSessionLock();
            router.push('/tabs/count');
          } else if (type === 'reacquireLock') {
            showToast('Reacquiring lock...');
            await handleSessionLock();
          }
        };
      }

      return;
    }

    // --- If no lock found, acquire a new one ---
    const fromDate = DateTime.now().toMillis();
    const newLockResp = await useInventoryCountImport().lockSession({
      inventoryCountImportId,
      userId,
      deviceId: currentDeviceId,
      fromDate,
      thruDate: fromDate + (lockLeaseSeconds * 1000)
    });

    if (newLockResp?.status === 200) {
      currentLock.value = newLockResp.data;
      showToast('Session lock acquired.');

      let worker: Worker | null = null;
      if (!lockWorker) {
        worker = new Worker(
          new URL('@/workers/lockHeartbeatWorker.ts', import.meta.url),
          { type: 'module' }
        );
        lockWorker = wrap<Remote<LockHeartbeatWorker>>(worker);
      }

      const payload = {
        inventoryCountImportId,
        lock: JSON.parse(JSON.stringify(toRaw(currentLock.value))),
        leaseSeconds: lockLeaseSeconds,
        gracePeriod: lockGracePeriod,
        maargUrl: useAuthStore().getBaseUrl,
        token: useAuthStore().token.value,
        userId,
        deviceId: currentDeviceId
      };

      await lockWorker.startHeartbeat(payload);

      // Listen for messages
      if (worker) {
        worker.onmessage = async (event: any) => {
          const { type, thruDate } = event.data;
          if (type === 'heartbeatSuccess') {
            currentLock.value.thruDate = thruDate;
          } else if (type === 'lockForceReleased') {
            showToast('Session lock was force-released by another user.');
            console.warn('Session lock force-released34:', currentLock.value);
            await releaseSessionLock();
            if (lockWorker) await lockWorker.stopHeartbeat();
            router.push('/tabs/count');
          } else if (type === 'lockExpired') {
            showToast('Session lock expired. Please reacquire the lock.');
            await releaseSessionLock();
            router.push('/tabs/count');
          } else if (type === 'reacquireLock') {
            showToast('Reacquiring lock...');
            await handleSessionLock();
          }
        };
      }
      isNewLockAcquired.value = true;
    } else {
      sessionLocked.value = true;
      showToast('Failed to acquire lock.');
    }
  } catch (err) {
    console.error('Error handling session lock:', err);
    sessionLocked.value = true;
    showToast('Error while acquiring session lock.');
  }
}

async function releaseSessionLock() {
  if (!currentLock.value) return;

  try {
    const payload = {
      inventoryCountImportId: props.inventoryCountImportId,
      userId: useUserProfile().getUserProfile?.username,
      thruDate: DateTime.now().toMillis(),
      fromDate: currentLock.value.fromDate
    };

    const resp = await useInventoryCountImport().releaseSession(payload);
    if (resp?.status === 200) {
      showToast('Session lock released.');
      currentLock.value = null;
    } else {
      showToast('Failed to release session lock.');
    }
  } catch (err) {
    console.error('Error releasing session lock:', err);
    showToast('Error while releasing session lock.');
  }
}

async function getWorkEffortDetails() {
  try {
    const resp = await useInventoryCountRun().getWorkEffort({ workEffortId: props.workEffortId });

    if (resp && !hasError(resp)) {
      workEffort.value = resp.data;
    } else {
      throw resp;
    }
  } catch (error) {
    console.error("Error getting work effort details", error);
    showToast("Falied to fetch work effort details");
  }
}

async function startSession() {
  try {
    const resp = await useInventoryCountImport().getInventoryCountImportSession({ inventoryCountImportId: props.inventoryCountImportId });
    if (resp?.status === 200 && resp.data) {
      inventoryCountImport.value = resp.data;
    } else {
      console.error("Session not Found");
      throw resp;
    }

    await getTotalItemCount();

    // Load InventoryCountImportItem records into IndexedDB
    const sessionItemsCount = await useInventoryCountImport().getInventoryCountImportItemsCount(props.inventoryCountImportId, currentLocationSeqId.value);

    if (!sessionItemsCount || totalItems.value !== sessionItemsCount) {
      console.log("[Session] No local records found, fetching from backend...");
      await loadInventoryItemsWithProgress();
    } else {
      isLoadingItems.value = false
    }

    // Prefetch product details for all related productIds
    const productIds = await useInventoryCountImport().getSessionProductIds(props.inventoryCountImportId, currentLocationSeqId.value);
    if (productIds.length) {
      // fire asynchronously, don’t block UI
      useProductMaster().prefetch(productIds)
        .then(() => console.info(`Prefetch ${productIds.length} products hydrated`))
        .catch(err => console.warn('Prefetch Failed:', err))
    }    showToast('Session ready to start counting');
  } catch (err) {
    console.error(err);
    showToast('Failed to initialize session');
  }

}

async function getTotalItemCount() {
  try {
    const resp = await useInventoryCountImport().getInventoryCountImportItemCount(props.inventoryCountImportId, {
      locationSeqId: currentLocationSeqId.value
    });
    if (resp?.status === 200 && resp.data?.count !== undefined) {
      totalItems.value = resp.data.count
    } else {
      totalItems.value = 0
    }
  } catch (err) {
    console.error('Failed to fetch total item count', err)
    totalItems.value = 0
  }
}

async function loadInventoryItemsWithProgress() {
  loadedItems.value = 0
  isLoadingItems.value = true
  const pageSize = 500
  let pageIndex = 0
  let totalFetched = 0

  try {
    let hasMore = true
    while (hasMore) {
      const resp = await useInventoryCountImport().getSessionItemsByImportId(
        props.inventoryCountImportId,
        {
          pageIndex,
          pageSize,
          locationSeqId: currentLocationSeqId.value
        }
      );

      if (resp?.status !== 200 || !resp.data?.items?.length) break

      const items = resp.data.items
      totalFetched += items.length
      loadedItems.value = totalFetched

      // store in IndexedDB
      await useInventoryCountImport().storeInventoryCountItems(items)

      if (items.length < pageSize) {
        hasMore = false
        break
      }
      pageIndex++
    }
  } catch (err) {
    console.error('Error loading items with progress', err)
    showToast('Failed to load session items')
  } finally {
    isLoadingItems.value = false
  }
}

function saveEvent() {
  if (scannedProdIndentifier.value.trim() && scannedLot.value.trim()) {
    showToast("Either Provide Lot or Product");
  }

  if (scannedQuantity.value <= 0) {
    showToast("Quantity should be greater than zero");
    return;
  }

  const params: any = { inventoryCountImportId: props.inventoryCountImportId, quantity: scannedQuantity.value, locationSeqId: currentLocationSeqId.value };
  let value = '';

  if (scannedLot.value.trim()) {
    params.scannedLotId = scannedLot.value.trim();
  } else {
    params.productIdentifier = scannedProdIndentifier.value.trim();
  }

  try {
    useInventoryCountImport().recordScan(params);
    events.value.unshift({ scannedValue: value, quantity: 1, createdAt: DateTime.now().toMillis() });
  } catch (err) {
    console.error(err);
    showToast('Failed to record scan');
  } finally {
    scannedProdIndentifier.value = '';
    scannedLot.value = '';
    scannedQuantity.value = 0;
  }
}

function timeAgo (time: number) {
  return DateTime.fromMillis(time).toRelative();
}

function openImagePreview(src: string) {
  if (!src) return
  largeImage.value = src
  isImageModalOpen.value = true
}
</script>

<style scoped>
.scan-input {
  --inner-padding-top: var(--spacer-base);
  --inner-padding-bottom: var(--spacer-base);
}

ion-item [slot="end"] ion-button {
  display: block;
}

.unmatched-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.footer-actions {
  display: flex;
  gap: var(--spacer-sm);
}

.footer-actions ion-button {
  flex: 1;
}

.timeline {
  --ion-safe-area-left: 0;
  --ion-safe-area-right: 0;
}

.qty-badge {
  border-radius: 100%;
  top: -5px;
  right: -1px;
  position: absolute;
  font-size: 10px;
}

.img-preview {
  cursor: pointer;
  position: relative;
}

.select-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

</style>
