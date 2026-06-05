import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Génère un code OTP aléatoire à 6 chiffres
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 1. Send Code
   * Vérifie l'e-mail, génère un OTP, le sauvegarde et "l'envoie".
   */
  async sendCode(email: string): Promise<void> {
    const emailLower = email.toLowerCase().trim();

    // Vérifier si l'utilisateur existe dans auth.users
    const { data: users, error: userError } = await this.supabase.adminClient.auth.admin.listUsers();
    if (userError) {
      this.logger.error(`Erreur lors de la récupération des utilisateurs: ${userError.message}`);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }

    const user = users.users.find((u) => u.email?.toLowerCase() === emailLower);

    if (!user) {
      // Pour des raisons de sécurité, on ne révèle pas que l'e-mail n'existe pas.
      this.logger.warn(`Demande de reset pour un e-mail inexistant: ${emailLower}`);
      return;
    }

    // Invalider les anciens codes non vérifiés pour cet utilisateur
    await this.supabase.adminClient
      .from('password_reset_codes')
      .delete()
      .eq('user_id', user.id)
      .eq('verified', false);

    // Générer OTP
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes d'expiration

    // Enregistrer en base
    const { error: insertError } = await this.supabase.adminClient
      .from('password_reset_codes')
      .insert({
        user_id: user.id,
        email: emailLower,
        code: otp,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      this.logger.error(`Erreur d'insertion du code OTP pour ${emailLower}: ${insertError.message}`);
      throw new InternalServerErrorException('Impossible de générer le code de réinitialisation');
    }

    // "Envoi" de l'e-mail via Resend (ou simulation si clé manquante)
    await this.mailService.sendPasswordResetOtp(emailLower, otp);
  }

  /**
   * 2. Verify Code
   * Vérifie si le code est correct et non expiré.
   */
  async verifyCode(email: string, code: string): Promise<void> {
    const emailLower = email.toLowerCase().trim();

    // Récupérer le code actif
    const { data: resetRecord, error } = await this.supabase.adminClient
      .from('password_reset_codes')
      .select('*')
      .eq('email', emailLower)
      .eq('code', code)
      .maybeSingle();

    if (error || !resetRecord) {
      // Pour masquer la distinction entre e-mail inexistant et mauvais code
      throw new BadRequestException('Code OTP invalide ou expiré');
    }

    // Incrémenter les tentatives (limite à 5)
    if (resetRecord.attempts >= 5) {
      await this.supabase.adminClient.from('password_reset_codes').delete().eq('id', resetRecord.id);
      throw new BadRequestException('Trop de tentatives. Veuillez demander un nouveau code.');
    }

    await this.supabase.adminClient
      .from('password_reset_codes')
      .update({ attempts: resetRecord.attempts + 1 })
      .eq('id', resetRecord.id);

    // Vérifier l'expiration
    if (new Date(resetRecord.expires_at) < new Date()) {
      throw new BadRequestException('Ce code OTP a expiré');
    }

    // Marquer comme vérifié
    await this.supabase.adminClient
      .from('password_reset_codes')
      .update({ verified: true })
      .eq('id', resetRecord.id);
  }

  /**
   * 3. Reset Password
   * Change le mot de passe si l'OTP est préalablement validé.
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const emailLower = email.toLowerCase().trim();

    // Vérifier que le code existe et a été validé
    const { data: resetRecord, error } = await this.supabase.adminClient
      .from('password_reset_codes')
      .select('*')
      .eq('email', emailLower)
      .eq('code', code)
      .eq('verified', true)
      .maybeSingle();

    if (error || !resetRecord) {
      throw new BadRequestException('Demande de réinitialisation invalide ou non autorisée');
    }

    // Changer le mot de passe via l'Admin API de Supabase
    const { error: updateError } = await this.supabase.adminClient.auth.admin.updateUserById(
      resetRecord.user_id,
      { password: newPassword },
    );

    if (updateError) {
      this.logger.error(`Erreur de mise à jour du mot de passe pour ${resetRecord.user_id}: ${updateError.message}`);
      throw new InternalServerErrorException('Impossible de mettre à jour le mot de passe');
    }

    // Nettoyer : Supprimer le code utilisé
    await this.supabase.adminClient
      .from('password_reset_codes')
      .delete()
      .eq('id', resetRecord.id);
      
    this.logger.log(`Mot de passe réinitialisé avec succès pour l'utilisateur ${resetRecord.user_id}`);
  }

  /**
   * Tâche planifiée : Nettoyage automatique des OTP expirés depuis plus d'une heure.
   * S'exécute toutes les heures.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCronCleanup() {
    this.logger.debug('Exécution de la tâche de nettoyage des OTP expirés...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { error } = await this.supabase.adminClient
      .from('password_reset_codes')
      .delete()
      .lt('expires_at', oneHourAgo);

    if (error) {
      this.logger.error(`Erreur lors du nettoyage des OTP: ${error.message}`);
    } else {
      this.logger.debug('Nettoyage des OTP expiré terminé avec succès.');
    }
  }
}
