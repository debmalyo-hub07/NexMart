import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MarketplaceFeeRule } from '../../models/MarketplaceFeeRule';
import {
  calculateMarketplaceFees,
  resolveMarketplaceFeeRule,
  UNCONFIGURED_FEE_RULE,
} from '../marketplaceFee.service';

describe('marketplace fee engine', () => {
  it('calculates every component in integer paise and excludes tax from platform revenue', () => {
    const result = calculateMarketplaceFees({
      merchandisePaise: 200_000,
      discountPaise: 10_000,
      shippingPaise: 4_900,
      taxPaise: 34_200,
      paymentMethod: 'online',
      rule: {
        ...UNCONFIGURED_FEE_RULE,
        ruleId: 'rule-v3',
        ruleKey: 'electronics',
        version: 3,
        commissionBps: 500,
        fixedFeePaise: 500,
        shippingCostPaise: 800,
        otherFeePaise: 120,
        reserveBps: 1000,
        paymentCollection: { onlineBps: 200, onlineFixedPaise: 100, codBps: 0, codFixedPaise: 0 },
        requiresProfessionalReview: false,
      },
    });

    expect(result).toMatchObject({
      adjustedMerchandisePaise: 190_000,
      customerChargePaise: 229_100,
      commissionPaise: 9_500,
      paymentCollectionFeePaise: 4_682,
      platformRevenuePaise: 10_120,
      sellerPayableBeforeHoldPaise: 179_298,
      reservePaise: 17_929,
      sellerPayableAfterHoldPaise: 161_369,
      taxPaise: 34_200,
    });
    expect(result.platformRevenuePaise).not.toBeGreaterThan(result.customerChargePaise - result.taxPaise);
  });

  it('allows a negative seller payable when configured deductions exceed the sale', () => {
    const result = calculateMarketplaceFees({
      merchandisePaise: 100,
      discountPaise: 0,
      shippingPaise: 0,
      taxPaise: 0,
      paymentMethod: 'cod',
      rule: {
        ...UNCONFIGURED_FEE_RULE,
        fixedFeePaise: 500,
        shippingCostPaise: 200,
      },
    });
    expect(result.sellerPayableBeforeHoldPaise).toBe(-600);
    expect(result.reservePaise).toBe(0);
    expect(result.sellerPayableAfterHoldPaise).toBe(-600);
  });
});

describe('active fee rule resolution', () => {
  let database: MongoMemoryServer;
  const category = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri(), { dbName: 'nexmart_fee_rule_tests' });
    await MarketplaceFeeRule.init();
  });
  beforeEach(async () => { await MarketplaceFeeRule.deleteMany({}); });
  afterAll(async () => { await mongoose.disconnect(); await database.stop(); });

  it('chooses the category-specific rule over a broad rule at the same effective time', async () => {
    const now = new Date(Date.now() - 1000);
    await MarketplaceFeeRule.create([
      {
        ruleId: 'broad-v1', ruleKey: 'default', version: 1, status: 'active', effectiveFrom: now,
        commissionBps: 100, fixedFeePaise: 0, shippingCostPaise: 0, otherFeePaise: 0, reserveBps: 0,
        paymentCollection: { onlineBps: 0, onlineFixedPaise: 0, codBps: 0, codFixedPaise: 0 }, returnFeePaise: 0,
      },
      {
        ruleId: 'category-v2', ruleKey: 'electronics', version: 2, status: 'active', effectiveFrom: now,
        category, commissionBps: 900, fixedFeePaise: 0, shippingCostPaise: 0, otherFeePaise: 0, reserveBps: 0,
        paymentCollection: { onlineBps: 0, onlineFixedPaise: 0, codBps: 0, codFixedPaise: 0 }, returnFeePaise: 0,
      },
    ]);
    const rule = await resolveMarketplaceFeeRule({ category });
    expect(rule.ruleId).toBe('category-v2');
    expect(rule.commissionBps).toBe(900);
  });

  it('returns an explicit unconfigured rule when no active rule exists', async () => {
    const rule = await resolveMarketplaceFeeRule({ category });
    expect(rule.ruleId).toBe('unconfigured');
    expect(rule.requiresProfessionalReview).toBe(true);
  });
});
