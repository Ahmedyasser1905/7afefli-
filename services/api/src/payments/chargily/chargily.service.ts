import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ChargilyService {
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('CHARGILY_SECRET_KEY') || '';
  }

  async createCheckout(amount: number, salonId: string): Promise<string> {
    if (!this.secretKey) {
      console.warn('CHARGILY_SECRET_KEY not set. Simulating checkout url.');
      return `https://checkout.chargily.com/test-checkout-${Date.now()}`;
    }
    return `https://checkout.chargily.com/live-checkout-${Date.now()}`;
  }

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
