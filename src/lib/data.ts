/**
 * AlbionForge game-data constants.
 *
 * All values verified 2026-10-11 against the sources below; every value is an
 * EDITABLE PRESET in the calculators because patches change numbers.
 *
 * - Return-rate formula (bonus ÷ (100 + bonus); base +18, refining city +40,
 *    crafting city +15, focus +59):
 *    https://albionfreemarket.com/articles/view/how-resource-return-rate-is-calculated-in-albion-online
 * - City refining bonuses (official wiki, archived):
 *    https://web.archive.org/web/2022/https://wiki.albiononline.com/wiki/Refining
 * - Refining recipes & base focus costs per tier:
 *    https://aoscout.online/guides/refining-for-beginners
 * - Focus cost formula (base × 0.5^(efficiency/10000)):
 *    https://albionfreemarket.com/articles/view/how-crafting-specialization-reduces-focus-costs-in-albion-online
 * - Station fee formula (nutrition = item value × 0.1125; fee = nutrition × rate/100):
 *    https://albionfreemarket.com/articles/view/how-crafting-station-fees-are-calculated-in-albion-online
 * - Market tax structure (setup fee 2.5 % non-refundable on orders; sales tax
 *    4 %, halved to 2 % with Premium; instant sell pays sales tax only):
 *    https://albionfreemarket.com/articles/view/artifact-melding-costs-and-chances-in-albion-online
 *    https://web.archive.org/web/2022/https://wiki.albiononline.com/wiki/Marketplace
 */

import type { MarketTax } from './engine';

/* ------------------------------------------------------------
   Market tax structure
 ------------------------------------------------------------ */
export interface TaxPreset {
  label: string;
  tax: MarketTax;
  hint: string;
}

export const TAX_PRESETS: Record<'standard' | 'premium', TaxPreset> = {
  standard: {
    label: 'No Premium',
    tax: { setupFeePct: 2.5, salesTaxPct: 4 },
    hint: 'Setup fee 2.5 % on placed orders + 4 % sales tax on sales',
  },
  premium: {
    label: 'With Premium',
    tax: { setupFeePct: 2.5, salesTaxPct: 2 },
    hint: 'Setup fee 2.5 % on placed orders + 2 % sales tax (Premium halves the sales tax)',
  },
};

/* ------------------------------------------------------------
   Resource return rate (RRR) - formula: bonus / (100 + bonus)
 ------------------------------------------------------------ */
/** Bonus points added to the production bonus before converting to a return rate. */
export const RRR_BONUS_POINTS = {
  cityBase: 18, // any royal city
  refiningBonusCity: 40, // refining the city's specialised resource
  craftingBonusCity: 15, // crafting the city's specialised lines
  focus: 59, // using focus
} as const;

export function rrrFromBonus(bonus: number): number {
  return bonus / (100 + bonus);
}

export interface RrrPreset {
  key: string;
  label: string;
  value: number;
  note: string;
}

/** Refining: base 18 → 15.25 %, +focus 77 → 43.50 %, bonus city 58 → 36.71 %, both 117 → 53.92 %. */
export const RRR_REFINING: RrrPreset[] = [
  { key: 'base', label: 'Base - 15.25%', value: 0.1525, note: 'Any royal city, no bonus, no focus.' },
  { key: 'base-focus', label: 'Base + Focus - 43.5%', value: 0.435, note: 'Non-bonus royal city, using focus.' },
  { key: 'bonus', label: 'Bonus city - 36.7%', value: 0.367, note: 'Refining the city’s specialised resource.' },
  { key: 'bonus-focus', label: 'Bonus city + Focus - 53.9%', value: 0.539, note: 'Specialised city and focus.' },
];

/** Crafting: base 18 → 15.25 %, +focus 77 → 43.50 %, bonus city 33 → 24.81 %, both 92 → 47.92 %. */
export const RRR_CRAFTING: RrrPreset[] = [
  { key: 'base', label: 'Base - 15.25%', value: 0.1525, note: 'Any royal city, no bonus, no focus.' },
  { key: 'base-focus', label: 'Base + Focus - 43.5%', value: 0.435, note: 'Non-bonus royal city, using focus.' },
  { key: 'bonus', label: 'Bonus city - 24.8%', value: 0.2481, note: 'Crafting the city’s specialised line.' },
  { key: 'bonus-focus', label: 'Bonus city + Focus - 47.9%', value: 0.4792, note: 'Specialised city and focus.' },
];

/* ------------------------------------------------------------
   Resources & refining bonus cities (official wiki, archived)
 ------------------------------------------------------------ */
export interface ResourceLine {
  key: string;
  name: string; // raw name
  refined: string; // refined name
  /** City whose refinery gives the bonus return rate. */
  bonusCity: string;
}

