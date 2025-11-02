import router from "@/router";
import store from "@/store";
import { computed, ref } from "vue";

export function useCycleCount() {
  const cycleCounts = computed(() => store.getters["count/getList"]);
  const isScrollable = computed(() => store.getters["count/isScrollable"]);

  const countsPageMeta = computed(() => {
    const path = router.currentRoute.value.path;

    if (path === "/assigned") {
      return {
        currentStatus: "CYCLE_CNT_CREATED,CYCLE_CNT_IN_PRGS",
        countsPageName: "Assigned",
        countDetailPageRoute: "/assigned"
      };
    } else if (path === "/pending-review") {
      return {
        currentStatus: "CYCLE_CNT_IN_CMPLTD",
        countsPageName: "Pending Review",
        countDetailPageRoute: "/pending-review"
      };
    } else if (path === "/closed") {
      return {
        currentStatus: "CYCLE_CNT_IN_CLOSED",
        countsPageName: "Closed",
        countDetailPageRoute: "/closed"
      };
    }

    return { currentStatus: "", countsPageName: "", countDetailPageRoute: "" };
  });

  const isScrollingEnabled = ref(false);
  const contentRef = ref<any>(null);
  const infiniteScrollRef = ref<any>(null);

  function enableScrolling() {
    const parentElement = contentRef.value?.$el;
    const scrollEl = parentElement?.shadowRoot?.querySelector("div[part='scroll']");
    if (!scrollEl) return;

    const scrollHeight = scrollEl.scrollHeight;
    const infiniteHeight = infiniteScrollRef?.value?.$el?.offsetHeight || 0;
    const scrollTop = scrollEl.scrollTop;
    const threshold = 100;
    const height = scrollEl.offsetHeight;

    const distanceFromInfinite = scrollHeight - infiniteHeight - scrollTop - threshold - height;
    isScrollingEnabled.value = distanceFromInfinite >= 0;
  }

  async function getCycleCounts(pageSize?: any, pageIndex?: any): Promise<any> {
    const { currentStatus } = countsPageMeta.value;

    await store.dispatch("count/getCycleCounts", {
      pageSize: pageSize ? pageSize : process.env.VUE_APP_VIEW_SIZE,
      pageIndex: pageIndex ? pageIndex : 0,
      currentStatusId: currentStatus,
      currentStatusId_op: "in",
    });
  }

  function clearCycleCount() {
    store.dispatch("count/clearCycleCountList");
  }

  async function loadMoreCycleCounts(event: any) {
    if (!(isScrollingEnabled.value && isScrollable.value)) {
      await event.target.complete();
      return;
    }

    await getCycleCounts(
      undefined,
      Math.ceil(cycleCounts.value?.length / Number(process.env.VUE_APP_VIEW_SIZE)).toString()
    );

    await event.target.complete();
  }

  return {
    cycleCounts,
    countsPageMeta,
    isScrollable,
    isScrollingEnabled,
    getCycleCounts,
    clearCycleCount,
    enableScrolling,
    loadMoreCycleCounts,
    contentRef,
    infiniteScrollRef,
  };
}
