import { ChainId } from './chain';

export type AlertType = 'price_above' | 'price_below';

export interface PriceAlert {
  id: string;
  userId: string;
  chainId: ChainId;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string | null;
  alertType: AlertType;
  targetPrice: number;
  createdPrice: number;
  isTriggered: boolean;
  triggeredAt: string | null;
  triggeredPrice: number | null;
  notificationSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRequest {
  chainId: ChainId;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  alertType: AlertType;
  targetPrice: number;
  currentPrice: number;
}

export interface AlertWithCurrentPrice extends PriceAlert {
  currentPrice?: number;
  percentToTarget?: number;
}

// Database row type (snake_case)
export interface PriceAlertRow {
  id: string;
  user_id: string;
  chain_id: string;
  token_address: string;
  token_symbol: string;
  token_name: string | null;
  alert_type: string;
  target_price: number;
  created_price: number;
  is_triggered: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

// Convert database row to API response
export function toAlert(row: PriceAlertRow): PriceAlert {
  return {
    id: row.id,
    userId: row.user_id,
    chainId: row.chain_id as ChainId,
    tokenAddress: row.token_address,
    tokenSymbol: row.token_symbol,
    tokenName: row.token_name,
    alertType: row.alert_type as AlertType,
    targetPrice: Number(row.target_price),
    createdPrice: Number(row.created_price),
    isTriggered: row.is_triggered,
    triggeredAt: row.triggered_at,
    triggeredPrice: row.triggered_price ? Number(row.triggered_price) : null,
    notificationSent: row.notification_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
