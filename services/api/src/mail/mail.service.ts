import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY est introuvable. Les e-mails ne seront pas réellement envoyés.');
    }
  }

  async sendPasswordResetOtp(email: string, otp: string) {
    if (!this.resend) {
      this.logger.log(`[SIMULÉ - Pas de clé Resend] Envoi du code OTP ${otp} à l'adresse ${email}`);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        // TODO: Replace with the client's actual verified domain or testing email
        from: 'BarberDZ <onboarding@resend.dev>',
        to: email,
        subject: 'Votre code de réinitialisation de mot de passe',
        html: `
          <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
            <h2>BarberDZ / 7afefli</h2>
            <p>Bonjour,</p>
            <p>Voici votre code de réinitialisation à 6 chiffres :</p>
            <h1 style="color: #E8A020; font-size: 32px; letter-spacing: 4px;">${otp}</h1>
            <p>Ce code expirera dans 10 minutes.</p>
            <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.</p>
          </div>
        `,
      });

      if (error) {
        this.logger.error(`Erreur d'envoi de l'e-mail avec Resend: ${error.message}`);
      } else {
        this.logger.log(`E-mail OTP envoyé avec succès à ${email}`);
      }
    } catch (err: unknown) {
      this.logger.error(`Erreur inattendue lors de l'envoi de l'e-mail: ${(err as Error).message}`);
    }
  }
}
