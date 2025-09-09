import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { LagoService } from 'src/shared/services/lago.service';
import { PrismaService } from 'src/shared/services/prisma.service';
import { BillingProducer } from 'src/kafka/producers/billing.producer';
import { BuyType } from './dto/buy-barcodes.dto';
import { RedisService } from 'src/shared/services/redis.service';

describe('BillingService', () => {
  let service: BillingService;

  // ---- Mocks ----
  const prisma = {
    $transaction: jest.fn(),
    account: { findUnique: jest.fn() },
    product: { findFirst: jest.fn(), findUnique: jest.fn() },
    getBarcodePackages: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  const lago = {
    topUpWallet: jest.fn(),
    subscriptionPlan: jest.fn(),
    getCredits: jest.fn(),
    checkCoupon: jest.fn(),
    checkPlan: jest.fn(),
  } as unknown as jest.Mocked<LagoService>;

  const producer = {
    purchaseSuccess: jest.fn(),
  } as unknown as jest.Mocked<BillingProducer>;

  const redis = {
    getProductById: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(
      prisma as any,
      lago as any,
      producer as any,
      redis as any,
    );
  });

  // ---------- buyBarcodes ----------
  it('buyBarcodes: SINGLE — успех', async () => {
    const data = { userId: 'u1', index: 0, type: BuyType.SINGLE } as any;

    (prisma.$transaction as any).mockResolvedValue([
      { userId: 'u1' }, // account
      { id: 'p1' }, // product
    ]);
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [
        { credits: 10, price: 5 },
        { credits: 25, price: 10 },
      ],
    });

    await expect(service.buyBarcodes(data)).resolves.toEqual({
      message: 'Successfully initialized barcodes buy',
    });

    expect(lago.topUpWallet).toHaveBeenCalledWith(10, { userId: 'u1' });
    expect(producer.purchaseSuccess).toHaveBeenCalledWith({
      userId: 'u1',
      credits: 10,
      price: 5,
    });
  });

  it('buyBarcodes: PACKAGE — успех с index', async () => {
    const data = { userId: 'u2', index: 1, type: BuyType.PACKAGE } as any;

    (prisma.$transaction as any).mockResolvedValue([
      { userId: 'u2' },
      { id: 'p1' },
    ]);
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [
        { credits: 10, price: 5 },
        { credits: 50, price: 20 },
      ],
    });

    await service.buyBarcodes(data);

    expect(lago.topUpWallet).toHaveBeenCalledWith(50, { userId: 'u2' });
    expect(producer.purchaseSuccess).toHaveBeenCalledWith({
      userId: 'u2',
      credits: 50,
      price: 20,
    });
  });

  it('buyBarcodes: SUBSCRIPTION — успех', async () => {
    const data = {
      userId: 'u3',
      index: 0,
      type: 'SUBSCRIPTION',
      code: 'plan_basic',
    } as any;

    (prisma.$transaction as any).mockResolvedValue([
      { userId: 'u3' },
      { id: 'p1' },
    ]);
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ credits: 10, price: 5 }],
    });
    (lago.subscriptionPlan as any).mockResolvedValue({ id: 'sub_123' });

    await service.buyBarcodes(data);

    expect(lago.subscriptionPlan).toHaveBeenCalledWith('plan_basic', {
      userId: 'u3',
    });
    expect(producer.purchaseSuccess).toHaveBeenCalledWith({
      userId: 'u3',
      credits: null,
      price: null,
      subscription: { id: 'sub_123' },
    });
  });

  it('buyBarcodes: product not found -> HttpException(500) бросается', async () => {
    const data = { userId: 'u1', index: 0, type: BuyType.SINGLE } as any;

    (prisma.$transaction as any).mockResolvedValue([{ userId: 'u1' }, null]);
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ credits: 10, price: 5 }],
    });

    await expect(service.buyBarcodes(data)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('buyBarcodes: invalid index -> 400', async () => {
    const data = { userId: 'u1', index: 10, type: BuyType.PACKAGE } as any;

    (prisma.$transaction as any).mockResolvedValue([
      { userId: 'u1' },
      { id: 'p1' },
    ]);
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ credits: 10, price: 5 }],
    });

    await expect(service.buyBarcodes(data)).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(service.buyBarcodes(data)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('buyBarcodes: account not found -> 404', async () => {
    const data = { userId: 'u404', index: 0, type: BuyType.SINGLE } as any;

    (prisma.$transaction as any).mockResolvedValue([null, { id: 'p1' }]);
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ credits: 10, price: 5 }],
    });

    await expect(service.buyBarcodes(data)).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(service.buyBarcodes(data)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('buyBarcodes: non-Http error -> 500', async () => {
    const data = { userId: 'u1', index: 0, type: BuyType.SINGLE } as any;

    (prisma.$transaction as any).mockRejectedValue(new Error('boom'));

    await expect(service.buyBarcodes(data)).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(service.buyBarcodes(data)).rejects.toMatchObject({
      status: 500,
    });
  });

  // ---------- checkCredits ----------
  it('checkCredits: success', async () => {
    (prisma.account.findUnique as any).mockResolvedValue({ userId: 'u1' });
    (lago.getCredits as any).mockResolvedValue({ balance: 123 });

    await expect(service.checkCredits('u1')).resolves.toEqual({ balance: 123 });
    expect(lago.getCredits).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('checkCredits: account not found -> 404', async () => {
    (prisma.account.findUnique as any).mockResolvedValue(null);

    await expect(service.checkCredits('u404')).rejects.toBeInstanceOf(
      HttpException,
    );
    await expect(service.checkCredits('u404')).rejects.toMatchObject({
      status: 404,
    });
  });

  // ---------- checkCoupon ----------
  it('checkCoupon: delegates to lago', async () => {
    (lago.checkCoupon as any).mockResolvedValue({ coupon: { code: 'SAVE10' } });

    await expect(service.checkCoupon('SAVE10')).resolves.toEqual({
      coupon: { code: 'SAVE10' },
    });
    expect(lago.checkCoupon).toHaveBeenCalledWith('SAVE10');
  });

  // ---------- calculatePrice ----------
  it('calculatePrice: only packageIndex', async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ price: 5 }, { price: 20 }],
    });

    const res = await service.calculatePrice({
      productId: 'p1',
      packageIndex: 1,
    } as any);
    expect(res).toEqual({ totalPrice: 20, basePrice: 20, coupon: null });
  });

  it('calculatePrice: planCode adds amount', async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: 'p1' });
    (lago.checkPlan as any).mockResolvedValue({ plan: { amountCents: 999 } });

    const res = await service.calculatePrice({
      productId: 'p1',
      planCode: 'pro',
    } as any);
    expect(res).toEqual({ totalPrice: 9.99, basePrice: 9.99, coupon: null });
  });

  it('calculatePrice: fixed coupon clamps to zero', async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ price: 10 }],
    });
    (lago.checkCoupon as any).mockResolvedValue({
      coupon: { type: 'fixed_amount', amountCents: 1500 },
    });

    const res = await service.calculatePrice({
      productId: 'p1',
      packageIndex: 0,
      couponCode: 'FREE',
    } as any);

    expect(res.totalPrice).toBe(0);
    expect(res.basePrice).toBe(10);
    expect(res.coupon).toEqual({ type: 'fixed_amount', amountCents: 1500 });
  });

  it('calculatePrice: percentage coupon', async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ price: 100 }],
    });
    (lago.checkCoupon as any).mockResolvedValue({
      coupon: { type: 'percentage', percentageRate: '25' },
    });

    const res = await service.calculatePrice({
      productId: 'p1',
      packageIndex: 0,
      couponCode: 'OFF25',
    } as any);

    expect(res.totalPrice).toBeCloseTo(75);
    expect(res.basePrice).toBe(100);
  });

  it('calculatePrice: invalid packageIndex -> 400', async () => {
    (prisma.product.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.getBarcodePackages as any).mockResolvedValue({
      packages: [{ price: 10 }],
    });

    await expect(
      service.calculatePrice({ productId: 'p1', packageIndex: 2 } as any),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('calculatePrice: product not found -> 404', async () => {
    (prisma.product.findUnique as any).mockResolvedValue(null);

    await expect(
      service.calculatePrice({ productId: 'nope' } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('calculatePrice: non-Http error -> 500', async () => {
    (prisma.product.findUnique as any).mockRejectedValue(new Error('db down'));

    await expect(
      service.calculatePrice({ productId: 'p1' } as any),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
