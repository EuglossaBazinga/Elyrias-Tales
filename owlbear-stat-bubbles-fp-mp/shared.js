import OBR from "https://esm.sh/@owlbear-rodeo/sdk";

export const EXTENSION_ID = "com.elyrias-tales.stat-bubbles-fp-mp";
export const METADATA_KEY = `${EXTENSION_ID}/stats`;

export const STAT_DEFS = {
  hp: {
    label: "HP",
    title: "Hit Points",
    currentLabel: "Current HP",
    maxLabel: "Max HP",
    color: "#d84f45"
  },
  fp: {
    label: "FP",
    title: "Focus Points",
    currentLabel: "Current FP",
    maxLabel: "Max FP",
    color: "#62b56e"
  },
  mp: {
    label: "MP",
    title: "Magic Points",
    currentLabel: "Current MP",
    maxLabel: "Max MP",
    color: "#4c8fda"
  }
};

export const EMPTY_STATS = {
  hp: { current: 0, max: 0 },
  fp: { current: 0, max: 0 },
  mp: { current: 0, max: 0 }
};

export async function openManager(anchorElementId) {
  await OBR.popover.open({
    id: `${EXTENSION_ID}/manager`,
    url: "manager.html",
    height: 560,
    width: 380,
    anchorElementId
  });
}

export async function openStatWindow(stat, anchorElementId) {
  const def = STAT_DEFS[stat];
  await OBR.popover.open({
    id: `${EXTENSION_ID}/${stat}`,
    url: `stat.html?stat=${stat}`,
    height: 310,
    width: 310,
    anchorElementId,
    title: def.title
  });
}

export async function getSelectedItems() {
  const selectedIds = await OBR.player.getSelection();
  if (!selectedIds || selectedIds.length === 0) return [];
  return OBR.scene.items.getItems(selectedIds);
}

export function readStats(item) {
  return normalizeStats(item?.metadata?.[METADATA_KEY]);
}

export async function saveStats(itemIds, stats) {
  if (!itemIds.length) return;
  const normalized = normalizeStats(stats);
  await OBR.scene.items.updateItems(itemIds, (items) => {
    for (const item of items) {
      item.metadata[METADATA_KEY] = normalized;
    }
  });
}

export function normalizeStats(raw = EMPTY_STATS) {
  const result = copyStats(EMPTY_STATS);
  for (const key of Object.keys(result)) {
    result[key] = {
      current: numberOrZero(raw?.[key]?.current),
      max: numberOrZero(raw?.[key]?.max)
    };
  }
  return result;
}

export function percent(stat) {
  if (!stat.max || stat.max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((stat.current / stat.max) * 100)));
}

export function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function copyStats(stats) {
  return JSON.parse(JSON.stringify(stats));
}
