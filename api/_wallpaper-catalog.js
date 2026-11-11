'use strict';
// Server-side wallpaper catalog. Amounts are fixed TWD integers.
// Client-submitted prices are ignored.

const ASSET_MANIFEST_PREFIX = 'WP-HALFPPRICE-20261110';
const CATALOG = {
  'WP-COLOR-ORBITS': {
    sku: 'WP-COLOR-ORBITS',
    code: '01',
    amount: 133,
    currency: 'TWD',
    name_en: 'COLOR ORBITS',
    name_zh: '色彩環流',
    public_name: 'COLOR ORBITS / 色彩環流',
    item_name: 'COLOR ORBITS / 色彩環流 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'color-orbits.zip',
      sha256: '7bfbe2e8f9d5ccb67da1dd4b12fd19c7696010a80f11f5b3e386752e04bd9e8c',
      size: 17081285,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/color-orbits.zip',
      asset_manifest_id: 'WP-COLOR-ORBITS-V1',
    },
  },
  'WP-VERDANT-GARDEN': {
    sku: 'WP-VERDANT-GARDEN',
    code: '02',
    amount: 133,
    currency: 'TWD',
    name_en: 'VERDANT GARDEN',
    name_zh: '翠綠花園',
    public_name: 'VERDANT GARDEN / 翠綠花園',
    item_name: 'VERDANT GARDEN / 翠綠花園 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'verdant-garden.zip',
      sha256: '5f5ea5469992d37069ee0efa016c7df4df644b2ca406d64fd797ca4faaa6eff3',
      size: 16112265,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/verdant-garden.zip',
      asset_manifest_id: 'WP-VERDANT-GARDEN-V1',
    },
  },
  'WP-NIGHT-SWIRLS': {
    sku: 'WP-NIGHT-SWIRLS',
    code: '03',
    amount: 133,
    currency: 'TWD',
    name_en: 'NIGHT SWIRLS',
    name_zh: '夜色漩紋',
    public_name: 'NIGHT SWIRLS / 夜色漩紋',
    item_name: 'NIGHT SWIRLS / 夜色漩紋 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'night-swirls.zip',
      sha256: '607bc0f8f09c1e0eebcb5475e2c7f5dcc123092789fb3e900dfa6d34085f57da',
      size: 19491114,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/night-swirls.zip',
      asset_manifest_id: 'WP-NIGHT-SWIRLS-V1',
    },
  },
  'WP-GOLDEN-MEADOW': {
    sku: 'WP-GOLDEN-MEADOW',
    code: '04',
    amount: 133,
    currency: 'TWD',
    name_en: 'GOLDEN MEADOW',
    name_zh: '金色原野',
    public_name: 'GOLDEN MEADOW / 金色原野',
    item_name: 'GOLDEN MEADOW / 金色原野 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'golden-meadow.zip',
      sha256: '14c911a158aaa5ee86a00025242587ee121c06faf7e90c7a3af8c1d09c23626d',
      size: 17451977,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/golden-meadow.zip',
      asset_manifest_id: 'WP-GOLDEN-MEADOW-V1',
    },
  },
  'WP-RED-FLAME-WEAVE': {
    sku: 'WP-RED-FLAME-WEAVE',
    code: '05',
    amount: 133,
    currency: 'TWD',
    name_en: 'RED FLAME WEAVE',
    name_zh: '紅焰織紋',
    public_name: 'RED FLAME WEAVE / 紅焰織紋',
    item_name: 'RED FLAME WEAVE / 紅焰織紋 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'red-flame-weave.zip',
      sha256: 'c7588cbd1be547ab56d6d4358015fc2b33b03466a98ab1b035875e62f08d4f1c',
      size: 21999646,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/red-flame-weave.zip',
      asset_manifest_id: 'WP-RED-FLAME-WEAVE-V1',
    },
  },
  'WP-HEART-LAYERS': {
    sku: 'WP-HEART-LAYERS',
    code: '06',
    amount: 133,
    currency: 'TWD',
    name_en: 'HEART LAYERS',
    name_zh: '層層心形',
    public_name: 'HEART LAYERS / 層層心形',
    item_name: 'HEART LAYERS / 層層心形 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'heart-layers.zip',
      sha256: 'ffeff19777b9a8dbe2aac21e65493d836d8643840f521eee4cd485c1366bba34',
      size: 20916568,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/heart-layers.zip',
      asset_manifest_id: 'WP-HEART-LAYERS-V1',
    },
  },
  'WP-WARM-CURRENTS': {
    sku: 'WP-WARM-CURRENTS',
    code: '07',
    amount: 133,
    currency: 'TWD',
    name_en: 'WARM CURRENTS',
    name_zh: '暖色流光',
    public_name: 'WARM CURRENTS / 暖色流光',
    item_name: 'WARM CURRENTS / 暖色流光 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'warm-currents.zip',
      sha256: '4cceedf537eaa54bb390b5915356f1def3e903ef07c3b085900ee0c19d048fe0',
      size: 14272330,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/warm-currents.zip',
      asset_manifest_id: 'WP-WARM-CURRENTS-V1',
    },
  },
  'WP-INFINITY-LOOPS': {
    sku: 'WP-INFINITY-LOOPS',
    code: '08',
    amount: 133,
    currency: 'TWD',
    name_en: 'INFINITY LOOPS',
    name_zh: '無限迴圈',
    public_name: 'INFINITY LOOPS / 無限迴圈',
    item_name: 'INFINITY LOOPS / 無限迴圈 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'infinity-loops.zip',
      sha256: '41280e0f76b2139e2c4b79d49b710f17ec0c0d247019b17620715c770a6c71dd',
      size: 16767502,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/infinity-loops.zip',
      asset_manifest_id: 'WP-INFINITY-LOOPS-V1',
    },
  },
  'WP-FEATHER-BRIGHTS': {
    sku: 'WP-FEATHER-BRIGHTS',
    code: '09',
    amount: 133,
    currency: 'TWD',
    name_en: 'FEATHER BRIGHTS',
    name_zh: '羽彩繽紛',
    public_name: 'FEATHER BRIGHTS / 羽彩繽紛',
    item_name: 'FEATHER BRIGHTS / 羽彩繽紛 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'feather-brights.zip',
      sha256: '199d881a628cb6203457fc1aef2bbfa181ff02fbd86c4c6f5fe69a115223c5ef',
      size: 14613681,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/feather-brights.zip',
      asset_manifest_id: 'WP-FEATHER-BRIGHTS-V1',
    },
  },
  'WP-SKETCHBOOK-SPARKS': {
    sku: 'WP-SKETCHBOOK-SPARKS',
    code: '10',
    amount: 133,
    currency: 'TWD',
    name_en: 'SKETCHBOOK SPARKS',
    name_zh: '色彩火花',
    public_name: 'SKETCHBOOK SPARKS / 色彩火花',
    item_name: 'SKETCHBOOK SPARKS / 色彩火花 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'sketchbook-sparks.zip',
      sha256: '6be4d8bde148c35ee03b5af1c7adcf1d81b575a64b50d05662e17c87a984e098',
      size: 20217154,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/sketchbook-sparks.zip',
      asset_manifest_id: 'WP-SKETCHBOOK-SPARKS-V1',
    },
  },
  'WP-EARTH-TEXTURES': {
    sku: 'WP-EARTH-TEXTURES',
    code: '11',
    amount: 133,
    currency: 'TWD',
    name_en: 'EARTH TEXTURES',
    name_zh: '大地肌理',
    public_name: 'EARTH TEXTURES / 大地肌理',
    item_name: 'EARTH TEXTURES / 大地肌理 (5 wallpapers)',
    kind: 'five',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'earth-textures.zip',
      sha256: 'a2ee5f7694e17291e63242513b1c54e43f957fbc851e340ffb9c1152c94b7b44',
      size: 13532398,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/earth-textures.zip',
      asset_manifest_id: 'WP-EARTH-TEXTURES-V1',
    },
  },
  'WP-AE-COLOR-UNIVERSE-9': {
    sku: 'WP-AE-COLOR-UNIVERSE-9',
    code: '12',
    amount: 199,
    currency: 'TWD',
    name_en: 'AE Color Universe',
    name_zh: 'AE色彩宇宙',
    public_name: 'AE Color Universe / AE色彩宇宙',
    item_name: 'AE Color Universe / AE色彩宇宙 (9 wallpapers)',
    kind: 'nine',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'ae-color-universe-9.zip',
      sha256: '8518cd4eb5db17d51766a274ffdd0c812c284d289cb325261073eaf434d67d94',
      size: 39729891,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/ae-color-universe-9.zip',
      asset_manifest_id: 'WP-AE-COLOR-UNIVERSE-9-V1',
    },
  },
  'WP-AE-HEART-UNIVERSE-9': {
    sku: 'WP-AE-HEART-UNIVERSE-9',
    code: '13',
    amount: 266,
    currency: 'TWD',
    name_en: 'AE Heart Universe',
    name_zh: 'AE心宇宙',
    public_name: 'AE Heart Universe / AE心宇宙',
    item_name: 'AE Heart Universe / AE心宇宙 (9-piece set)',
    kind: 'nine',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'ae-heart-universe-9.zip',
      sha256: '240cbc1b29c4292f0b9ec81428b82e8791543a20fec41fe7a11372b2992552cd',
      size: 20746368,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/ae-heart-universe-9.zip',
      asset_manifest_id: 'WP-AE-HEART-UNIVERSE-9-V1',
    },
  },
  'WP-ETERNAL-SUN-4': {
    sku: 'WP-ETERNAL-SUN-4',
    code: '14',
    amount: 233,
    currency: 'TWD',
    name_en: 'Eternal Sun',
    name_zh: '盛明',
    public_name: 'Eternal Sun / 盛明',
    item_name: 'Eternal Sun / 盛明 (4-edition set)',
    kind: 'set4',
    active: true,
    fulfillment_enabled: true,
    asset: {
      filename: 'eternal-sun-4.zip',
      sha256: '5f7ac6112d925b765fe8449a999be0860a95238bfde71076b9754c76ec92d3d4',
      size: 10451278,
      contentType: 'application/zip',
      blob_path: 'ae-private/wallpapers/eternal-sun-4.zip',
      asset_manifest_id: 'WP-ETERNAL-SUN-4-V1',
    },
  },
};

