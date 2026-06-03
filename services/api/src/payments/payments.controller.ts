import { Controller, Post, Headers, Req, Res, ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ChargilyService } from './chargily/chargily.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly chargily: ChargilyService) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    if (!this.chargily.verifySignature(signature, rawBody)) {
      return res.status(403).send('Invalid signature');
    }
    
    // Process webhook logic here
    console.log('Valid Chargily webhook received');
    return res.status(200).send('OK');
  }
}
