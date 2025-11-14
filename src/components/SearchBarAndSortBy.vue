<template>
  <div class="header searchbar">
    <ion-searchbar @keyup.enter="updateQuery('queryString', $event.target.value)" />
    <ion-item lines="none">
      <ion-icon slot="start" :icon="swapVerticalOutline" />
      <ion-select :label="translate('Sort by')" :value="query.sortby" @ionChange="updateQuery('sortBy', $event.detail.value)" interface="popover">
        <ion-select-option value="dueDate asc">{{ translate("Due date") }}</ion-select-option>
        <ion-select-option value="createdDate asc">{{ translate("Created date") }}</ion-select-option>
        <ion-select-option value="workEffortName asc">{{ translate("Alphabetic") }}</ion-select-option>
      </ion-select> 
    </ion-item>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonItem, IonSearchbar, IonSelect, IonSelectOption } from "@ionic/vue";
import { swapVerticalOutline } from "ionicons/icons";
import { computed } from "vue"
import { translate } from "@/i18n";
import { useInventoryCountRun } from "@/composables/useInventoryCountRun";

const query = computed(() => useInventoryCountRun().query)

console.log("This is the query: ", query.value);

function updateQuery(key: string, value: any) {
  console.log("Hi");
  if (key === 'sortBy') query.value.sortby = value;
  if (key === 'queryString') query.value.queryString = value;
}
</script>
