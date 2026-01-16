<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-back-button slot="start" default-href="/pending-review" />
        <ion-title>{{ translate("Review count") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <template v-if="isLoading">
        <ProgressBar :total-items="totalItems" :loaded-items="loadedItems" />
      </template>
      <template v-else-if="workEffort">
        <div class="header">
          <ion-card>
            <ion-item lines="none">
              <ion-label>
                <p class="overline">{{ workEffort?.workEffortId }}</p>
                <h1>{{ workEffort?.workEffortName }}</h1>
              </ion-label>
            </ion-item>

            <ion-item>
              <ion-icon :icon="businessOutline" slot="start"></ion-icon>
              <ion-label>
                {{ getFacilityName(workEffort?.facilityId) }}
              </ion-label>
            </ion-item>

            <ion-item>
              <ion-icon :icon="calendarClearOutline" slot="start"></ion-icon>
              <ion-label>
                <p class="overline">{{ translate("Start Date") }}</p>
                {{ getDateTimeWithOrdinalSuffix(workEffort.estimatedStartDate) }}
              </ion-label>
            </ion-item>

            <ion-item lines="none" class="due-date">
              <ion-icon :icon="calendarClearOutline" slot="start"></ion-icon>
              <ion-label>
                <p class="overline">{{ translate("Due Date") }}</p>
                {{ workEffort.estimatedCompletionDate ? getDateTimeWithOrdinalSuffix(workEffort.estimatedCompletionDate) : translate("Not set") }}
              </ion-label>
            </ion-item>
          </ion-card>
          <ion-card>
            <ion-item>
              <ion-label>{{ translate("First item counted") }}</ion-label>
              <ion-label slot="end" class="ion-text-end">
                {{ aggregatedSessionItems.length !== 0 ? getDateTimeWithOrdinalSuffix(firstCountedAt) : '-' }}
                <p v-if="aggregatedSessionItems.length !== 0 && workEffort.estimatedStartDate">{{ getTimeDifference(firstCountedAt, workEffort.estimatedStartDate) }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Last item counted") }}</ion-label>
              <ion-label slot="end" class="ion-text-end">
                {{ aggregatedSessionItems.length !== 0 ? getDateTimeWithOrdinalSuffix(lastCountedAt) : '-' }}
                <p v-if="aggregatedSessionItems.length !== 0 && workEffort.estimatedCompletionDate">{{ getTimeDifference(lastCountedAt, workEffort.estimatedCompletionDate) }}</p>
              </ion-label>
            </ion-item>
          </ion-card>

          <div class="statistics">
            <ion-card>
              <ion-item lines="none">
                <ion-label>
                  {{ translate("Review progress", { progressRate: Math.floor((submittedItemsCount / totalItems) * 100)}) }}
                  <p>{{ translate("submitted counts", { submittedItemsCount: submittedItemsCount, totalItems: totalItems }) }}</p>
                </ion-label>
              </ion-item>
              <ion-card-content>
                <ion-progress-bar :value="submittedItemsCount / totalItems"></ion-progress-bar>
              </ion-card-content>
            </ion-card>
            <ion-card>
              <ion-item lines="full">
                <ion-label>
                  <p class="overline">{{ translate("Overall variance (Filtered)") }}</p>
                  <h3>
                    {{
                      translate("filtered variance", {
                        overallFilteredVarianceQtyProposed: overallFilteredVarianceQtyProposed,
                      })
                    }}
                  </h3>
                  <p>
                    {{
                      translate("filtered variance based", {
                        filteredSessionItemsCount: filteredSessionItems.length,
                      })
                    }}
                  </p>
                </ion-label>
              </ion-item>
            </ion-card>
          </div>
        </div>

        <SmartFilterSortBar
          :items="aggregatedSessionItems"
          :selected-items="selectedProductsReview"
          :show-search="true"
          :show-status="true"
          :show-compliance="true"
          :show-sort="true"
          :show-select="false"
          :status-options="[
            { label: translate('Open'), value: 'open' },
            { label: translate('Accepted'), value: 'accepted' },
            { label: translate('Rejected'), value: 'rejected' }
          ]"
          :sort-options="[
            { label: translate('Alphabetic'), value: 'alphabetic' },
            { label: translate('Variance (Low → High)'), value: 'variance-asc' },
            { label: translate('Variance (High → Low)'), value: 'variance-desc' }
          ]"
          :threshold-config="userProfile.getDetailPageFilters.threshold"
          @update:filtered="filteredSessionItems = $event"
          @select-all="toggleSelectAll"
        />

        <div class="results ion-margin-top" v-if="filteredSessionItems?.length">
          <ion-accordion-group>
          <DynamicScroller :items="filteredSessionItems" key-field="importItemSeqId" :buffer="200" class="virtual-list" :min-item-size="120">
            <template #default="{ item, index, active }">
              <DynamicScrollerItem :item="item" :index="index" :active="active">
                  <ion-accordion :key="item.importItemSeqId">
                    <!-- HEADER -->
                    <div class="list-item count-item-rollup" slot="header">
                      <div class="item-key">
                        <ion-item lines="none">
                          <ion-thumbnail slot="start">
                            <Image :src="item.product?.mainImageUrl || item.detailImageUrl" />
                          </ion-thumbnail>
                          <ion-label>
                            {{ item.product?.internalName || item.internalName }}
                            <p>{{ translate("Location") }}: {{ item.locationSeqId || '-' }}</p>
                          </ion-label>
                        </ion-item>
                      </div>

                      <ion-label class="stat">
                        {{ item.quantity ?? '-' }}/{{ item.systemQuantity ?? item.systemQuantityOnHand ?? item.quantityOnHand ?? '-' }}
                        <p>{{ translate("counted/systemic") }}</p>
                      </ion-label>

                      <ion-label class="stat">
                        {{ item.proposedVarianceQuantity ?? item.proposedVariance ?? '-' }}
                        <p>{{ translate("variance") }}</p>
                      </ion-label>

                      <!-- ACTION BUTTONS -->
                      <div v-if="!item.decisionOutcomeEnumId" class="actions">
                        <ion-button
                          fill="outline"
                          color="success"
                          size="small"
                          @click.stop="stopAccordianEventProp"
                          @click="
                            submitSingleItemReview(item, 'APPLIED')
                          "
                        >
                          {{ translate("Accept") }}
                        </ion-button>

                        <ion-button
                          fill="outline"
                          color="danger"
                          size="small"
                          @click.stop="stopAccordianEventProp"
                          @click="
                            submitSingleItemReview(item, 'SKIPPED')
                          "
                        >
                          {{ translate("Reject") }}
                        </ion-button>
                      </div>

                      <ion-badge
                        v-else
                        :color="item.decisionOutcomeEnumId === 'APPLIED' ? 'success' : 'danger'"
                        style="--color: white;"
                      >
                        {{ item.decisionOutcomeEnumId == "APPLIED" ? translate("Accepted") : translate("Rejected") }}
                      </ion-badge>
                    </div>

                  </ion-accordion>
                </DynamicScrollerItem>
              </template>
            </DynamicScroller>
          </ion-accordion-group>
        </div>

        <div v-else class="empty-state">
          <p>{{ translate("No Results") }}</p>
        </div>
      </template>

      <template v-else>
        <p class="empty-state">{{ translate("Cycle Count Not Found") }}</p>
      </template>

    </ion-content>

    <!-- FOOTER ACTIONS -->
    <ion-footer>
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button :disabled="isLoading" fill="outline" color="dark" size="small" @click="closeCycleCount">
            {{ translate("Close") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>

    <!-- BULK CLOSE MODAL -->
    <ion-modal :is-open="isBulkCloseModalOpen" @did-dismiss="closeBulkCloseModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ translate("Close count") }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeBulkCloseModal">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <template v-if="openItems.length">
          <ion-list>
            <ion-radio-group v-model="bulkAction">
              <ion-item>
                <ion-radio value="APPLIED">{{ translate("Accept all outstanding variances and close") }}</ion-radio>
              </ion-item>

              <ion-item>
                <ion-radio value="SKIPPED">{{ translate("Reject all outstanding variances and close") }}</ion-radio>
              </ion-item>
            </ion-radio-group>
          </ion-list>

          <ion-button expand="block" color="primary" class="ion-margin"
            :disabled="!bulkAction" @click="performBulkCloseAction">
            {{ translate("Confirm") }}
          </ion-button>
        </template>

        <template v-else>
          <p>{{ translate("All items are already reviewed. Do you want to close the cycle count?") }}</p>

          <ion-button expand="block" color="primary" class="ion-margin-top" @click="forceCloseWithoutAction">
            {{ translate("Close Cycle Count") }}
          </ion-button>
        </template>
      </ion-content>
    </ion-modal>

    <!-- CLOSE ALERT -->
    <ion-alert
      :is-open="isCloseAlertOpen"
      header="Close Cycle Count"
      message="All items are already reviewed. Do you want to close the cycle count?"
      @didDismiss="isCloseAlertOpen = false"
      :buttons="[
        { text: 'Cancel', role: 'cancel' },
        { text: 'Confirm', handler: forceCloseWithoutAction }
      ]"
    ></ion-alert>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonAlert, IonProgressBar, IonAccordion, IonAccordionGroup,
  IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardContent, IonContent, IonFooter, IonHeader, IonIcon,
  IonItem, IonLabel, IonList, IonModal, IonPage,
  IonRadio, IonRadioGroup, IonTitle, IonToolbar,
  IonThumbnail, onIonViewDidEnter
} from "@ionic/vue";
import {
  closeOutline, calendarClearOutline, businessOutline
} from "ionicons/icons";
import { ref, computed, defineProps } from "vue";
import { translate } from "@/i18n";
import router from "@/router";
import { DateTime } from "luxon";
import { useInventoryCountRun } from "@/composables/useInventoryCountRun";
import { useInventoryCountImport } from "@/composables/useInventoryCountImport";
import { useProductMaster } from "@/composables/useProductMaster";
import { useProductStore } from "@/stores/productStore";
import { loader, showToast } from "@/services/uiUtils";
import ProgressBar from "@/components/ProgressBar.vue";
import Image from "@/components/Image.vue";
import SmartFilterSortBar from "@/components/SmartFilterSortBar.vue";
import { DynamicScroller, DynamicScrollerItem } from "vue-virtual-scroller";
import { getDateTimeWithOrdinalSuffix } from "@/services/utils";
import { useUserProfile } from "@/stores/userProfileStore";

/* props */
const props = defineProps({
  workEffortId: String,
});

/* state */
const aggregatedSessionItems = ref<any[]>([]);
const filteredSessionItems = ref<any[]>([]);
const selectedProductsReview = ref<any[]>([]);

const isLoading = ref(false);

const isBulkCloseModalOpen = ref(false);
const isCloseAlertOpen = ref(false);
const bulkAction = ref(null);

const workEffort = ref<any>(null);
const totalItems = ref(0);
const loadedItems = ref(0);
const submittedItemsCount = ref(0);

const firstCountedAt = ref();
const lastCountedAt = ref();

const userProfile = useUserProfile();

/* computed */
const openItems = computed(() =>
  aggregatedSessionItems.value.filter((item) => !item.decisionOutcomeEnumId)
);

const overallFilteredVarianceQtyProposed = computed(() =>
  filteredSessionItems.value.reduce(
    (sum, item) => sum + item.proposedVarianceQuantity,
    0
  )
);

/* lifecycle */
onIonViewDidEnter(async () => {
  isLoading.value = true;
  loadedItems.value = 0;

  try {
    const resp = await useInventoryCountRun().getProductReviewDetailCount({
      workEffortId: props.workEffortId,
    });
    totalItems.value = resp?.data?.count || 0;
  } catch {
    totalItems.value = 0;
  }

  await getWorkEffortDetails();
  if (workEffort.value) {
    await getInventoryCycleCount();
  }

  isLoading.value = false;
});

/* PRODUCT SELECTION */
function isSelected(product: any) {
  return selectedProductsReview.value.some(
    (productReview) => productReview.importItemSeqId === product.importItemSeqId
  );
}

function toggleSelectedForReview(product: any) {
  const index = selectedProductsReview.value.findIndex(
    (productReview) => productReview.importItemSeqId === product.importItemSeqId
  );
  if (index === -1) selectedProductsReview.value.push(product);
  else selectedProductsReview.value.splice(index, 1);
}

function toggleSelectAll(isChecked: any) {
  if (isChecked) {
    selectedProductsReview.value = filteredSessionItems.value.filter(
      (item) => !item.decisionOutcomeEnumId
    );
  } else {
    selectedProductsReview.value = [];
  }
}

/* API CALLS */
async function getWorkEffortDetails() {
  const resp = await useInventoryCountRun().getWorkEffort({
    workEffortId: props.workEffortId,
  });
  workEffort.value = resp?.data;
}

async function getInventoryCycleCount() {
  let pageIndex = 0;
  let pageSize = totalItems.value > 5000 ? 500 : 250;
  let hasMore = true;

  try {
    while (hasMore) {
      const resp = await useInventoryCountRun().getCycleCount({
        workEffortId: props.workEffortId,
        pageSize,
        pageIndex,
      });

      if (!resp?.data?.items?.length) break;

      const batchItems = resp.data.items;

      batchItems.forEach((item: any) => {
        if (item.itemStatusId === "CYCLE_ITEM_APPROVED") {
          item.decisionOutcomeEnumId = "APPLIED";
        } else if (item.itemStatusId === "CYCLE_ITEM_REJECTED") {
          item.decisionOutcomeEnumId = "SKIPPED";
        } else if (item.decisionOutcomeEnumId === undefined) {
          item.decisionOutcomeEnumId = null;
        }
        if (item.proposedVarianceQuantity === undefined) {
          item.proposedVarianceQuantity = item.proposedVariance ?? item.varianceQuantity ?? 0;
        }
        if (item.quantityOnHand === undefined) {
          item.quantityOnHand = item.systemQuantity ?? item.systemQuantityOnHand;
        }
      });

      aggregatedSessionItems.value.push(...batchItems);

      const productIds = [...new Set(
        batchItems
          .filter((item: any) => item?.productId)
          .map((item: any) => item.productId)
      )];

      if (productIds.length) {
        await useProductMaster().prefetch(productIds as any);
        for (const productId of productIds) {
          const { product } = await useProductMaster().getById(productId as any);
          if (!product) continue;

          aggregatedSessionItems.value
            .filter(item => item.productId === productId)
            .forEach(item => {
              item.product = product;
              item.internalName = item.internalName || product.internalName;
              item.detailImageUrl = item.detailImageUrl || product.mainImageUrl;
            });
        }
      }

      loadedItems.value = aggregatedSessionItems.value.length;

      if (batchItems.length < pageSize) {
        hasMore = false;
        break;
      }
      pageIndex++;
    }

    if (aggregatedSessionItems.value.length) {
      const minTimes = aggregatedSessionItems.value.map((item) => item.minLastUpdatedAt ?? item.lastUpdatedAt).filter(Boolean);
      const maxTimes = aggregatedSessionItems.value.map((item) => item.maxLastUpdatedAt ?? item.lastUpdatedAt).filter(Boolean);

      if (minTimes.length) firstCountedAt.value = Math.min(...minTimes);
      if (maxTimes.length) lastCountedAt.value = Math.max(...maxTimes);
    }

    submittedItemsCount.value = aggregatedSessionItems.value.filter(
      (item) => item.decisionOutcomeEnumId
    ).length;
    filteredSessionItems.value = [...aggregatedSessionItems.value].sort((predecessor, successor) =>
      (predecessor.internalName || '').localeCompare(successor.internalName || '')
    );
  } catch {
    aggregatedSessionItems.value = [];
    filteredSessionItems.value = [];
  }
}

/* REVIEW SUBMISSION */
async function applyDecisionToItem(item: any, outcome: any) {
  const payload = {
    workEffortId: props.workEffortId,
    inventoryCountImportId: item.inventoryCountImportId,
    importItemSeqId: item.importItemSeqId,
    productId: item.productId
  };

  if (outcome === "APPLIED") {
    await useInventoryCountImport().approveInventoryCountSessionItem(payload);
  } else {
    await useInventoryCountImport().rejectInventoryCountSessionItem(payload);
  }
}

async function submitSingleItemReview(item: any, outcome: any) {
  await loader.present("Submitting...");
  try {
    await applyDecisionToItem(item, outcome);

    item.decisionOutcomeEnumId = outcome;
    submittedItemsCount.value++;
  } catch {
    showToast("Error submitting review");
  }
  aggregatedSessionItems.value = [...aggregatedSessionItems.value];
  loader.dismiss();
}

async function submitSelectedProductReviews(outcome: any) {
  await loader.present("Submitting Review...");

  try {
    const batchSize = 250;

    for (let i = 0; i < selectedProductsReview.value.length; i += batchSize) {
      const batch = selectedProductsReview.value.slice(i, i + batchSize);

      await Promise.all(batch.map((item) => applyDecisionToItem(item, outcome)));

      batch.forEach((item) => {
        item.decisionOutcomeEnumId = outcome;
      });

      submittedItemsCount.value += batch.length;
    }

    selectedProductsReview.value = [];

    showToast("Submitted successfully");
  } catch {
    showToast("Some items failed");
  }
  aggregatedSessionItems.value = [...aggregatedSessionItems.value];

  loader.dismiss();
}

/* CLOSE CYCLE COUNT */
async function closeCycleCount() {
  await loader.present("Closing Cycle Count...");
  try {
    await useInventoryCountRun().updateWorkEffort({
      workEffortId: props.workEffortId,
      currentStatusId: "CYCLE_CNT_CLOSED",
      actualCompletionDate: DateTime.now().toMillis(),
    });
    router.replace(`/closed/${props.workEffortId}`);
  } catch {
    showToast("Failed to close cycle count");
  }
  loader.dismiss();
}

function handleCloseClick() {
  if (!openItems.value.length) {
    isCloseAlertOpen.value = true;
  } else {
    openBulkCloseModal();
  }
}

function openBulkCloseModal() {
  isBulkCloseModalOpen.value = true;
  bulkAction.value = null;
}

function closeBulkCloseModal() {
  isBulkCloseModalOpen.value = false;
}

async function performBulkCloseAction() {
  if (!bulkAction.value) return showToast("Please select an action");

  closeBulkCloseModal();
  await loader.present("Closing cycle count...");

  try {
    const batchSize = 250;

    for (let i = 0; i < openItems.value.length; i += batchSize) {
      const batch = openItems.value.slice(i, i + batchSize);

      await Promise.all(batch.map((item) => applyDecisionToItem(item, bulkAction.value)));

      batch.forEach((item) => {
        item.decisionOutcomeEnumId = bulkAction.value;
      });

      submittedItemsCount.value += batch.length;
    }

    await closeCycleCount();
  } catch (error: any) {
    showToast("Bulk action failed");
  }
  aggregatedSessionItems.value = [...aggregatedSessionItems.value];
  loader.dismiss();
}

async function forceCloseWithoutAction() {
  closeBulkCloseModal();
  await closeCycleCount();
}

/* HELPERS */
function stopAccordianEventProp(event: Event) {
  event.stopPropagation();
}

function getFacilityName(id: any) {
  const facilities = useProductStore().getFacilities || [];
  return facilities.find((facility) => facility.facilityId === id)?.facilityName || id;
}

function getTimeDifference(actual: any, expected: any) {
    if (!actual || !expected) return '';
    const dtActual = DateTime.fromMillis(actual);
    const dtExpected = DateTime.fromMillis(expected);
    const diff = dtActual.diff(dtExpected, ['days', 'hours', 'minutes']);
  
    const isLate = diff.toMillis() > 0;
    const absDiff = diff.mapUnits(number => Math.abs(number));
  
    const duration = absDiff.toFormat("d'd' h'h' m'm'")
      .replace(/\b0[dhm]\s*/g, '')
      .trim();
  
    if (!duration) return translate('On time');
  
    return `${duration} ${isLate ? translate('late') : translate('early')}`;
}
</script>

<style scoped>
/* NO CSS CHANGES */
.header {
  display: grid;
}

.statistics ion-item h3 {
  font-size: 1.2rem;
}

.controls {
  position: sticky;
  top: 0;
  background-color: var(--ion-background-color);
  z-index: 999;
}

.filters {
  display: flex;
  gap: var(--spacer-sm);
  align-items: end;
}

.filters > * {
  flex: 1;
}

.list-item.count-item-rollup {
  --columns-desktop: 5;
  border-top: 1px solid var(--ion-color-medium);
}

.list-item > ion-item {
  width: 100%;
}

.list-item.count-item {
  --columns-desktop: 5;
}

.list-item .item-key {
  padding-inline-start: var(--spacer-sm);
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-self: stretch;
}

.item-key ion-item {
  flex: 1;
}

.list-item .actions {
  display: flex;
  gap: var(--spacer-xs);
}

.virtual-scroller {
  --virtual-scroller-offset: 220px;
}

.virtual-list {
  display: block;
  width: 100%;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
}

.virtual-list ion-item {
  --min-height: 64px;
  border-bottom: 1px solid var(--ion-color-light);
}

.loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: all;
}
</style>
