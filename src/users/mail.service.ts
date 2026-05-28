import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"GPX Action Maps" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'รีเซ็ตรหัสผ่าน GPX Action Maps',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="color: #004cca; margin-bottom: 8px;">รีเซ็ตรหัสผ่าน</h2>
            <p style="color: #424656; margin-bottom: 24px;">
              คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้จะหมดอายุใน <strong>1 ชั่วโมง</strong>
            </p>
            <a href="${resetUrl}"
               style="display:inline-block;background:#004cca;color:#fff;font-weight:bold;
                      text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;">
              ตั้งรหัสผ่านใหม่
            </a>
            <p style="color:#737687;font-size:12px;margin-top:24px;">
              ถ้าไม่ได้ขอรีเซ็ต ให้เพิกเฉยต่ออีเมลนี้ได้เลย
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('Failed to send reset email', err);
      throw err;
    }
  }
}
