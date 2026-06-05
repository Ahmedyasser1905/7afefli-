import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private resend: Resend | null = null;
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);
  private usingEthereal = false;
  private testAccount: nodemailer.TestAccount | null = null;

  async onModuleInit() {
    const resendKey = process.env.RESEND_API_KEY;
    const smtpHost = process.env.SMTP_HOST;

    if (resendKey) {
      this.resend = new Resend(resendKey);
      this.logger.log('MailService configuré avec Resend.');
    } else if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      this.logger.log('MailService configuré avec SMTP personnalisé.');
    } else {
      // Configuration de test : Ethereal Email
      this.logger.warn('Aucune configuration SMTP ou RESEND_API_KEY trouvée.');
      this.logger.warn('Génération d\'un compte de test Ethereal pour garantir l\'envoi des e-mails...');
      
      this.testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: this.testAccount.smtp.host,
        port: this.testAccount.smtp.port,
        secure: this.testAccount.smtp.secure,
        auth: {
          user: this.testAccount.user,
          pass: this.testAccount.pass,
        },
      });
      this.usingEthereal = true;
      this.logger.log('MailService configuré avec Ethereal (Test Mode).');
    }
  }

  async sendPasswordResetOtp(email: string, otp: string) {
    const subject = 'Votre code de réinitialisation de mot de passe';
    const html = `
      <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
        <h2>BarberDZ / 7afefli</h2>
        <p>Bonjour,</p>
        <p>Voici votre code de réinitialisation à 6 chiffres :</p>
        <h1 style="color: #E8A020; font-size: 32px; letter-spacing: 4px;">${otp}</h1>
        <p>Ce code expirera dans 10 minutes.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.</p>
      </div>
    `;

    try {
      if (this.resend) {
        const { error } = await this.resend.emails.send({
          from: process.env.SMTP_FROM || 'BarberDZ <onboarding@resend.dev>',
          to: email,
          subject,
          html,
        });
        if (error) throw error;
        this.logger.log(`E-mail OTP envoyé avec succès à ${email} (via Resend)`);
      } else if (this.transporter) {
        const info = await this.transporter.sendMail({
          from: process.env.SMTP_FROM || '"BarberDZ" <noreply@barberdz.com>',
          to: email,
          subject,
          html,
        });
        this.logger.log(`E-mail OTP envoyé avec succès à ${email} (via SMTP)`);
        
        if (this.usingEthereal) {
          this.logger.log(`[TEST EMAIL] Vous pouvez voir l'e-mail envoyé ici: ${nodemailer.getTestMessageUrl(info)}`);
        }
      }
    } catch (err: unknown) {
      this.logger.error(`Erreur inattendue lors de l'envoi de l'e-mail: ${(err as Error).message}`);
      throw err; // Propagate the error so the controller/service knows it failed
    }
  }
}
