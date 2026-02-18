import { Resend } from 'resend';

const FROM_EMAIL = process.env.EMAIL_FROM || 'nullcheck <noreply@nullcheck.io>';

// Lazy-load Resend client to avoid build-time errors
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const resend = getResend();

  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

export async function sendApiKeyEmail(
  email: string,
  apiKey: string,
  tier: string
): Promise<boolean> {
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your nullcheck API Key</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #d0d0d0; padding: 40px 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 24px;">Your API Key is Ready</h1>

    <p style="margin-bottom: 16px;">
      Your <strong style="color: #60a5fa;">${tierLabel}</strong> API subscription is now active.
    </p>

    <p style="margin-bottom: 8px; color: #9ca3af;">Your API key:</p>

    <div style="background-color: #1a1a1a; border: 1px solid #333; padding: 16px; margin-bottom: 24px; font-family: monospace; font-size: 14px; word-break: break-all; color: #ffffff;">
      ${apiKey}
    </div>

    <div style="background-color: #7f1d1d33; border: 1px solid #991b1b; padding: 16px; margin-bottom: 24px;">
      <p style="color: #fca5a5; margin: 0; font-size: 14px;">
        <strong>Save this key now.</strong> For security reasons, we cannot show it again.
        If you lose it, you'll need to create a new one.
      </p>
    </div>

    <h2 style="color: #ffffff; font-size: 18px; margin-bottom: 16px;">Quick Start</h2>

    <p style="margin-bottom: 8px; color: #9ca3af;">Make your first request:</p>

    <div style="background-color: #1a1a1a; border: 1px solid #333; padding: 16px; margin-bottom: 24px; font-family: monospace; font-size: 13px; overflow-x: auto;">
      <code style="color: #86efac;">curl</code> -H <code style="color: #fde047;">"X-API-Key: ${apiKey}"</code> \\<br>
      &nbsp;&nbsp;https://nullcheck.io/api/tokens
    </div>

    <p style="margin-bottom: 24px;">
      <a href="https://nullcheck.io/docs" style="color: #60a5fa; text-decoration: none;">View full API documentation &rarr;</a>
    </p>

    <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">

    <p style="color: #6b7280; font-size: 12px; margin: 0;">
      You're receiving this because you subscribed to nullcheck API.<br>
      <a href="https://nullcheck.io/keys" style="color: #6b7280;">Manage your API keys</a>
    </p>
  </div>
</body>
</html>
`;

  const text = `Your nullcheck API Key is Ready

Your ${tierLabel} API subscription is now active.

Your API key:
${apiKey}

IMPORTANT: Save this key now. For security reasons, we cannot show it again. If you lose it, you'll need to create a new one.

Quick Start:
curl -H "X-API-Key: ${apiKey}" https://nullcheck.io/api/tokens

View full documentation: https://nullcheck.io/docs

---
Manage your API keys: https://nullcheck.io/keys
`;

  return sendEmail({
    to: email,
    subject: 'Your nullcheck API Key',
    html,
    text,
  });
}
