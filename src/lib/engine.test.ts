import { describe, it, expect } from 'vitest';
import {
  sellTaxFraction,
  netSellProceeds,
  breakEvenSellPrice,
  buyCost,
  runProduction,
  runRefining,
  refineBreakEvenRawPrice,
  runTransport,
  transportBreakEvenBuyPrice,
  type MarketTax,
} from './engine';
import { rrrFromBonus, focusCost, stationFee, REFINE_RECIPES, TAX_PRESETS } from './data';

/* ============================================================
   Hand-computed scenarios. Every expected value below was
   computed with plain arithmetic on paper (and mirrored in the
   worked examples printed on the tool pages).
   ============================================================ */

const STANDARD: MarketTax = { setupFeePct: 2.5, salesTaxPct: 4 };
const PREMIUM: MarketTax = { setupFeePct: 2.5, salesTaxPct: 2 };

describe('market tax helpers', () => {
  it('instant selling pays only the sales tax', () => {
    // 4% of 10,000 = 400 lost → 9,600 kept
    expect(sellTaxFraction(STANDARD, 'instant')).toBeCloseTo(0.04, 10);
    expect(netSellProceeds(10_000, 1, STANDARD, 'instant')).toBe(9_600);
  });

  it('sell orders add the non-refundable setup fee', () => {
    // 4% + 2.5% = 6.5% → 10,000 × 0.935 = 9,350
    expect(sellTaxFraction(STANDARD, 'order')).toBeCloseTo(0.065, 10);
    expect(netSellProceeds(10_000, 1, STANDARD, 'order')).toBe(9_350);
  });

  it('premium halves the sales tax but not the setup fee', () => {
    expect(sellTaxFraction(PREMIUM, 'instant')).toBeCloseTo(0.02, 10);
    expect(sellTaxFraction(PREMIUM, 'order')).toBeCloseTo(0.045, 10);
    // 10,000 × (1 − 0.045) = 9,550
    expect(netSellProceeds(10_000, 1, PREMIUM, 'order')).toBe(9_550);
  });

  it('buy orders pay the setup fee on top of the price', () => {
    // 1,000 × 1.025 = 1,025
    expect(buyCost(1_000, 1, STANDARD, true)).toBe(1_025);
    expect(buyCost(1_000, 1, STANDARD, false)).toBe(1_000);
  });

  it('break-even sell price covers the net cost after tax', () => {
    // 96,000 / (100 × 0.96) = 1,000
    expect(breakEvenSellPrice(96_000, 100, STANDARD, 'instant')).toBe(1_000);
  });

  it('tax presets match the documented structure', () => {
    expect(TAX_PRESETS.standard.tax).toEqual({ setupFeePct: 2.5, salesTaxPct: 4 });
    expect(TAX_PRESETS.premium.tax).toEqual({ setupFeePct: 2.5, salesTaxPct: 2 });
  });
});

describe('refining - T5 metal bars in Thetford (bonus city)', () => {
  // Recipe: 3 × T5 ore + 1 × T4 bar → 1 × T5 bar. RRR 36.7 %, reuse returns.
  // Hand math:
  //   net raw per bar   = 3 × 0.633 = 1.899  → 100 bars = 189.9 ore = 91,152 silver
  //   net lower per bar = 1 × 0.633 = 0.633  → 100 bars = 63.3 bars = 69,630 silver
  //   invested = 160,782 · revenue = 100 × 4,200 × 0.96 = 403,200
  //   profit   = 242,418 · break-even sell = 160,782 / 96 = 1,674.8125
  const params = {
    tier: 5,
    resourceKey: 'metal',
    numberOfCrafts: 100,
    rawPrice: 480,
    lowerPrice: 1_100,
    refinedSellPrice: 4_200,
    rrr: 0.367,
    returnMode: 'reuse' as const,
    rawSellPrice: 480,
    lowerSellPrice: 1_100,
    usageFeePerCraft: 0,
    focusPerCraft: 0,
    tax: STANDARD,
    sellMode: 'instant' as const,
    rawPer: 3,
    lowerPer: 1,
  };

  it('computes net material cost from the return rate', () => {
    const r = runRefining(params);
    expect(r.lines[0].netQty).toBeCloseTo(189.9, 6);
    expect(r.lines[1].netQty).toBeCloseTo(63.3, 6);
    expect(r.netInputCost).toBeCloseTo(160_782, 6);
  });

  it('computes profit, margin and break-even sell price', () => {
    const r = runRefining(params);
    expect(r.proceeds).toBe(403_200);
    expect(r.profit).toBeCloseTo(242_418, 6);
    expect(r.profitPerItem).toBeCloseTo(2_424.18, 6);
    expect(r.marginPct).toBeCloseTo(150.7743, 3);
    expect(r.breakEvenSell).toBeCloseTo(1_674.8125, 6);
  });

  it('computes the break-even raw price', () => {
    // (403,200 − 63.3 × 1,100 − 0) / 189.9 = 333,570 / 189.9 = 1,756.5561
    expect(refineBreakEvenRawPrice(params)).toBeCloseTo(1_756.5561, 3);
  });

  it('accounts for focus and reports profit per focus', () => {
    // Same craft with focus: RRR 53.9 % → net factor 0.461
    //   raw net = 138.3 × 480 = 66,384 · lower net = 46.1 × 1,100 = 50,710
    //   invested = 117,094 · profit = 286,106 · focus used = 100 × 94 = 9,400
    const r = runRefining({ ...params, rrr: 0.539, focusPerCraft: 94 });
    expect(r.netInputCost).toBeCloseTo(117_094, 6);
    expect(r.profit).toBeCloseTo(286_106, 6);
    expect(r.focusUsed).toBe(9_400);
    expect(r.profitPerFocus).toBeCloseTo(286_106 / 9_400, 6);
  });

  it('sell-returns mode prices returned materials after sales tax', () => {
    // returned raw = 110.1 × 480 × 0.96 = 50,734.08
    // returned lower = 36.7 × 1,100 × 0.96 = 38,755.20
    // gross cost = 300×480 + 100×1,100 = 254,000
    // profit = 403,200 + 89,489.28 − 254,000 = 238,689.28
    const r = runRefining({ ...params, returnMode: 'sell' });
    expect(r.returnedValue).toBeCloseTo(89_489.28, 6);
    expect(r.grossInputCost).toBe(254_000);
    expect(r.profit).toBeCloseTo(238_689.28, 6);
  });

  it('uses the verified recipe table', () => {
    expect(REFINE_RECIPES[4]).toEqual({ tier: 4, raw: 2, lower: 1, focus: 54 });
    expect(REFINE_RECIPES[5]).toEqual({ tier: 5, raw: 3, lower: 1, focus: 94 });
    expect(REFINE_RECIPES[8]).toEqual({ tier: 8, raw: 5, lower: 1, focus: 503 });
    expect(REFINE_RECIPES[2].lower).toBe(0);
  });
});