export const RESOURCES: ResourceLine[] = [
  { key: 'metal', name: 'Ore', refined: 'Metal Bar', bonusCity: 'Thetford' },
  { key: 'plank', name: 'Wood', refined: 'Plank', bonusCity: 'Fort Sterling' },
  { key: 'leather', name: 'Hide', refined: 'Leather', bonusCity: 'Martlock' },
  { key: 'cloth', name: 'Fiber', refined: 'Cloth', bonusCity: 'Lymhurst' },
  { key: 'stone', name: 'Rock', refined: 'Block', bonusCity: 'Bridgewatch' },
];

/* ------------------------------------------------------------
   Refining recipes: per ONE refined output of tier N
   (raw × N of own tier + 1 × refined of tier below)
 ------------------------------------------------------------ */
export interface RefineRecipe {
  tier: number;
  raw: number;
  lower: number; // always 1 for T3+; 0 for T2
  focus: number; // base focus cost per refine at 0 spec
}

export const REFINE_RECIPES: Record<number, RefineRecipe> = {
  2: { tier: 2, raw: 1, lower: 0, focus: 18 },
  3: { tier: 3, raw: 2, lower: 1, focus: 31 },
  4: { tier: 4, raw: 2, lower: 1, focus: 54 },
  5: { tier: 5, raw: 3, lower: 1, focus: 94 },
  6: { tier: 6, raw: 4, lower: 1, focus: 164 },
  7: { tier: 7, raw: 5, lower: 1, focus: 287 },
  8: { tier: 8, raw: 5, lower: 1, focus: 503 },
};

export const REFINE_FOCUS_BASE: Record<number, number> = Object.fromEntries(
  Object.values(REFINE_RECIPES).map((r) => [r.tier, r.focus]),
);

/* ------------------------------------------------------------
   Station usage fee (crafting)
 ------------------------------------------------------------ */
/** Nutrition consumed per craft = item value × 0.1125; fee = nutrition × rate / 100. */
export const NUTRITION_PER_ITEM_VALUE = 0.1125;

export function stationFee(itemValue: number, ratePer100Nutrition: number): number {
  return itemValue * NUTRITION_PER_ITEM_VALUE * (ratePer100Nutrition / 100);
}

/* ------------------------------------------------------------
   Focus cost formula
 ------------------------------------------------------------ */
/** Focus cost = base × 0.5^(efficiency / 10000) - every 10,000 efficiency halves the cost. */
export function focusCost(base: number, efficiency: number): number {
  return base * Math.pow(0.5, efficiency / 10000);
}

/* ------------------------------------------------------------
   Enchanting (artifact gear .1/.2/.3/.4)
 ------------------------------------------------------------ */
export type EnchantComponentKind = 'rune' | 'soul' | 'relic' | 'avalon';

export const ENCHANT_COMPONENT_NAMES: Record<EnchantComponentKind, string> = {
  rune: 'Runes',
  soul: 'Souls',
  relic: 'Relics',
  avalon: 'Avalonian Shards',
};

export interface EnchantPreset {
  level: number;
  label: string;
  component: EnchantComponentKind;
  /** Typical default quantity - varies by item slot; verify the recipe in-game. */
  qty: number;
}

/** Runes → .1, Souls → .2, Relics → .3, Avalonian shards → .4 (artifact gear). */
export const ENCHANT_PRESETS: EnchantPreset[] = [
  { level: 1, label: '.1', component: 'rune', qty: 1 },
  { level: 2, label: '.2', component: 'soul', qty: 1 },
  { level: 3, label: '.3', component: 'relic', qty: 1 },
  { level: 4, label: '.4', component: 'avalon', qty: 1 },
];

/* ------------------------------------------------------------
   Wiki & source citations used across pages
 ------------------------------------------------------------ */
export const SOURCES = {
  rrr: 'https://albionfreemarket.com/articles/view/how-resource-return-rate-is-calculated-in-albion-online',
  focusSpec:
    'https://albionfreemarket.com/articles/view/how-crafting-specialization-reduces-focus-costs-in-albion-online',
  stationFees:
    'https://albionfreemarket.com/articles/view/how-crafting-station-fees-are-calculated-in-albion-online',
  taxWorked:
    'https://albionfreemarket.com/articles/view/artifact-melding-costs-and-chances-in-albion-online',
  wikiRefiningArchive: 'https://web.archive.org/web/2022/https://wiki.albiononline.com/wiki/Refining',
  wikiMarketArchive:
    'https://web.archive.org/web/2022/https://wiki.albiononline.com/wiki/Marketplace',
  recipes: 'https://aoscout.online/guides/refining-for-beginners',
  wiki: 'https://albiononline.wiki.gg/',
};
