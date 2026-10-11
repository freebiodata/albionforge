/**
 * AlbionForge profit engine - pure, dependency-free math shared by every
 * calculator and by the Vitest scenario tests.
 *
 * Conventions
 * - `rrr`  = resource return rate as a fraction (0.367 = 36.7 %)
 * - taxes  = percentages (4 = 4 %)
 * - prices = silver per unit
 * - "craft" = one production action producing `outputsPerCraft` items
 */

/* ============================================================
   Market tax helpers
   ============================================================ */

export interface MarketTax {
  /** Order setup fee in percent, charged when PLACING an order (buy or sell). */
  setupFeePct: number;
  /** Sales tax in percent, charged on completed sales. */
  salesTaxPct: number;
}

export type SellMode = 'instant' | 'order';

/** Effective fraction of the sale price lost to taxes.
 *  Instant-selling into an existing buy order pays only the sales tax;
 *  placing a sell order additionally pays the (non-refundable) setup fee. */
export function sellTaxFraction(tax: MarketTax, mode: SellMode): number {
  const frac = tax.salesTaxPct / 100;
  return mode === 'order' ? frac + tax.setupFeePct / 100 : frac;
}

/** Silver received after market taxes for selling `qty` at `price`. */
export function netSellProceeds(
  price: number,
  qty: number,
  tax: MarketTax,
  mode: SellMode,
): number {
  return price * qty * (1 - sellTaxFraction(tax, mode));
}

/** Sell price (per unit) at which proceeds exactly cover `netCost`. */
export function breakEvenSellPrice(
  netCost: number,
  qty: number,
  tax: MarketTax,
  mode: SellMode,
): number {
  const keep = 1 - sellTaxFraction(tax, mode);
  return keep > 0 ? netCost / (qty * keep) : Infinity;
}

/** Silver paid to BUY qty units. Placing a buy order costs the setup fee on top. */
export function buyCost(
  price: number,
  qty: number,
  tax: MarketTax,
  placeBuyOrder: boolean,
): number {
  return price * qty * (1 + (placeBuyOrder ? tax.setupFeePct / 100 : 0));
}

/* ============================================================
   Generic production model (refining & crafting)
   ============================================================ */

export interface MaterialLine {
  name: string;
  /** Units required per craft (gross, before return rate). */
  qty: number;
  /** Buy price per unit. */
  unitCost: number;
  /** Whether the resource return rate applies to this line (resources do; verify artifacts in data.ts). */
  returnable: boolean;
}

export interface ProductionInput {
  materials: MaterialLine[];
  outputsPerCraft: number;
  numberOfCrafts: number;
  rrr: number;
  /** 'reuse' - returned materials offset the next craft (net consumption model).
   *  'sell' - returned materials are sold on the market at their sell prices. */
  returnMode: 'reuse' | 'sell';
  /** Market sell prices for returned materials (used when returnMode = 'sell'). */
  returnSellPrices?: Record<string, number>;
  /** Station usage fee in silver per craft. */
  usageFeePerCraft: number;
  /** Sell price of the produced item. */
  sellPrice: number;
  tax: MarketTax;
  sellMode: SellMode;
  /** Focus consumed per craft (0 when not using focus). */
  focusPerCraft: number;
}

export interface LineBreakdown extends MaterialLine {
  grossQty: number;
  returnedQty: number;
  netQty: number;
  grossCost: number;
  netCost: number;
  /** Value of returned units if sold (0 in reuse mode). */
  returnedValue: number;
}

export interface ProductionResult {
  outputs: number;
  lines: LineBreakdown[];
  grossInputCost: number;
  netInputCost: number;
  returnedValue: number;
  fees: number;
  proceeds: number;
  profit: number;
  profitPerItem: number;
  marginPct: number;
  focusUsed: number;
  profitPerFocus: number;
  breakEvenSell: number;
  roiPct: number;
}