describe('crafting - artifact jacket batch', () => {
  // 16 × T5 leather @4,200 + 1 × artifact @90,000, RRR 24.81 %, fee 1,200,
  // 10 crafts, sell 180,000 instant, no Premium. Hand math:
  //   gross/craft = 157,200 → net/craft = 157,200 × 0.7519 = 118,198.68
  //   invested = 10 × (118,198.68 + 1,200) = 1,193,986.8
  //   revenue = 10 × 180,000 × 0.96 = 1,728,000
  //   profit = 534,013.2 → 53,401.32 per craft, margin 44.7219 %
  //   break-even sell = 1,193,986.8 / (10 × 0.96) = 124,373.625
  const result = runProduction({
    materials: [
      { name: 'T5 leather', qty: 16, unitCost: 4_200, returnable: true },
      { name: 'Artifact', qty: 1, unitCost: 90_000, returnable: true },
    ],
    outputsPerCraft: 1,
    numberOfCrafts: 10,
    rrr: 0.2481,
    returnMode: 'reuse',
    usageFeePerCraft: 1_200,
    sellPrice: 180_000,
    tax: STANDARD,
    sellMode: 'instant',
    focusPerCraft: 0,
  });

  it('nets the return rate against every material including the artifact', () => {
    expect(result.netInputCost).toBeCloseTo(1_181_986.8, 6);
    expect(result.fees).toBe(12_000);
  });

  it('computes per-craft profit, margin and break-even', () => {
    expect(result.proceeds).toBe(1_728_000);
    expect(result.profit).toBeCloseTo(534_013.2, 6);
    expect(result.profitPerItem).toBeCloseTo(53_401.32, 6);
    expect(result.marginPct).toBeCloseTo(44.7252, 3);
    expect(result.breakEvenSell).toBeCloseTo(124_373.625, 6);
  });

  it('respects per-line returnability', () => {
    const r = runProduction({
      ...{
        materials: [
          { name: 'a', qty: 1, unitCost: 10_000, returnable: true },
          { name: 'b', qty: 1, unitCost: 10_000, returnable: false },
        ],
        outputsPerCraft: 1,
        numberOfCrafts: 1,
        rrr: 0.5,
        returnMode: 'reuse',
        usageFeePerCraft: 0,
        sellPrice: 20_000,
        tax: STANDARD,
        sellMode: 'instant',
        focusPerCraft: 0,
      },
    });
    // a nets to 5,000; b stays 10,000 → 15,000
    expect(r.netInputCost).toBe(15_000);
  });
});

