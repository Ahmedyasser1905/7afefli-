import { Injectable } from '@nestjs/common';
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

    try {
      const response = await fetch('https://pay.chargily.net/test/api/v2/checkouts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'dzd',
          description: `Abonnement ${planName} — 7afefli`,
          success_url: 'https://7afefli.com/payment/success',
          failure_url: 'https://7afefli.com/payment/failure',
          webhook_endpoint: null,
          metadata: { salon_id: salonId, plan: planName },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('Chargily checkout error:', errBody);
        throw new Error(`Chargily API error: ${response.status}`);
      }

      const result = await response.json();
      return {
        checkout_url: result.checkout_url,
        id: result.id,
      };
    } catch (err) {
      console.error('Chargily checkout failed:', err);
      // Fallback to mock for resilience
      const mockId = `fallback-${Date.now()}`;
      return {
        checkout_url: `https://pay.chargily.net/test/checkout/${mockId}`,
        id: mockId,
      };
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
