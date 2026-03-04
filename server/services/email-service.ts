type LicenseEmailPayload = {
  toEmail: string;
  ownerName?: string | null;
  licenseKey: string;
  planName?: string | null;
  expiresAt?: Date | null;
  appName?: string;
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
  error?: string;
};

export class EmailService {
  private apiKey = process.env.BREVO_API_KEY?.trim() || "";
  private senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || "";
  private senderName = process.env.BREVO_SENDER_NAME?.trim() || "";
  private appName = process.env.EMAIL_APP_NAME?.trim() || "License Portal";
  private supportEmail = process.env.EMAIL_SUPPORT?.trim() || "";
  private portalUrl = process.env.PORTAL_URL?.trim() || "";

  isConfigured(): boolean {
    return !!this.apiKey && !!this.senderEmail;
  }

  async sendLicenseDeliveryEmail(payload: LicenseEmailPayload): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Email service not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.");
    }

    const toEmail = payload.toEmail.trim();
    if (!toEmail || !toEmail.includes("@")) {
      throw new Error("Invalid recipient email address.");
    }

    const subject = this.buildSubject(payload);
    const html = this.buildLicenseEmailHtml(payload);
    const text = this.buildLicenseEmailText(payload);
    const senderName = this.senderName || (payload.appName || this.appName);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: this.senderEmail
        },
        to: [
          {
            email: toEmail,
            ...(payload.ownerName?.trim() ? { name: payload.ownerName.trim() } : {})
          }
        ],
        subject,
        htmlContent: html,
        textContent: text,
        ...(this.supportEmail ? { replyTo: { email: this.supportEmail } } : {})
      })
    });

    if (!response.ok) {
      let details = `${response.status}`;
      try {
        const data = (await response.json()) as BrevoResponse;
        details = data.message || data.error || data.code || details;
      } catch {}
      throw new Error(`Failed to send license email: ${details}`);
    }
  }

  private buildSubject(payload: LicenseEmailPayload): string {
    const appName = payload.appName || this.appName;
    const planName = payload.planName?.trim() || "License";
    if (payload.expiresAt) {
      const expiry = this.formatDateUtc(payload.expiresAt);
      return `${appName} License Key - ${planName} (Expires ${expiry} UTC)`;
    }
    return `${appName} License Key - ${planName}`;
  }

  private buildLicenseEmailHtml(payload: LicenseEmailPayload): string {
    const appName = this.escapeHtml(payload.appName || this.appName);
    const ownerName = this.escapeHtml(payload.ownerName?.trim() || "Device Owner");
    const planName = this.escapeHtml(payload.planName?.trim() || "Assigned Plan");
    const expiresAt = this.escapeHtml(payload.expiresAt ? payload.expiresAt.toUTCString() : "N/A");
    const licenseKey = this.escapeHtml(payload.licenseKey);
    const portalUrl = this.escapeHtml(this.portalUrl);
    const supportEmail = this.escapeHtml(this.supportEmail || this.senderEmail);
    const year = new Date().getUTCFullYear();

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName} License</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fc;font-family:Segoe UI,Arial,sans-serif;color:#12243a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b1220;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;background:#ffffff;border:1px solid #dbe6fb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;">${appName}</h1>
                <p style="margin:8px 0 0 0;font-size:14px;opacity:0.95;">Your license key is ready to activate</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 14px 0;font-size:15px;">Hi ${ownerName},</p>
                <p style="margin:0 0 20px 0;font-size:14px;color:#4a5f82;">
                  Your device has been assigned a license. Use the exact code below in your application.
                </p>
                <div style="background:#f6f9ff;border:1px dashed #7ca1df;border-radius:12px;padding:16px 14px;margin-bottom:20px;">
                  <div style="font-size:11px;letter-spacing:1.3px;color:#3a5f9c;text-transform:uppercase;margin-bottom:8px;">Exact License Code</div>
                  <div style="font-family:Consolas,Monaco,monospace;font-size:20px;line-height:1.4;color:#12243a;word-break:break-all;">${licenseKey}</div>
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;color:#b7c6ea;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;border-top:1px solid #e3ecfb;color:#5a7094;">Plan</td>
                    <td style="padding:10px 0;border-top:1px solid #e3ecfb;text-align:right;color:#12243a;font-weight:600;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-top:1px solid #e3ecfb;color:#5a7094;">Last Date of Use (UTC)</td>
                    <td style="padding:10px 0;border-top:1px solid #e3ecfb;text-align:right;color:#12243a;font-weight:600;">${expiresAt}</td>
                  </tr>
                </table>
                ${portalUrl ? `<div style="margin-top:22px;"><a href="${portalUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-size:13px;">Open License Portal</a></div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f3f7ff;color:#5a7094;font-size:12px;line-height:1.6;">
                Need help? Reply to this email or contact ${supportEmail}.<br />
                This is an automated message from ${appName}.<br />
                Copyright ${year} ${appName}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private buildLicenseEmailText(payload: LicenseEmailPayload): string {
    const appName = payload.appName || this.appName;
    const ownerName = payload.ownerName?.trim() || "Device Owner";
    const planName = payload.planName?.trim() || "Assigned Plan";
    const expiresAt = payload.expiresAt ? payload.expiresAt.toUTCString() : "N/A";
    const helpLine = this.supportEmail || this.senderEmail;
    const portal = this.portalUrl ? `Portal: ${this.portalUrl}\n` : "";

    return [
      `Hi ${ownerName},`,
      "",
      `Your ${appName} license key is ready.`,
      "",
      `Exact License Code: ${payload.licenseKey}`,
      `Plan: ${planName}`,
      `Last Date of Use (UTC): ${expiresAt}`,
      "",
      portal.trim(),
      `Support: ${helpLine}`,
      "",
      `This is an automated message from ${appName}.`
    ].filter(Boolean).join("\n");
  }

  private formatDateUtc(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

export const emailService = new EmailService();
