/**
 * Email Service
 * Centralized email sending using Resend
 * 
 * Part of: GAP-22 Email Service
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Install: npm install resend
// import { Resend } from 'resend';

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    // private resend: Resend;
    private from: string;
    private isEnabled: boolean;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');
        this.from = this.configService.get<string>('EMAIL_FROM') || 'Rappit <noreply@rappit.app>';
        this.isEnabled = !!apiKey;

        if (apiKey) {
            // this.resend = new Resend(apiKey);
            this.logger.log('Email service initialized with Resend');
        } else {
            this.logger.warn('Email service disabled - RESEND_API_KEY not configured');
        }
    }

    /**
     * Send invite email to new user
     */
    async sendInvite(email: string, inviteUrl: string, orgName: string): Promise<void> {
        const subject = `تمت دعوتك للانضمام إلى ${orgName} على Rappit`;

        const html = this.getInviteTemplate({
            orgName,
            inviteUrl,
        });

        await this.send({
            to: email,
            subject,
            html,
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
        const subject = 'إعادة تعيين كلمة المرور - Rappit';

        const html = this.getPasswordResetTemplate({ resetUrl });

        await this.send({
            to: email,
            subject,
            html,
        });
    }

    /**
     * Core send method
     */
    async send(options: SendEmailOptions): Promise<void> {
        if (!this.isEnabled) {
            this.logger.log(`[DEV MODE] Would send email to ${options.to}: ${options.subject}`);
            return;
        }

        try {
            // const response = await this.resend.emails.send({
            //   from: this.from,
            //   to: options.to,
            //   subject: options.subject,
            //   html: options.html,
            //   text: options.text,
            //   reply_to: options.replyTo,
            // });

            // this.logger.log(`Email sent: ${response.id}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${options.to}:`, error);
            throw new Error('فشل إرسال البريد الإلكتروني');
        }
    }

    // ============================================================
    // EMAIL TEMPLATES
    // ============================================================

    private getInviteTemplate(data: { orgName: string; inviteUrl: string }): string {
        return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>دعوة للانضمام</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .content p { color: #374151; line-height: 1.8; margin: 0 0 20px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; 
              border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .button:hover { background: #2563eb; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
    .org-name { font-weight: bold; color: #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Rappit</h1>
    </div>
    <div class="content">
      <p>مرحباً،</p>
      <p>
        تمت دعوتك للانضمام إلى <span class="org-name">${data.orgName}</span> على منصة Rappit.
      </p>
      <p>
        Rappit هي منصة إدارة العمليات التجارية والمخزون الأكثر تطوراً في المنطقة.
      </p>
      <center>
        <a href="${data.inviteUrl}" class="button">قبول الدعوة</a>
      </center>
      <p style="color: #6b7280; font-size: 14px;">
        صالحة لمدة 24 ساعة. إذا لم تطلب هذه الدعوة، يمكنك تجاهل هذا البريد.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 Rappit. جميع الحقوق محفوظة.</p>
      <p>هذا بريد آلي، يرجى عدم الرد عليه.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
    }

    private getPasswordResetTemplate(data: { resetUrl: string }): string {
        return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إعادة تعيين كلمة المرور</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .content p { color: #374151; line-height: 1.8; margin: 0 0 20px; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; 
              border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 إعادة تعيين كلمة المرور</h1>
    </div>
    <div class="content">
      <p>مرحباً،</p>
      <p>
        طلبت إعادة تعيين كلمة المرور لحسابك على Rappit.
      </p>
      <center>
        <a href="${data.resetUrl}" class="button">إعادة تعيين كلمة المرور</a>
      </center>
      <p style="color: #6b7280; font-size: 14px;">
        صالحة لمدة ساعة واحدة. إذا لم تطلب هذا، يمكنك تجاهل هذا البريد.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 Rappit. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
    }
}
