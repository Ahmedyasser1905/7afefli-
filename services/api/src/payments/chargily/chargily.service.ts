import { Injectable, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ChargilyService {
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('CHARGILY_SECRET_KEY') || '';
  }

  /**
   * Create a Chargily Pay checkout session.
   * If no API key is configured, returns a mock URL for development.
   */
  async createCheckoutUrl(
    amount: number,
    salonId: string,
    planName: string,
  ): Promise<{ checkout_url: string; id: string }> {
    if (!this.secretKey) {
      console.warn('CHARGILY_SECRET_KEY not set — returning mock checkout URL.');
      const mockId = `mock-${Date.now()}`;
      return {
        checkout_url: `https://pay.chargily.net/test/checkout/${mockId}`,
        id: mockId,
      };
    }

    // Detect mode from the key prefix — this is more reliable than NODE_ENV
    // because a test key must always hit the test endpoint, even in production.
    const isLiveKey = this.secretKey.startsWith('live_sk_');
    const chargilyBase = isLiveKey
      ? 'https://pay.chargily.net/api/v2'
      : 'https://pay.chargily.net/test/api/v2';

    try {
      const response = await fetch(`${chargilyBase}/checkouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'dzd',
          description: `Abonnement ${planName} — 7afefli`,
          success_url: process.env.PAYMENT_SUCCESS_URL || 'hafefli://payment/success',
          failure_url: process.env.PAYMENT_FAILURE_URL || 'hafefli://payment/failure',
          // MEDIUM-2: Use per-checkout webhook override for reliability.
          // Set CHARGILY_WEBHOOK_URL to your deployed API URL + /api/v1/payments/webhook
          webhook_endpoint: process.env.CHARGILY_WEBHOOK_URL || null,
          metadata: { salon_id: salonId, plan: planName },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Chargily checkout error [${response.status}]:`, errBody);
        throw new BadGatewayException(
          `Chargily API error ${response.status}: ${errBody}`,
        );
      }

      const result = await response.json();
      return {
        checkout_url: result.checkout_url,
        id: result.id,
      };
    } catch (err) {
      // Re-throw NestJS HTTP exceptions as-is (e.g. BadGatewayException from the
      // !response.ok branch above) so they are not wrapped into a second exception.
      if (err instanceof BadGatewayException) {
        throw err;
      }
      const message = (err as Error).message || 'Unknown error';
      console.error('Chargily checkout failed:', message);
      // Throw a 502 Bad Gateway so NestJS returns a clean error to the caller
      // instead of an opaque 500 Internal Server Error.
      throw new BadGatewayException(
        `Payment gateway unavailable — please try again later. (${message})`,
      );
    }
  }

  /**
   * Verify Chargily webhook signature using HMAC-SHA256.
   */
  verifySignature(signature: string, payload: string): boolean {
    if (!this.secretKey) {
      console.error('CRITICAL: CHARGILY_SECRET_KEY is not set. Rejecting webhook.');
      return false;
    }
    const computedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');
    return computedSignature === signature;
  }
}
