<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/count-detail/' + workEffortId" />
        </ion-buttons>
        <ion-title>{{ translate("Count item") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <main>
        <form @submit.prevent="handleSaveCount">
          <!-- Location Card -->
          <ion-card :disabled="allProductsCounted">
            <ion-list lines="none">
              <ion-item-divider>
                <ion-label>{{ translate("Location") }}</ion-label>
                <ion-label slot="end" class="expected-value" :color="(isLocationValid && scannedLocation) ? 'success' : ''">{{ currentLocationSeqId || translate("Scan Location") }}</ion-label>
              </ion-item-divider>
              <ion-item>
                <ion-input
                  ref="locationInput"
                  v-model="scannedLocation"
                  :label="translate('Location')"
                  label-placement="floating"
                  :placeholder="translate('Scan Location QR')"
                  :error-text="translate('Incorrect location scanned')"
                  :class="{ 'ion-invalid': !isLocationValid, 'ion-touched': isLocationTouched }"
                  @ion-blur="isLocationTouched = true"
                  @keyup.enter="focusNext('product')"
                ></ion-input>
              </ion-item>
            </ion-list>
          </ion-card>

          <!-- Product/LPN Card -->
          <ion-card :disabled="allProductsCounted">
            <ion-list lines="none">
              <ion-item-divider>
                <ion-label>{{ isProductContainerTracked ? translate("LPN") : translate("Product") }}</ion-label>
                <ion-label slot="end" class="expected-value" :color="(isProductValid && scannedIdentifier) ? 'success' : ''">{{ expectedProductIdentifier }}</ion-label>
              </ion-item-divider>
              <ion-item>
                <ion-input
                  ref="productInput"
                  v-model="scannedIdentifier"
                  :label="isProductContainerTracked ? translate('LPN') : translate('Product')"
                  label-placement="floating"
                  :placeholder="isProductContainerTracked ? translate('Scan LPN') : translate('Scan barcode')"
                  :error-text="translate('Incorrect item scanned')"
                  :class="{ 'ion-invalid': !isProductValid, 'ion-touched': isProductTouched }"
                  @ion-blur="isProductTouched = true"
                  @keyup.enter="focusNext('quantity')"
                ></ion-input>
              </ion-item>
            </ion-list>
          </ion-card>

          <!-- Quantity Card -->
          <ion-card :disabled="allProductsCounted">
            <ion-list lines="none">
              <ion-item-divider>
                <ion-label>{{ translate("Quantity") }}</ion-label>
                <ion-label slot="end" class="expected-value">{{ expectedQoh }} {{ translate("QoH") }}</ion-label>
              </ion-item-divider>
              <ion-item>
                <ion-input
                  ref="quantityInput"
                  v-model.number="scannedQuantity"
                  type="number"
                  inputmode="numeric"
                  :label="translate('Quantity')"
                  label-placement="floating"
                  :placeholder="translate('Input physical quantity')"
                  @keyup.enter="handleSaveCount"
                ></ion-input>
              </ion-item>
            </ion-list>
          </ion-card>

          <ion-button expand="block" class="ion-margin-top" type="submit" :disabled="!isFormValid || allProductsCounted">
            {{ translate("SAVE COUNT") }}
          </ion-button>
        </form>

        <!-- Recent Scans (Minimal) -->
        <ion-list v-if="events.length > 0" class="ion-margin-top">
          <ion-list-header>
            <ion-label>{{ translate("Recent Scans") }}</ion-label>
          </ion-list-header>
          <ion-item v-for="event in events.slice(0, 5)" :key="event.createdAt">
            <ion-label>
              <h2>{{ event.product?.internalName || event.scannedValue }}</h2>
              <p>{{ event.locationSeqId }}</p>
            </ion-label>
            <ion-badge slot="end" color="medium">{{ event.quantity }}</ion-badge>
          </ion-item>
        </ion-list>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/* global defineProps */
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonContent, IonHeader,
  IonInput, IonItem, IonItemDivider, IonLabel, IonList, IonListHeader, IonPage,
  IonTitle, IonToolbar, onIonViewDidEnter, onIonViewDidLeave
} from '@ionic/vue';
import { computed, ref, toRaw, watch, nextTick } from 'vue';
import { translate } from '@/i18n';
import { useInventoryCountImport } from '@/composables/useInventoryCountImport';
import { useInventoryCountRun } from '@/composables/useInventoryCountRun';
import { useProductMaster } from '@/composables/useProductMaster';
import { useProductStore } from '@/stores/productStore';
import { useAuthStore, hasError } from '@/stores/authStore';
import { useUserProfile } from '@/stores/userProfileStore';
import { loader, showToast } from '@/services/uiUtils';
import { from, Subscription } from 'rxjs';
import router from '@/router';

const props = defineProps<{
  workEffortId: string;
  inventoryCountTypeId: string;
  inventoryCountImportId: string;
}>();

// Form Data
const scannedLocation = ref('');
const scannedIdentifier = ref('');
const scannedQuantity = ref<number | undefined>(undefined);

// Refs for Focus Management
const locationInput = ref<any>(null);
const productInput = ref<any>(null);
const quantityInput = ref<any>(null);

// Session & State
const currentProductId = ref('');
const currentLocationSeqId = ref('');
const events = ref<any[]>([]);
const uncountedItems = ref<any[]>([]);
const subscriptions: Subscription[] = [];
let aggregationWorker: Worker | null = null;
const allProductsCounted = computed(() => uncountedItems.value.length === 0);

// Computed Properties for "Expected" values
const currentTargetItem = ref<any>(null);

const expectedProductIdentifier = computed(() => {
  if (!currentTargetItem.value) return translate("N/A");
  const name = currentTargetItem.value.product?.internalName || currentTargetItem.value.productId;
  const id = scannableIdentifier.value;
  return id ? `${name} (${id})` : name;
});

const scannableIdentifier = computed(() => {
  if (!currentTargetItem.value) return '';
  const idValue = isProductContainerTracked.value ? currentTargetItem.value.containerIdentifier : currentTargetItem.value.productIdentifier || currentTargetItem.value.product?.internalName;
  if (idValue) return idValue;
  
  // Fallback to internal ID if identifier is missing
  return isProductContainerTracked.value ? currentTargetItem.value.containerId : currentTargetItem.value.productId;
});

const isLpnControlled = ref(false);

const expectedQoh = computed(() => {
  if (!currentTargetItem.value) return 0;
  return currentTargetItem.value.inventory?.quantityOnHandTotal || 0;
});

// Validation States
const isLocationTouched = ref(false);
const isProductTouched = ref(false);

const isLocationValid = computed(() => {
  if (!scannedLocation.value) return true;
  return scannedLocation.value?.trim() === currentLocationSeqId.value?.trim();
});

const isProductValid = computed(() => {
  if (!scannedIdentifier.value) return true;
  const input = scannedIdentifier.value?.trim();
  
  // Check against the scannable identifier (which now has fallback)
  if (input === scannableIdentifier.value?.trim()) return true;

  // Extra safety: check against names or other identifiers if needed, 
  // but SKU/ID fallback in scannableIdentifier should cover most cases.
  return false;
});

const isQuantityValid = computed(() => scannedQuantity.value !== undefined && scannedQuantity.value > 0);

const isFormValid = computed(() => {
  const loc = scannedLocation.value?.trim();
  const expectedLoc = currentLocationSeqId.value?.trim();
  const prod = scannedIdentifier.value?.trim();
  const expectedProd = scannableIdentifier.value?.trim();

  return loc === expectedLoc && prod === expectedProd && isQuantityValid.value;
});

const isProductContainerTracked = computed(() => {
  return isLpnControlled.value && currentTargetItem.value?.containerId;
});

onIonViewDidEnter(async () => {
  await loader.present(translate("Loading Session..."));
  try {
    // Get Current Location
    const locSeqId = await useInventoryCountImport().getLastLocationSeqId(props.inventoryCountImportId);
    currentLocationSeqId.value = locSeqId;

    currentProductId.value = await useInventoryCountImport().getLastSessionProductId(props.inventoryCountImportId, currentLocationSeqId.value);
    subscriptions.push(
      from(useInventoryCountImport().getCurrentLocationSeqId(props.inventoryCountImportId)).subscribe((locSeqId: any) => {
        currentLocationSeqId.value = locSeqId;
      })
    );

    await startSession();

    // Scan Events Subscription
    subscriptions.push(
      from(useInventoryCountImport().getScanEvents(props.inventoryCountImportId, currentLocationSeqId.value)).subscribe((scans: any) => {
        events.value = scans;
      })
    );

    // Uncounted Items Subscription (to drive "Next Item")
    subscriptions.push(
      from(useInventoryCountImport().getUncountedItems(props.inventoryCountImportId, currentLocationSeqId.value)).subscribe((items: any) => {
        uncountedItems.value = items;
      })
    );

    setupAggregationWorker();

    // Set Initial Focus
    await focusNext('location');
  } catch (err) {
    console.error(err);
    showToast(translate("Failed to load session"));
  }
  loader.dismiss();
});

onIonViewDidLeave(async () => {
  subscriptions.forEach(sub => sub.unsubscribe());
  subscriptions.length = 0;

  if (aggregationWorker) {
    await finalizeAggregationAndSync();
    aggregationWorker.terminate();
    aggregationWorker = null;
  }
});

// Focus Management Logic
async function focusNext(field: 'location' | 'product' | 'quantity') {
  await nextTick();
  let target = null;
  if (field === 'location') target = locationInput.value;
  else if (field === 'product') target = productInput.value;
  else if (field === 'quantity') target = quantityInput.value;

  if (target) {
    const el = target.$el || target;
    if (el.setFocus) await el.setFocus();
    else if (el.focus) el.focus();
  }
}

async function handleSaveCount() {
  if (!scannedIdentifier.value?.trim()) {
    showToast(translate("Please scan a product or LPN"));
    await focusNext('product');
    return;
  }
  if (scannedQuantity.value === undefined || scannedQuantity.value <= 0) {
    showToast(translate("Please enter a valid quantity"));
    await focusNext('quantity');
    return;
  }

  const params: any = {
    inventoryCountImportId: props.inventoryCountImportId,
    productId: currentTargetItem.value?.productId,
    lotId: currentTargetItem.value?.lotId,
    quantity: scannedQuantity.value,
    locationSeqId: scannedLocation.value || currentLocationSeqId.value
  };

  if (isProductContainerTracked.value) {
    params.scannedLotId = scannedIdentifier.value?.trim();
  } else {
    params.productIdentifier = scannedIdentifier.value?.trim();
  }

  try {
    await useInventoryCountImport().recordScanAndAggregate(params);
    showToast(translate("Count saved"));
    
    // Reset inputs for next item
    scannedIdentifier.value = '';
    scannedQuantity.value = undefined;
    isProductTouched.value = false;

    const nextItem = uncountedItems.value.find((item: any) => item.productId !== currentProductId.value);

    if (!nextItem) {
      showToast(translate("All items counted for this location"));
      return;
    }
      currentProductId.value = nextItem.productId;
      await setupCurrentTargetItem();
    
    // Auto-focus back to product for the next scan
    await focusNext('product');
  } catch (err) {
    console.error(err);
    showToast(translate("Failed to record scan"));
  }
}

async function startSession() {
  // Load items if needed
  const sessionItemsCount = await useInventoryCountImport().getInventoryCountImportItemsCount(props.inventoryCountImportId, currentLocationSeqId.value);
  if (!sessionItemsCount) {
    const itemsResp = await useInventoryCountImport().getSessionItemsByImportId(props.inventoryCountImportId, { locationSeqId: currentLocationSeqId.value });
    if (itemsResp?.data?.items) {
      await useInventoryCountImport().storeInventoryCountItems(itemsResp.data.items);
    }
  }

  // Prefetch products
  const productIds = await useInventoryCountImport().getSessionProductIds(props.inventoryCountImportId, currentLocationSeqId.value);
  if (productIds.length) {
    await useProductMaster().prefetch(productIds);
  }

  currentTargetItem.value = await useInventoryCountImport().getInventoryCountImportByProductIdAndLocation(
    props.inventoryCountImportId,
    currentProductId.value,
    currentLocationSeqId.value
  );
  currentTargetItem.value.product = (await useProductMaster().getById(currentTargetItem.value.productId)).product;

  const facilityLocationResp = await useProductStore().getFacilityLocation(useProductStore().getCurrentFacility.facilityId, currentLocationSeqId.value);

  if (facilityLocationResp) {
    isLpnControlled.value = facilityLocationResp.lpnControlled === 'Y';
    if (isLpnControlled.value) {
      const containerId = await useProductStore().getContainerIdForProductFacilityLocation(currentProductId.value, useProductStore().getCurrentFacility.facilityId, currentLocationSeqId.value);
      if (containerId) {
        currentTargetItem.value.containerId = containerId;
      }
    }
  }
}

async function setupCurrentTargetItem() {
  currentTargetItem.value = await useInventoryCountImport().getInventoryCountImportByProductIdAndLocation(
    props.inventoryCountImportId,
    currentProductId.value,
    currentLocationSeqId.value
  );
  if (currentTargetItem.value) {
    currentTargetItem.value.product = (await useProductMaster().getById(currentTargetItem.value.productId)).product;
  }

  if (isLpnControlled.value) {
    const containerId = await useProductStore().getContainerIdForProductFacilityLocation(currentProductId.value, useProductStore().getCurrentFacility.facilityId, currentLocationSeqId.value);
    if (containerId) {
      currentTargetItem.value.containerId = containerId;
    }
  }
}

function setupAggregationWorker() {
  aggregationWorker = new Worker(new URL('@/workers/backgroundAggregation.ts', import.meta.url), { type: 'module' });
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
        token: useAuthStore().token.value,
        barcodeIdentification,
        inventoryCountTypeId: props.inventoryCountTypeId,
        facilityId: useProductStore().getCurrentFacility.facilityId
      }
    }
  });
}

async function finalizeAggregationAndSync() {
  if (!aggregationWorker) return;
  const barcodeIdentification = useProductStore().getBarcodeIdentificationPref;
  aggregationWorker.postMessage({
    type: 'aggregate',
    payload: {
      workEffortId: props.workEffortId,
      inventoryCountImportId: props.inventoryCountImportId,
      context: {
        omsUrl: useAuthStore().getBaseUrl,
        omsInstance: useAuthStore().getOMS,
        userLoginId: useUserProfile().getUserProfile?.userLoginId,
        token: useAuthStore().token.value,
        barcodeIdentification,
        inventoryCountTypeId: props.inventoryCountTypeId,
        facilityId: useProductStore().getCurrentFacility.facilityId
      }
    }
  });
}
</script>

<style scoped>
main {
  max-width: 500px;
  margin: 0 auto;
}

ion-item-divider {
  --background: var(--ion-color-light);
  border-bottom: 1px solid var(--ion-color-light);
}

ion-card {
  margin-bottom: 20px;
}

</style>
