<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate(countsPageMeta.countsPageName) }}</ion-title>
        <ion-buttons slot="end">
          <ion-menu-button menu="assigned-filter">
            <ion-icon :icon="filterOutline" />
          </ion-menu-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content ref="contentRef" :scroll-events="true" @ionScroll="enableScrolling()" id="filter">
      <!-- <SearchBarAndSortBy /> -->
      <p v-if="!cycleCounts?.length" class="empty-state">
        {{ translate("No cycle counts found") }}
      </p>
      <ion-list v-else>
        <div class="list-item" v-for="count in cycleCounts" :key="count.workEffortId" button @click="router.push(`${countsPageMeta.countDetailPageRoute}/${count.workEffortId}`)">
          <ion-item lines="none">
            <ion-icon :icon="storefrontOutline" slot="start"></ion-icon>
            <ion-label>
              <p class="overline" v-if="count.countTypeEnumId === 'HARD_COUNT'">{{ translate("HARD COUNT") }}</p>
              {{ count.workEffortName }}
              <p>{{ count.workEffortId }}</p>
            </ion-label>
          </ion-item>
          
          <ion-chip outline>
            <ion-label>{{ getFacilityName(count?.facilityId) }}</ion-label>
          </ion-chip>
          

          <ion-label>
            {{ getDateWithOrdinalSuffix(count.dueDate) }}
            <p>{{ translate("due date") }}</p>
          </ion-label>
          
          <ion-item lines="none">
            <ion-badge class="status-badge" slot="end">{{ count.currentStatusId }}</ion-badge>
          </ion-item>
        </div>
      </ion-list>

      <ion-infinite-scroll ref="infiniteScrollRef" v-show="isScrollable" threshold="100px" @ionInfinite="loadMoreCycleCounts($event)">
        <ion-infinite-scroll-content loading-spinner="crescent" :loading-text="translate('Loading')" />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { translate } from '@/i18n'
import { filterOutline, storefrontOutline } from "ionicons/icons";
import {
  IonBadge,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonLabel,
  IonList,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  onIonViewDidEnter,
  onIonViewWillLeave
} from "@ionic/vue";
import { getDateWithOrdinalSuffix, getFacilityName } from "@/utils"
import router from "@/router"
import { loader } from "@/user-utils";
import { useCycleCount } from '@/composables/useCycleCount'

const {
  contentRef,
  infiniteScrollRef,
  enableScrolling,
  cycleCounts,
  isScrollable,
  getCycleCounts,
  clearCycleCount,
  loadMoreCycleCounts,
  countsPageMeta
} = useCycleCount();

onIonViewDidEnter(async () => {
  await loader.present("Loading...");
  await getCycleCounts();
  loader.dismiss();
})

onIonViewWillLeave(async () => {
  clearCycleCount();
})
</script>

<style scoped>
.list-item {
  --columns-desktop: 6;
  border-bottom: 1px solid var(--ion-color-medium);
}

.list-item > ion-item {
  width: 100%;
}
</style>
