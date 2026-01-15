<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-back-button slot="start" default-href="/tabs/count" />
        <ion-title>{{ translate("Count details") }}</ion-title>
      </ion-toolbar>
      <ion-segment v-model="activeSegment">
        <ion-segment-button value="ready">
          {{ translate("READY TO COUNT") }}
        </ion-segment-button>
        <ion-segment-button value="blocked">
          {{ translate("BLOCKED") }}
        </ion-segment-button>
      </ion-segment>
    </ion-header>

    <ion-content>
      <div v-show="activeSegment === 'ready'">
        <ion-item v-if="!isAllCounted" lines="none">
          <ion-label>
            {{ translate("tasks left to complete count", { count: pendingCount, total: totalCount }) }}
            <p>{{ translate("tasks blocked by reservations", { count: 0 }) }}</p>
          </ion-label>
        </ion-item>

        <div v-else class="ion-padding">
          <ion-button @click="submitCycleCount" color="success" expand="block">
            <ion-icon slot="start" :icon="checkmarkDoneOutline" />
            {{ translate("Submit for review") }}
          </ion-button>
        </div>

        <ion-list>
          <template v-for="(itemsByLocation, locationSeqId) in groupedReadyToCountItems" :key="locationSeqId">
            <ion-item-divider sticky>
              <ion-label>{{ locationSeqId }}</ion-label>
            </ion-item-divider>

            <ion-item v-for="item in itemsByLocation" :key="item.importItemSeqId" @click="viewItem(item)" :button="!item.quantity" :detail="!item.quantity" :disabled="!!item.quantity">
              <ion-label>
                {{ item.product?.productName || item.productId }}
                <p v-if="item.countedByUserLogin">{{ translate("counted by") }} {{ item.countedByUserLogin }}</p>
              </ion-label>
            </ion-item>
          </template>
        </ion-list>
      </div>

      <div v-show="activeSegment === 'blocked'" class="ion-padding ion-text-center">
        <!-- Blocked segment is currently empty as per requirements -->
         <ion-list>
          <template v-for="(itemsByLocation, locationSeqId) in groupedBlockedItems" :key="locationSeqId">
            <ion-item-divider sticky>
              <ion-label>{{ locationSeqId }}</ion-label>
            </ion-item-divider>

            <ion-item v-for="item in itemsByLocation" :key="item.importItemSeqId">
              <ion-label>
                {{ item.product?.productName || item.productId }}
                <p v-if="item.countedByUserLogin">{{ translate("counted by") }} {{ item.countedByUserLogin }}</p>
              </ion-label>
            </ion-item>
          </template>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  onIonViewDidEnter
} from '@ionic/vue';
import { checkmarkDoneOutline } from 'ionicons/icons';
import { ref, computed, defineProps } from 'vue';
import { translate } from '@/i18n';
import { useInventoryCountRun } from '@/composables/useInventoryCountRun';
import { useInventoryCountImport } from '@/composables/useInventoryCountImport';
import { useProductMaster } from '@/composables/useProductMaster';
import { loader, showToast } from '@/services/uiUtils';
import { hasError } from '@/stores/authStore';
import router from '@/router';

const props = defineProps<{
  workEffortId: string;
}>();

const activeSegment = ref('ready');
const items = ref<any[]>([]);
const workEffort = ref<any>(null);
const totalCount = ref(0);
const pageSize = 500;

const pendingCount = computed(() => {
  return items.value.filter(item => item.quantity === null || item.quantity === undefined).length;
});

const isAllCounted = computed(() => {
  return totalCount.value > 0 && pendingCount.value === 0;
});

const blockedItemsList = ref<any[]>([]);
const readyToCountItemsList = ref<any[]>([]);

const groupedReadyToCountItems = computed(() => {
  return readyToCountItemsList.value.reduce((acc: any, item: any) => {
    const location = item.locationSeqId || translate("Unknown location");
    if (!acc[location]) acc[location] = [];
    acc[location].push(item);
    return acc;
  }, {});
});

const groupedBlockedItems = computed(() => {
  return blockedItemsList.value.reduce((acc: any, item: any) => {
    const location = item.locationSeqId || translate("Unknown location");
    if (!acc[location]) acc[location] = [];
    acc[location].push(item);
    return acc;
  }, {});
});

onIonViewDidEnter(async () => {
  await fetchInitialData();
});

async function fetchInitialData() {
  await loader.present(translate("Loading"));
  items.value = [];
  await Promise.all([
    getWorkEffortDetails(),
    fetchItems()
  ]);
  loader.dismiss();
}

async function getWorkEffortDetails() {
  try {
    const resp = await useInventoryCountRun().getWorkEffort({ workEffortId: props.workEffortId });
    if (resp && !hasError(resp)) {
      workEffort.value = resp.data;
    }
  } catch (error) {
    console.error("Error fetching work effort details", error);
  }
}

async function fetchItems() {
  try {
    const resp = await useInventoryCountRun().getCycleCountItems({
      workEffortId: props.workEffortId
    });

    if (!resp || hasError(resp)) {
      throw new Error("Invalid response");
    }

    const blockedItems = (resp.data.blockedItems || []).map((item: any) => ({
      ...item,
      isBlocked: 'Y'
    }));
    const readyItems = resp.data.readyToCountItems || [];

    totalCount.value = resp.data.itemsCount || (
      blockedItems.length + readyItems.length
    );

    // Combine for common processing
    const allFetchedItems = [...blockedItems, ...readyItems];

    // Prefetch products
    const productIds = [
      ...new Set(allFetchedItems.map((i: any) => i.productId).filter(Boolean))
    ];

    if (productIds.length) {
      await useProductMaster().prefetch(productIds as any);
      for (const item of allFetchedItems) {
        const { product } = await useProductMaster().getById(item.productId);
        item.product = product;
      }
    }

    blockedItemsList.value = blockedItems;
    readyToCountItemsList.value = readyItems;
    await useInventoryCountImport().storeInventoryCountItems(allFetchedItems);

  } catch (error) {
    console.error("Error fetching items", error);
    showToast(translate("Failed to fetch items"));
  }
}

function viewItem(item: any) {
  useInventoryCountImport().mapSessionAndLocation(item.inventoryCountImportId, item.productId, item.locationSeqId);
  router.push(`/session-count-detail/${props.workEffortId}/${workEffort.value?.workEffortPurposeTypeId}/${item.inventoryCountImportId || 'new'}`);
}

async function submitCycleCount() {
  await loader.present(translate("Submitting"));
  try {
    const resp = await useInventoryCountRun().updateWorkEffort({
      workEffortId: props.workEffortId,
      currentStatusId: 'CYCLE_CNT_CMPLTD'
    });

    if (resp && !hasError(resp)) {
      showToast(translate("Count submitted successfully"));
      router.replace('/tabs/count');
    }
  } catch (error) {
    console.error("Error submitting cycle count", error);
    showToast(translate("Failed to submit count"));
  } finally {
    loader.dismiss();
  }
}
</script>

<style scoped>
ion-item-divider {
  --background: var(--ion-color-light);
  --color: var(--ion-color-medium);
}
</style>