export function runProduction(input: ProductionInput): ProductionResult {
  const { materials, outputsPerCraft, numberOfCrafts, rrr, returnMode, sellPrice, tax, sellMode } =
    input;

  const outputs = outputsPerCraft * numberOfCrafts;

  const lines: LineBreakdown[] = materials.map((m) => {
    const grossQty = m.qty * numberOfCrafts;
    const returnedQty = m.returnable ? grossQty * rrr : 0;
    const netQty = grossQty - returnedQty;
    const grossCost = grossQty * m.unitCost;
    const netCost = netQty * m.unitCost;
    const returnedValue =
      returnMode === 'sell'
        ? returnedQty * (input.returnSellPrices?.[m.name] ?? m.unitCost) *
          (1 - tax.salesTaxPct / 100)
        : 0;
    return { ...m, grossQty, returnedQty, netQty, grossCost, netCost, returnedValue };
  });

  const grossInputCost = lines.reduce((s, l) => s + l.grossCost, 0);
  const netInputCost = lines.reduce((s, l) => s + l.netCost, 0);
  const returnedValue = lines.reduce((s, l) => s + l.returnedValue, 0);
  const fees = input.usageFeePerCraft * numberOfCrafts;
  const proceeds = netSellProceeds(sellPrice, outputs, tax, sellMode);

  // In reuse mode you effectively consume net (returns offset the next craft).
  // In sell mode you pay for the gross recipe and sell the returns separately.
  const costBasis = returnMode === 'sell' ? grossInputCost : netInputCost;
  const invested = costBasis + fees;
  const effectiveInvested = invested - returnedValue;
  const profit = proceeds + returnedValue - invested;
  const focusUsed = input.focusPerCraft * numberOfCrafts;

  return {
    outputs,
    lines,
    grossInputCost,
    netInputCost,
    returnedValue,
    fees,
    proceeds,
    profit,
    profitPerItem: outputs > 0 ? profit / outputs : 0,
    marginPct: effectiveInvested > 0 ? (profit / effectiveInvested) * 100 : 0,
    focusUsed,
    profitPerFocus: focusUsed > 0 ? profit / focusUsed : 0,
    breakEvenSell: breakEvenSellPrice(effectiveInvested, outputs, tax, sellMode),
    roiPct: effectiveInvested > 0 ? (profit / effectiveInvested) * 100 : 0,
  };
}

/* ============================================================
   Refining specialisation
   ============================================================ */

export interface RefineParams {
  tier: number; // 2..8
  resourceKey: string; // 'metal' | 'plank' | 'leather' | 'cloth' | 'stone'
  numberOfCrafts: number;
  rawPrice: number;
  lowerPrice: number;
  refinedSellPrice: number;
  rrr: number;
  returnMode: 'reuse' | 'sell';
  rawSellPrice: number;
  lowerSellPrice: number;
  usageFeePerCraft: number;
  focusPerCraft: number;
  tax: MarketTax;
  sellMode: SellMode;
  /** Filled from data.ts recipe table: raw + lower refined per single output. */
  rawPer: number;
  lowerPer: number;
}

/**
 * Refining = production with a two-line recipe:
 *   rawPer × tier-N raw + lowerPer × tier-(N−1) refined → 1 × tier-N refined.
 * With return rate r, net consumption per craft = recipe × (1 − r).
 */
export function runRefining(p: RefineParams): ProductionResult {
  const materials: MaterialLine[] = [
    {
      name: `T${p.tier} raw`,
      qty: p.rawPer,
      unitCost: p.rawPrice,
      returnable: true,
    },
    {
      name: `T${p.tier - 1} refined`,
      qty: p.lowerPer,
      unitCost: p.lowerPrice,
      returnable: true,
    },
  ].filter((m) => m.qty > 0);

  return runProduction({
    materials,
    outputsPerCraft: 1,
    numberOfCrafts: p.numberOfCrafts,
    rrr: p.rrr,
    returnMode: p.returnMode,
    returnSellPrices: {
      [`T${p.tier} raw`]: p.rawSellPrice,
      [`T${p.tier - 1} refined`]: p.lowerSellPrice,
    },
    usageFeePerCraft: p.usageFeePerCraft,
    sellPrice: p.refinedSellPrice,
    tax: p.tax,
    sellMode: p.sellMode,
    focusPerCraft: p.focusPerCraft,
  });
}

