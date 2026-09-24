import { randomToken } from '../auth/crypto.js';

export type PaymentMethod = 'DEMO_PAYMENT' | 'VNPAY' | 'MOMO' | 'QR_BANKING';

export interface PaymentVerification {
  providerReference: string;
  verifiedAt: Date;
}

export interface PaymentVerifyInput {
  orderId: string;
  totalVnd: number;
}

export interface PaymentProvider {
  readonly method: PaymentMethod;
  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerification>;
}

export const demoPaymentProvider: PaymentProvider = {
  method: 'DEMO_PAYMENT',
  async verifyPayment({ orderId }): Promise<PaymentVerification> {    return { providerReference: `DEMO-${orderId.slice(0, 8)}-${randomToken(8).toUpperCase()}`, verifiedAt: new Date() };
  },
};

export const paymentProviders = new Map<PaymentMethod, PaymentProvider>([
  ['DEMO_PAYMENT', demoPaymentProvider],
]);

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  const provider = paymentProviders.get(method);
  if (!provider) {
    throw new Error(`No payment provider registered for method: ${method}`);
  }
  return provider;
}
