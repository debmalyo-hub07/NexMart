import mongoose, { ClientSession, Types } from 'mongoose';
import { MarketplaceFeeRule, type IMarketplaceFeeRule, type IPaymentCollectionFeeRule } from '../models/MarketplaceFeeRule';

export interface FeeRuleSnapshot {
  ruleId: string;
  ruleKey: string;
  version: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  commissionBps: number;
  fixedFeePaise: number;
  shippingCostPaise: number;
  otherFeePaise: number;
  reserveBps: number;
  paymentCollection: IPaymentCollectionFeeRule;
  returnFeePaise: number;
  requiresProfessionalReview: boolean;
}

export interface MarketplaceFeeInput {
  merchandisePaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  paymentMethod: 'online' | 'cod';
  rule: FeeRuleSnapshot;
}

export interface MarketplaceFeeCalculation {
  merchandisePaise: number;
  discountPaise: number;
  adjustedMerchandisePaise: number;
  shippingPaise: number;
  taxPaise: number;
  customerChargePaise: number;
  commissionPaise: number;
  fixedFeePaise: number;
  paymentCollectionFeePaise: number;
  shippingCostPaise: number;
  otherFeePaise: number;
  platformRevenuePaise: number;
  sellerPayableBeforeHoldPaise: number;
  reservePaise: number;
  sellerPayableAfterHoldPaise: number;
  ruleId: string;
  ruleKey: string;
  ruleVersion: number;
  requiresProfessionalReview: boolean;
}

/**
 * No business fee is silently invented when the admin has not configured a
 * rule yet. The snapshot still records that the rule is unconfigured so a
 * later settlement process can require an explicit business decision.
 */
export const UNCONFIGURED_FEE_RULE: FeeRuleSnapshot = {
  ruleId: 'unconfigured',
  ruleKey: 'default',
  version: 0,
  effectiveFrom: new Date(0),
  commissionBps: 0,
  fixedFeePaise: 0,
  shippingCostPaise: 0,
  otherFeePaise: 0,
  reserveBps: 0,
  paymentCollection: { onlineBps: 0, onlineFixedPaise: 0, codBps: 0, codFixedPaise: 0 },
  returnFeePaise: 0,
  requiresProfessionalReview: true,
};

function asOptionalObjectId(value?: Types.ObjectId | string): Types.ObjectId | undefined {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) return value;
  return mongoose.isValidObjectId(value) ? new Types.ObjectId(value) : undefined;
}

function normalizeRule(rule: IMarketplaceFeeRule): FeeRuleSnapshot {
  return {
    ruleId: rule.ruleId,
    ruleKey: rule.ruleKey,
    version: rule.version,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    commissionBps: rule.commissionBps,
    fixedFeePaise: rule.fixedFeePaise,
    shippingCostPaise: rule.shippingCostPaise,
    otherFeePaise: rule.otherFeePaise,
    reserveBps: rule.reserveBps,
    paymentCollection: {
      onlineBps: rule.paymentCollection.onlineBps,
      onlineFixedPaise: rule.paymentCollection.onlineFixedPaise,
      codBps: rule.paymentCollection.codBps,
      codFixedPaise: rule.paymentCollection.codFixedPaise,
    },
    returnFeePaise: rule.returnFeePaise,
    requiresProfessionalReview: rule.requiresProfessionalReview,
  };
}

/** Resolve the most specific active rule for a purchase-time snapshot. */
export async function resolveMarketplaceFeeRule(input: {
  category?: Types.ObjectId | string;
  fulfillmentMode?: 'seller' | 'nexmart';
  at?: Date;
  session?: ClientSession;
}): Promise<FeeRuleSnapshot> {
  const at = input.at || new Date();
  const category = asOptionalObjectId(input.category);
  const query = MarketplaceFeeRule.find({
    status: 'active',
    effectiveFrom: { $lte: at },
    $and: [
      category
        ? { $or: [{ category }, { category: null }, { category: { $exists: false } }] }
        : { $or: [{ category: null }, { category: { $exists: false } }] },
      input.fulfillmentMode
        ? { $or: [{ fulfillmentMode: input.fulfillmentMode }, { fulfillmentMode: null }, { fulfillmentMode: { $exists: false } }] }
        : { $or: [{ fulfillmentMode: null }, { fulfillmentMode: { $exists: false } }] },
      { $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gt: at } }] },
    ],
  }).sort({ effectiveFrom: -1, version: -1 }).limit(25);
  if (input.session) query.session(input.session);
  const candidates = await query.lean();
  if (candidates.length === 0) return { ...UNCONFIGURED_FEE_RULE, effectiveFrom: new Date(at) };

  // The query admits broader rules so MongoDB can use its indexes. Pick the
  // most specific match in application code, then prefer the newest version.
  candidates.sort((left, right) => {
    const specificity = (rule: typeof left) => (rule.category ? 2 : 0) + (rule.fulfillmentMode ? 1 : 0);
    return specificity(right) - specificity(left)
      || right.effectiveFrom.getTime() - left.effectiveFrom.getTime()
      || right.version - left.version;
  });
  return normalizeRule(candidates[0] as unknown as IMarketplaceFeeRule);
}