/** Raw-material price at which refining breaks even (reuse model, linear solve). */
export function refineBreakEvenRawPrice(p: RefineParams): number {
  const r = 1 - p.rrr;
  const netRaw = p.rawPer * p.numberOfCrafts * r;
  if (netRaw <= 0) return Infinity;
  const proceeds = netSellProceeds(
    p.refinedSellPrice,
    p.numberOfCrafts,
    p.tax,
    p.sellMode,
  );
  const netLower = p.lowerPer * p.numberOfCrafts * r;
  const fees = p.usageFeePerCraft * p.numberOfCrafts;
  return (proceeds - netLower * p.lowerPrice - fees) / netRaw;
}

/* ============================================================
   Transport / arbitrage
   ============================================================ */

export interface TransportParams {
  buyPrice: number;
  sellPrice: number;
  qty: number;
  /** Weight of ONE unit in kg (game weight units). */
  unitWeight: number;
  /** Total carrying capacity per trip (mount + character). 0 = ignore trips. */
  capacityPerTrip: number;
  tax: MarketTax;
  sellMode: SellMode;
  /** Place buy orders at origin (pays setup fee on the buy side). */
  placeBuyOrder: boolean;
  /** Flat silver cost per trip (mounts lost risk, ferry, repairs…). */
  costPerTrip: number;
}

export interface TransportResult {
  buyTotal: number;
  proceeds: number;
  totalWeight: number;
  trips: number;
  transportCosts: number;
  profit: number;
  profitPerTrip: number;
  profitPer100Weight: number;
  profitPerUnit: number;
  marginPct: number;
  breakEvenSell: number;
}

/** Buy price at origin at which the trip breaks even. */
export function transportBreakEvenBuyPrice(p: TransportParams): number {
  const proceeds = netSellProceeds(p.sellPrice, p.qty, p.tax, p.sellMode);
  const totalWeight = p.qty * p.unitWeight;
  const trips =
    p.capacityPerTrip > 0 && totalWeight > 0 ? Math.ceil(totalWeight / p.capacityPerTrip) : 1;
  const denom = p.qty * (1 + (p.placeBuyOrder ? p.tax.setupFeePct / 100 : 0));
  return denom > 0 ? (proceeds - trips * p.costPerTrip) / denom : Infinity;
}

export function runTransport(p: TransportParams): TransportResult {
  const buyTotal = buyCost(p.buyPrice, p.qty, p.tax, p.placeBuyOrder);
  const proceeds = netSellProceeds(p.sellPrice, p.qty, p.tax, p.sellMode);
  const totalWeight = p.qty * p.unitWeight;
  const trips =
    p.capacityPerTrip > 0 && totalWeight > 0 ? Math.ceil(totalWeight / p.capacityPerTrip) : 1;
  const transportCosts = trips * p.costPerTrip;

  const profit = proceeds - buyTotal - transportCosts;

  return {
    buyTotal,
    proceeds,
    totalWeight,
    trips,
    transportCosts,
    profit,
    profitPerTrip: profit / trips,
    profitPer100Weight: totalWeight > 0 ? (profit / totalWeight) * 100 : 0,
    profitPerUnit: p.qty > 0 ? profit / p.qty : 0,
    marginPct: buyTotal > 0 ? (profit / buyTotal) * 100 : 0,
    breakEvenSell: breakEvenSellPrice(buyTotal + transportCosts, p.qty, p.tax, p.sellMode),
  };
}