describe('transport - 500 bars from Martlock to Thetford', () => {
  // buy 3,900 · sell 4,800 · qty 500 · 1.6 kg each · 110 kg capacity
  // Hand math: capital 1,950,000 · proceeds 2,304,000 · weight 800 kg
  // trips = ceil(800/110) = 8 · profit 354,000 · per trip 44,250
  // margin 18.1538 % · break-even sell 4,062.5 · break-even buy 4,608
  const params = {
    buyPrice: 3_900,
    sellPrice: 4_800,
    qty: 500,
    unitWeight: 1.6,
    capacityPerTrip: 110,
    tax: STANDARD,
    sellMode: 'instant' as const,
    placeBuyOrder: false,
    costPerTrip: 0,
  };

  it('splits the load into trips and computes profit', () => {
    const r = runTransport(params);
    expect(r.totalWeight).toBeCloseTo(800, 6);
    expect(r.trips).toBe(8);
    expect(r.buyTotal).toBe(1_950_000);
    expect(r.proceeds).toBe(2_304_000);
    expect(r.profit).toBe(354_000);
    expect(r.profitPerTrip).toBe(44_250);
    expect(r.profitPer100Weight).toBeCloseTo(44_250, 6);
    expect(r.marginPct).toBeCloseTo(18.1538, 3);
  });

  it('computes break-even prices on both sides', () => {
    expect(runTransport(params).breakEvenSell).toBe(4_062.5);
    expect(transportBreakEvenBuyPrice(params)).toBe(4_608);
  });

  it('prices road costs and both order sides', () => {
    // cost per trip 10,000 × 8 trips = 80,000 → profit 274,000
    const r = runTransport({ ...params, costPerTrip: 10_000 });
    expect(r.transportCosts).toBe(80_000);
    expect(r.profit).toBe(274_000);
    // premium + buy order + sell order: buy 1,950,000×1.025 = 1,998,750
    // proceeds 2,400,000 × 0.955 = 2,292,000 → profit 293,250
    const p = runTransport({
      ...params,
      tax: PREMIUM,
      placeBuyOrder: true,
      sellMode: 'order',
    });
    expect(p.buyTotal).toBeCloseTo(1_998_750, 4);
    expect(p.proceeds).toBeCloseTo(2_292_000, 4);
    expect(p.profit).toBeCloseTo(293_250, 4);
    // break-even sell = 1,998,750 / (500 × 0.955) = 4,185.8639
    expect(p.breakEvenSell).toBeCloseTo(4_185.8639, 3);
  });
});

describe('enchanting - .0 to .1 upgrade', () => {
  // base .0 @90,000 (consumed) + 1 rune @2,500 (RRR 24.81 %) + fee 1,200
  // sell 180,000 instant, no Premium. Hand math:
  //   rune net = 2,500 × 0.7519 = 1,879.75 · invested = 93,079.75
  //   revenue = 172,800 · profit = 79,720.25
  //   break-even .X price = 93,079.75 / 0.96 = 96,958.0729
  //   premium over selling base = 172,800 − 86,400 − 1,879.75 − 1,200 = 83,320.25
  const result = runProduction({
    materials: [
      { name: 'Base (.0) item', qty: 1, unitCost: 90_000, returnable: false },
      { name: 'Runes', qty: 1, unitCost: 2_500, returnable: true },
      { name: 'Other materials', qty: 1, unitCost: 0, returnable: true },
    ],
    outputsPerCraft: 1,
    numberOfCrafts: 1,
    rrr: 0.2481,
    returnMode: 'reuse',
    usageFeePerCraft: 1_200,
    sellPrice: 180_000,
    tax: STANDARD,
    sellMode: 'instant',
    focusPerCraft: 0,
  });

  it('computes the upgrade profit and break-even', () => {
    expect(result.netInputCost).toBeCloseTo(91_879.75, 6);
    expect(result.profit).toBeCloseTo(79_720.25, 6);
    expect(result.breakEvenSell).toBeCloseTo(96_958.0729, 3);
  });

  it('premium over selling the base matches the page example', () => {
    const keepFrac = 1 - sellTaxFraction(STANDARD, 'instant');
    const premium =
      result.proceeds - 90_000 * keepFrac - (2_500 * (1 - 0.2481)) - 1_200;
    expect(premium).toBeCloseTo(83_320.25, 6);
  });
});

describe('game-data formulas', () => {
  it('converts production bonus points into return rates', () => {
    // 18/118 = 0.152542…, 58/158 = 0.367088…, 117/217 = 0.539170…
    expect(rrrFromBonus(18)).toBeCloseTo(0.1525424, 6);
    expect(rrrFromBonus(58)).toBeCloseTo(0.3670886, 6);
    expect(rrrFromBonus(117)).toBeCloseTo(0.5391705, 6);
  });

  it('halves focus cost every 10,000 efficiency', () => {
    // 1,286 × 0.5^3.1 ≈ 149.98 (the T4 broadsword example)
    expect(focusCost(1_286, 31_000)).toBeCloseTo(149.98, 0.1);
    expect(focusCost(1_000, 10_000)).toBeCloseTo(500, 10);
    expect(focusCost(1_000, 0)).toBe(1_000);
  });

  it('computes station fees from item value and rate', () => {
    // item value 384, rate 500 → 384 × 0.1125 × 5 = 216
    expect(stationFee(384, 500)).toBe(216);
    expect(stationFee(384, 1_000)).toBe(432);
  });
});