function assertMinorUnit(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer minor-unit amount.`);
}

function percentage(amountPaise: number, basisPoints: number): number {
  return Math.floor((amountPaise * basisPoints) / 10_000);
}

/** Pure, deterministic fee calculation.
 *
 * PRICING IS TAX-INCLUSIVE (audit 2026-09-22 §C2): `taxPaise` is the GST
 * **contained** inside `merchandisePaise`, not an amount added on top. The
 * customer's actual charge is merchandise + shipping; the contained tax is
 * credited to `tax_payable` and withheld from seller payable (the seller must
 * remit it), so the capture ledger still balances exactly. */
export function calculateMarketplaceFees(input: MarketplaceFeeInput): MarketplaceFeeCalculation {
  assertMinorUnit(input.merchandisePaise, 'merchandisePaise');
  assertMinorUnit(input.discountPaise, 'discountPaise');
  assertMinorUnit(input.shippingPaise, 'shippingPaise');
  assertMinorUnit(input.taxPaise, 'taxPaise');
  if (input.discountPaise > input.merchandisePaise) throw new Error('discountPaise cannot exceed merchandisePaise.');

  const rule = input.rule;
  const adjustedMerchandisePaise = input.merchandisePaise - input.discountPaise;
  const customerChargePaise = adjustedMerchandisePaise + input.shippingPaise;
  const paymentBps = input.paymentMethod === 'online' ? rule.paymentCollection.onlineBps : rule.paymentCollection.codBps;
  const paymentFixed = input.paymentMethod === 'online' ? rule.paymentCollection.onlineFixedPaise : rule.paymentCollection.codFixedPaise;
  const commissionPaise = percentage(adjustedMerchandisePaise, rule.commissionBps);
  const paymentCollectionFeePaise = percentage(customerChargePaise, paymentBps) + paymentFixed;
  const platformRevenuePaise = commissionPaise + rule.fixedFeePaise + rule.otherFeePaise;
  const sellerPayableBeforeHoldPaise = adjustedMerchandisePaise - input.taxPaise + input.shippingPaise
    - commissionPaise - rule.fixedFeePaise - paymentCollectionFeePaise
    - rule.shippingCostPaise - rule.otherFeePaise;
  const reservePaise = sellerPayableBeforeHoldPaise > 0
    ? percentage(sellerPayableBeforeHoldPaise, rule.reserveBps)
    : 0;

  return {
    merchandisePaise: input.merchandisePaise,
    discountPaise: input.discountPaise,
    adjustedMerchandisePaise,
    shippingPaise: input.shippingPaise,
    taxPaise: input.taxPaise,
    customerChargePaise,
    commissionPaise,
    fixedFeePaise: rule.fixedFeePaise,
    paymentCollectionFeePaise,
    shippingCostPaise: rule.shippingCostPaise,
    otherFeePaise: rule.otherFeePaise,
    platformRevenuePaise,
    sellerPayableBeforeHoldPaise,
    reservePaise,
    sellerPayableAfterHoldPaise: sellerPayableBeforeHoldPaise - reservePaise,
    ruleId: rule.ruleId,
    ruleKey: rule.ruleKey,
    ruleVersion: rule.version,
    requiresProfessionalReview: rule.requiresProfessionalReview,
  };
}

export function feeSnapshotFromCalculation(rule: FeeRuleSnapshot, calculation: MarketplaceFeeCalculation): Record<string, unknown> {
  return {
    ruleId: rule.ruleId,
    ruleKey: rule.ruleKey,
    ruleVersion: rule.version,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    requiresProfessionalReview: rule.requiresProfessionalReview,
    merchandisePaise: calculation.merchandisePaise,
    discountPaise: calculation.discountPaise,
    adjustedMerchandisePaise: calculation.adjustedMerchandisePaise,
    shippingPaise: calculation.shippingPaise,
    taxPaise: calculation.taxPaise,
    customerChargePaise: calculation.customerChargePaise,
    commissionPaise: calculation.commissionPaise,
    fixedFeePaise: calculation.fixedFeePaise,
    paymentCollectionFeePaise: calculation.paymentCollectionFeePaise,
    shippingCostPaise: calculation.shippingCostPaise,
    otherFeePaise: calculation.otherFeePaise,
    platformRevenuePaise: calculation.platformRevenuePaise,
    sellerPayableBeforeHoldPaise: calculation.sellerPayableBeforeHoldPaise,
    reservePaise: calculation.reservePaise,
    sellerPayableAfterHoldPaise: calculation.sellerPayableAfterHoldPaise,
  };
}
