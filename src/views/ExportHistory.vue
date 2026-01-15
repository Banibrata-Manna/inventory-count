<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/closed"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ translate("Export history") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-list-header>
          <ion-label>{{ translate("Latest exports are at the top") }}</ion-label>
        </ion-list-header>
        <div class="list-item" v-for="log in exportLogs" :key="log.logId">
          <ion-item lines="none">
            <ion-icon :icon="documentOutline" slot="start"></ion-icon>
            <ion-label>
              {{ extractFilename(log) || '-' }}
              <p>{{ log.logId }}</p>
            </ion-label>
          </ion-item>
          <ion-label>
            {{ formatDate(log.createdDate) }}
            <p>{{ translate("Created Date") }}</p>
          </ion-label>
          <ion-label>
            {{ formatDate(log.finishDateTime) }}
            <p>{{ translate("Exported Date") }}</p>
          </ion-label>
          <ion-label>
            {{ log.createdByUserLogin || '-' }}
            <p>{{ translate("User Login") }}</p>
          </ion-label>
          <ion-chip outline :color="getStatusColor(log.statusId)">
            <ion-label>{{ getStatusLabel(log.statusId) }}</ion-label>
          </ion-chip>
          <ion-button fill="clear" color="tertiary" :disabled="log.statusId !== 'SERVICE_FINISHED' || !extractFilename(log) || !log.dataResourceId" @click.stop="downloadExport(log)">
            <ion-icon slot="icon-only" :icon="downloadOutline"></ion-icon>
          </ion-button>
        </div>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton, IonList, IonItem, IonLabel, IonIcon, IonChip, IonListHeader, onIonViewDidEnter } from '@ionic/vue';
import { ref } from 'vue';
import { translate } from '@/i18n';
import { documentOutline, downloadOutline } from 'ionicons/icons';
import { useInventoryCountRun } from '@/composables/useInventoryCountRun';
import { hasError } from '@/stores/authStore';
import { showToast } from '@/services/uiUtils';
import logger from '@/logger';
import { getDateTimeWithOrdinalSuffix } from '@/services/utils';
import { saveAs } from 'file-saver';

const exportLogs = ref<any[]>([]);

onIonViewDidEnter(async () => {
  await fetchExportHistory();
});

async function fetchExportHistory() {
  try {
    const resp = await useInventoryCountRun().getCycleCountExportLogs({ orderByField: 'createdDate DESC' });

    if (!hasError(resp)) {
      const data = resp?.data || {};
      exportLogs.value = Array.isArray(data.dataManagerLogs) ? data.dataManagerLogs : Array.isArray(data) ? data : [];
    } else {
      exportLogs.value = [];
      throw resp.data;
    }
  } catch (err) {
    logger.error('Error fetching exported cycle counts logs', err);
    exportLogs.value = [];
    showToast(translate('Failed to load export history.'));
  }
}

function formatDate(value: any) {
  return value ? getDateTimeWithOrdinalSuffix(value) : '-';
}

function extractFilename(log: any) {
  if (log?.fileName) return log.fileName;
  if (!log?.filePath) return '';
  const parts = log.filePath.split('/');
  return parts[parts.length - 1] || '';
}

function getStatusLabel(statusId: string) {
  if (!statusId) return '';
  if (statusId === 'SERVICE_PENDING' || statusId === 'SERVICE_QUEUED' || statusId === 'SERVICE_RUNNING') return translate('Exporting');
  if (statusId === 'SERVICE_FINISHED') return translate('Generated');
  if (statusId === 'SERVICE_FAILED' || statusId === 'SERVICE_CRASHED') return translate('Error');
  if (statusId === 'SERVICE_CANCELLED') return translate('Cancelled');
  return statusId;
}

function getStatusColor(statusId: string) {
  if (statusId === 'SERVICE_PENDING' || statusId === 'SERVICE_QUEUED' || statusId === 'SERVICE_RUNNING') return 'medium';
  if (statusId === 'SERVICE_FINISHED') return 'success';
  if (statusId === 'SERVICE_FAILED' || statusId === 'SERVICE_CRASHED') return 'danger';
  if (statusId === 'SERVICE_CANCELLED') return 'warning';
  return 'medium';
}

async function downloadExport(log: any) {
  try {
    if (!log?.dataResourceId) {
      throw new Error('Missing dataResourceId for export download.');
    }
    const resp = await useInventoryCountRun().downloadExportedCycleCountsFile({
      dataResourceId: log.dataResourceId
    });
    const fileName = extractFilename(log) || 'CycleCountsExport.csv';
    downloadCsv(resp?.data, fileName);
  } catch (err) {
    logger.error('Failed to download exported cycle count file', err);
    showToast(translate('Failed to download exported cycle count file.'));
  }
}

function downloadCsv(data: any, fileName: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, fileName ? fileName : 'CycleCountsExport.csv');
  return blob;
}
</script>

<style scoped>

.list-item {
  --columns-desktop: 6;
  border-bottom : 1px solid var(--ion-color-medium);
}

</style>
