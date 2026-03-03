type LicenseEmailPayload = {
  toEmail: string;
  ownerName?: string | null;
  licenseKey: string;
  planName?: string | null;
  expiresAt?: Date | null;
  appName?: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  error?: string;
};

export class EmailService {
  private apiKey = process.env.RESEND_API_KEY?.trim() || "";
  private fromEmail = process.env.EMAIL_FROM?.trim() || "";
  private appName = process.env.EMAIL_APP_NAME?.trim() || "License Portal";

  isConfigured(): boolean {
    return !!this.apiKey && !!this.fromEmail;
  }

  async sendLicenseDeliveryEmail(payload: LicenseEmailPayload): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const toEmail = payload.toEmail.trim();
    if (!toEmail || !toEmail.includes("@")) {
      return;
    }

    const subject = `Your ${payload.appName || this.appName} License Key`;
    const html = this.buildLicenseEmailHtml(payload);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [toEmail],
        subject,
        html
      })
    });

    if (!response.ok) {
      let details = `${response.status}`;
      try {
        const data = (await response.json()) as ResendResponse;
        details = data.message || data.error || details;
      } catch {}
      throw new Error(`Failed to send license email: ${details}`);
    }
  }

  private buildLicenseEmailHtml(payload: LicenseEmailPayload): string {
    const appName = payload.appName || this.appName;
    const ownerName = payload.ownerName?.trim() || "Device Owner";
    const planName = payload.planName?.trim() || "Assigned Plan";
    const expiresAt = payload.expiresAt ? payload.expiresAt.toUTCString() : "N/A";
    const year = new Date().getUTCFullYear();

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName} License</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1220;font-family:Segoe UI,Arial,sans-serif;color:#dbe4ff;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b1220;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;background:#111b32;border:1px solid #243659;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;">${appName}</h1>
                <p style="margin:8px 0 0 0;font-size:14px;opacity:0.95;">Your license key is ready</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 14px 0;font-size:15px;">Hi ${ownerName},</p>
                <p style="margin:0 0 20px 0;font-size:14px;color:#b7c6ea;">
                  Your device has been assigned a license. Use the exact code below in your application.
                </p>
                <div style="background:#0a1428;border:1px dashed #335084;border-radius:10px;padding:16px 14px;margin-bottom:20px;">
                  <div style="font-size:11px;letter-spacing:1.3px;color:#8ea7d8;text-transform:uppercase;margin-bottom:8px;">Exact License Code</div>
                  <div style="font-family:Consolas,Monaco,monospace;font-size:20px;line-height:1.4;color:#ffffff;word-break:break-all;">${payload.licenseKey}</div>
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;color:#b7c6ea;border-collapse:collapse;">
                  <tr>
                    <td style="padding:8px 0;border-top:1px solid #243659;">Plan</td>
                    <td style="padding:8px 0;border-top:1px solid #243659;text-align:right;color:#ffffff;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-top:1px solid #243659;">Last Date of Use (UTC)</td>
                    <td style="padding:8px 0;border-top:1px solid #243659;text-align:right;color:#ffffff;">${expiresAt}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#0c162d;color:#8ea7d8;font-size:12px;">
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
}

export const emailService = new EmailService();
