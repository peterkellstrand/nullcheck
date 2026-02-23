import { sendEmail } from './index';
import { AlertType } from '@/types/alert';
import { ChainId, CHAINS } from '@/types/chain';

interface PriceAlertEmailParams {
  tokenSymbol: string;
  tokenName: string | null;
  chainId: ChainId;
  alertType: AlertType;
  targetPrice: number;
  triggeredPrice: number;
  tokenAddress: string;
}

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }
  if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  }
  return `$${price.toExponential(4)}`;
}

export async function sendPriceAlertEmail(
  email: string,
  params: PriceAlertEmailParams
): Promise<boolean> {
  const { tokenSymbol, tokenName, chainId, alertType, targetPrice, triggeredPrice, tokenAddress } = params;

  const chain = CHAINS[chainId];
  const chainName = chain?.name || chainId;
  const direction = alertType === 'price_above' ? 'above' : 'below';
  const arrow = alertType === 'price_above' ? '&uarr;' : '&darr;';
  const arrowText = alertType === 'price_above' ? '^' : 'v';
  const color = alertType === 'price_above' ? '#22c55e' : '#ef4444';

  const tokenUrl = `https://nullcheck.io/token/${chainId}/${tokenAddress}`;
  const displayName = tokenName ? `${tokenSymbol} (${tokenName})` : tokenSymbol;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Alert: ${tokenSymbol}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #d0d0d0; padding: 40px 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 24px;">
      <span style="color: ${color};">${arrow}</span> Price Alert Triggered
    </h1>

    <p style="margin-bottom: 16px; font-size: 16px;">
      <strong style="color: #ffffff;">${displayName}</strong> on ${chainName} is now ${direction} your target price.
    </p>

    <div style="background-color: #1a1a1a; border: 1px solid #333; padding: 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #9ca3af;">Target Price</td>
          <td style="padding: 8px 0; text-align: right; color: #ffffff; font-family: monospace;">${formatPrice(targetPrice)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af;">Current Price</td>
          <td style="padding: 8px 0; text-align: right; color: ${color}; font-family: monospace; font-weight: bold;">${formatPrice(triggeredPrice)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #9ca3af;">Chain</td>
          <td style="padding: 8px 0; text-align: right; color: #ffffff;">${chainName}</td>
        </tr>
      </table>
    </div>

    <p style="margin-bottom: 24px;">
      <a href="${tokenUrl}" style="display: inline-block; background-color: ${color}; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600;">
        View Token &rarr;
      </a>
    </p>

    <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
      This alert has been triggered and will not fire again.
    </p>

    <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">

    <p style="color: #6b7280; font-size: 12px; margin: 0;">
      You're receiving this because you set a price alert on nullcheck.<br>
      <a href="https://nullcheck.io/alerts" style="color: #6b7280;">Manage your alerts</a>
    </p>
  </div>
</body>
</html>
`;

  const text = `Price Alert Triggered

${displayName} on ${chainName} is now ${direction} your target price.

Target Price: ${formatPrice(targetPrice)}
Current Price: ${formatPrice(triggeredPrice)} ${arrowText}
Chain: ${chainName}

View token: ${tokenUrl}

This alert has been triggered and will not fire again.

---
Manage your alerts: https://nullcheck.io/alerts
`;

  return sendEmail({
    to: email,
    subject: `${arrowText} ${tokenSymbol} is ${direction} ${formatPrice(targetPrice)}`,
    html,
    text,
  });
}