const CODE_SKU = Object.fromEntries(
  Object.values(CATALOG).map((row) => [row.code, row.sku])
);

function listSkus() {
  return Object.values(CATALOG).map((row) => ({
    sku: row.sku,
    amount: row.amount,
    currency: row.currency,
    name_en: row.name_en,
    name_zh: row.name_zh,
    public_name: row.public_name,
    fulfillment_enabled: row.fulfillment_enabled,
    active: row.active,
  }));
}

function getWallpaperSku(sku) {
  const clean = String(sku || '').trim().toUpperCase();
  return CATALOG[clean] || null;
}

function getWallpaperAsset(sku) {
  const row = getWallpaperSku(sku);
  if (!row || !row.asset) return null;
  return { sku: row.sku, asset_manifest_id: row.asset.asset_manifest_id, ...row.asset };
}

function makeWallpaperTradeNo(sku, crypto) {
  const row = getWallpaperSku(sku);
  if (!row) throw new Error('Unknown SKU');
  const stamp = Date.now().toString(36).toUpperCase().slice(-8);
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase();
  return (`AEW${row.code}${stamp}${rnd}`).slice(0, 20);
}

function skuFromWallpaperTradeNo(value) {
  const tradeNo = String(value || '');
  const m = /^AEW(\d{2})[A-Z0-9]+$/.exec(tradeNo);
  if (!m || tradeNo.length > 20) return null;
  return CODE_SKU[m[1]] || null;
}

module.exports = {
  CATALOG,
  listSkus,
  getWallpaperSku,
  getWallpaperAsset,
  makeWallpaperTradeNo,
  skuFromWallpaperTradeNo,
};

