import OBR from "https://esm.sh/@owlbear-rodeo/sdk";

export const EXTENSION_ID = "com.elyrias-tales.stat-bubbles-fp-mp";
export const METADATA_KEY = `${EXTENSION_ID}/stats`;
export const OVERLAY_KEY = `${EXTENSION_ID}/overlay`;
export const BASE_URL = "https://euglossabazinga.github.io/Elyrias-Tales/";
const OVERLAY_LAYOUT_VERSION = "layout-2026-06-10-6";
const OVERLAY_X_OFFSET = 0.1;
const OVERLAY_Y_OFFSET = 0.58;
let overlaySyncing = false;

export const STAT_DEFS = {
  hp: {
    label: "HP",
    title: "Hit Points",
    currentLabel: "Current HP",
    maxLabel: "Max HP",
    color: "#d84f45"
  },
  temp: {
    label: "THP",
    title: "Temporary Hit Points",
    currentLabel: "Temporary HP",
    maxLabel: "Temporary HP",
    color: "#8d9461"
  },
  armor: {
    label: "AC",
    title: "Armor Class",
    currentLabel: "Armor Class",
    maxLabel: "Armor Class",
    color: "#767fb5"
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
  temp: { current: 0, max: 0 },
  armor: { current: 12, max: 0 },
  fp: { current: 0, max: 0 },
  mp: { current: 0, max: 0 },
  playerEditable: true,
  visibility: "all"
};

export async function openStatWindow(stat, anchorElementId) {
  const def = STAT_DEFS[stat];
  await OBR.popover.open({
    id: `${EXTENSION_ID}/${stat}`,
    url: `${BASE_URL}stat.html?stat=${stat}`,
    height: 310,
    width: 310,
    anchorElementId,
    title: def.title
  });
}

export async function getSelectedItems() {
  const selectedIds = await OBR.player.getSelection();
  if (!selectedIds || selectedIds.length === 0) return [];
  const items = await OBR.scene.items.getItems(selectedIds);
  return items.filter(isCharacterItem);
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

export async function syncAllOverlays() {
  const items = await OBR.scene.items.getItems();
  const characterIds = new Set(items.filter(isCharacterItem).map((item) => item.id));
  const invalidOverlays = items.filter((item) => {
    const parentId = item.metadata?.[OVERLAY_KEY]?.parentId ?? item.attachedTo;
    return item.metadata?.[OVERLAY_KEY] && parentId && !characterIds.has(parentId);
  });
  if (invalidOverlays.length > 0) {
    await OBR.scene.items.deleteItems(invalidOverlays.map((item) => item.id));
  }
  const tokenIds = items
    .filter((item) => isCharacterItem(item) && item.metadata?.[METADATA_KEY] && !item.metadata?.[OVERLAY_KEY])
    .map((item) => item.id);
  await syncOverlaysForItems(tokenIds);
}

export async function syncOverlaysForItems(itemIds) {
  if (!itemIds.length || overlaySyncing) return;
  overlaySyncing = true;
  try {
    const builders = await loadBuilders();
    if (!builders) return;

    const allItems = await OBR.scene.items.getItems();
    const tokens = allItems.filter((item) => itemIds.includes(item.id) && isCharacterItem(item));
    const characterIds = new Set(tokens.map((item) => item.id));
    const oldOverlays = allItems.filter((item) => {
      const parentId = item.metadata?.[OVERLAY_KEY]?.parentId ?? item.attachedTo;
      return characterIds.has(parentId) || (item.name?.startsWith("Stat Bubble") && itemIds.includes(parentId));
    });
    const oldByParent = new Map();

    for (const overlay of oldOverlays) {
      const parentId = overlay.metadata?.[OVERLAY_KEY]?.parentId ?? overlay.attachedTo;
      if (!oldByParent.has(parentId)) oldByParent.set(parentId, []);
      oldByParent.get(parentId).push(overlay);
    }

    const toDelete = [];
    const overlays = [];
    for (const token of tokens) {
      const stats = readStats(token);
      const signature = overlaySignature(stats);
      const existing = oldByParent.get(token.id) ?? [];
      if (existing.length >= 9 && existing.every((item) => item.metadata?.[OVERLAY_KEY]?.signature === signature)) {
        continue;
      }

      toDelete.push(...existing.map((item) => item.id));
      if (!stats.hp.max && !stats.armor.current) continue;
      overlays.push(...buildOverlayItems(token, stats, builders));
    }

    if (toDelete.length > 0) {
      await OBR.scene.items.deleteItems(toDelete);
    }
    if (overlays.length > 0) {
      await OBR.scene.items.addItems(overlays);
    }
  } finally {
    overlaySyncing = false;
  }
}

export function normalizeStats(raw = EMPTY_STATS) {
  const result = copyStats(EMPTY_STATS);
  for (const key of Object.keys(result)) {
    if (typeof result[key] !== "object") continue;
    result[key] = {
      current: numberOrZero(raw?.[key]?.current),
      max: numberOrZero(raw?.[key]?.max)
    };
  }
  result.playerEditable = raw?.playerEditable !== false;
  result.visibility = raw?.visibility === "gm" ? "gm" : "all";
  return result;
}

export function percent(stat) {
  if (!stat.max || stat.max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((stat.current / stat.max) * 100)));
}

async function loadBuilders() {
  try {
    const sdk = await import("https://esm.sh/@owlbear-rodeo/sdk");
    if (!sdk.buildShape || !sdk.buildText) return null;
    return {
      buildShape: sdk.buildShape,
      buildText: sdk.buildText
    };
  } catch {
    return null;
  }
}

function buildOverlayItems(token, stats, builders) {
  const size = getTokenSize(token);
  const barWidth = Math.round(size * 1.55);
  const barHeight = Math.max(7, Math.round(size * 0.12));
  const lineHeight = Math.max(2, Math.round(size * 0.035));
  const x = token.position.x + Math.round(size * OVERLAY_X_OFFSET);
  const y = token.position.y + Math.round(size * OVERLAY_Y_OFFSET);
  const acDiameter = Math.max(18, Math.round(size * 0.28));
  const thpDiameter = Math.max(18, Math.round(size * 0.28));
  const acX = x + barWidth / 2 - acDiameter * 0.05;
  const acY = y - Math.round(size * 0.17);
  const thpX = acX - thpDiameter * 1.05;
  const thpY = acY;
  const visible = stats.visibility !== "gm";
  const common = {
    attachedTo: token.id,
    locked: true,
    disableHit: true,
    visible,
    metadata: {
      [OVERLAY_KEY]: {
        parentId: token.id
      }
    }
  };

  const hpPercent = percent(stats.hp) / 100;
  const fpPercent = percent(stats.fp) / 100;
  const mpPercent = percent(stats.mp) / 100;
  const hpText = `${stats.hp.current}/${stats.hp.max}`;
  const signature = overlaySignature(stats);
  common.metadata[OVERLAY_KEY].signature = signature;

  return [
    makeRect({
      builders,
      ...common,
      role: "hp-bg",
      x,
      y,
      width: barWidth,
      height: barHeight,
      color: "#6b2026",
      z: 10001
    }),
    makeRect({
      builders,
      ...common,
      role: "hp-fill",
      x: x - barWidth / 2 + (barWidth * hpPercent) / 2,
      y,
      width: Math.max(2, barWidth * hpPercent),
      height: barHeight,
      color: "#d83b44",
      z: 10002
    }),
    makeText({
      builders,
      ...common,
      role: "hp-text",
      x,
      y: y - 1,
      text: hpText,
      size: Math.max(11, Math.round(size * 0.18)),
      width: barWidth,
      height: barHeight * 1.8,
      z: 10003
    }),
    makeRect({
      builders,
      ...common,
      role: "fp-line",
      x: x - barWidth / 2 + (barWidth * fpPercent) / 2,
      y: y + barHeight / 2 + lineHeight / 2,
      width: Math.max(2, barWidth * fpPercent),
      height: lineHeight,
      color: "#f3d640",
      z: 10002
    }),
    makeRect({
      builders,
      ...common,
      role: "mp-line",
      x: x - barWidth / 2 + (barWidth * mpPercent) / 2,
      y: y + barHeight / 2 + lineHeight * 1.5,
      width: Math.max(2, barWidth * mpPercent),
      height: lineHeight,
      color: "#2d7ff0",
      z: 10002
    }),
    makeCircle({
      builders,
      ...common,
      role: "thp-bg",
      x: thpX,
      y: thpY,
      diameter: thpDiameter,
      color: "#626942",
      z: 10003
    }),
    makeText({
      builders,
      ...common,
      role: "thp-text",
      x: thpX - thpDiameter * 0.9,
      y: thpY - thpDiameter * 0.22,
      text: `${stats.temp.current}`,
      size: Math.max(10, Math.round(thpDiameter * 0.62)),
      width: thpDiameter,
      height: thpDiameter,
      z: 10004
    }),
    makeCircle({
      builders,
      ...common,
      role: "ac-bg",
      x: acX,
      y: acY,
      diameter: acDiameter,
      color: "#5671aa",
      z: 10003
    }),
    makeText({
      builders,
      ...common,
      role: "ac-text",
      x: acX - acDiameter * 0.9,
      y: acY - acDiameter * 0.22,
      text: `${stats.armor.current}`,
      size: Math.max(10, Math.round(acDiameter * 0.62)),
      width: acDiameter,
      height: acDiameter,
      z: 10004
    })
  ];
}

function makeRect(options) {
  const item = options.builders.buildShape()
    .name(`Stat Bubble ${options.role}`)
    .shapeType("RECTANGLE")
    .position({ x: options.x - options.width / 2, y: options.y - options.height / 2 })
    .width(options.width)
    .height(options.height)
    .fillColor(options.color)
    .strokeWidth(0)
    .layer("CONTROL")
    .attachedTo(options.attachedTo)
    .locked(options.locked)
    .disableHit(options.disableHit)
    .disableAutoZIndex(true)
    .visible(options.visible)
    .metadata(withOverlayRole(options.metadata, options.role))
    .zIndex(options.z)
    .build();
  return item;
}

function makeCircle(options) {
  const item = options.builders.buildShape()
    .name(`Stat Bubble ${options.role}`)
    .shapeType("CIRCLE")
    .position({ x: options.x - options.diameter / 2, y: options.y - options.diameter / 2 })
    .width(options.diameter)
    .height(options.diameter)
    .fillColor(options.color)
    .strokeColor("#ffffff")
    .strokeWidth(1)
    .layer("CONTROL")
    .attachedTo(options.attachedTo)
    .locked(options.locked)
    .disableHit(options.disableHit)
    .disableAutoZIndex(true)
    .visible(options.visible)
    .metadata(withOverlayRole(options.metadata, options.role))
    .zIndex(options.z)
    .build();
  return item;
}

function makeText(options) {
  const textWidth = options.width ?? Math.max(28, options.size * String(options.text).length * 0.62);
  const textHeight = options.height ?? Math.max(14, options.size * 1.25);
  const item = options.builders.buildText()
    .name(`Stat Bubble ${options.role}`)
    .plainText(options.text)
    .textType("PLAIN")
    .width(textWidth)
    .height(textHeight)
    .position({ x: options.x - textWidth / 2, y: options.y - textHeight / 2 })
    .fontSize(options.size)
    .fontWeight(700)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .fillColor("#ffffff")
    .strokeColor("#000000")
    .strokeWidth(2)
    .layer("CONTROL")
    .attachedTo(options.attachedTo)
    .locked(options.locked)
    .disableHit(options.disableHit)
    .disableAutoZIndex(true)
    .visible(options.visible)
    .metadata(withOverlayRole(options.metadata, options.role))
    .zIndex(options.z)
    .build();
  return item;
}

function withOverlayRole(metadata, role) {
  return {
    ...metadata,
    [OVERLAY_KEY]: {
      ...metadata[OVERLAY_KEY],
      role
    }
  };
}

function getTokenSize(token) {
  const candidates = [
    token.grid?.dpi,
    token.image?.grid?.dpi,
    token.image?.width,
    token.image?.height,
    token.width,
    token.height
  ].filter((value) => Number.isFinite(value) && value > 0);
  const raw = candidates[0] ?? 70;
  return Math.max(48, Math.min(90, raw));
}

function overlaySignature(stats) {
  return [
    OVERLAY_LAYOUT_VERSION,
    OVERLAY_X_OFFSET,
    OVERLAY_Y_OFFSET,
    stats.hp.current,
    stats.hp.max,
    stats.fp.current,
    stats.fp.max,
    stats.mp.current,
    stats.mp.max,
    stats.armor.current,
    stats.temp.current,
    stats.visibility
  ].join(":");
}

export function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isCharacterItem(item) {
  return item?.layer === "CHARACTER";
}

function copyStats(stats) {
  return JSON.parse(JSON.stringify(stats));
}
