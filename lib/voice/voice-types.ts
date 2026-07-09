export type Intent =
  | 'NAVIGATE'
  | 'SEARCH'
  | 'CLEAR_SEARCH'
  | 'EXPORT'
  | 'REFRESH'
  | 'POS_ADD'
  | 'POS_REMOVE'
  | 'POS_CLEAR'
  | 'POS_CHECKOUT'
  | 'POS_CANCEL'
  | 'PRODUCT_ADD'
  | 'PRODUCT_DELETE'
  | 'PRODUCT_EDIT'
  | 'PRODUCT_VIEW'
  | 'PRODUCT_TOGGLE'
  | 'PRODUCT_COUNT'
  | 'PRODUCT_REPLENISH'
  | 'PRODUCT_HISTORY'
  | 'CLIENT_ADD'
  | 'CLIENT_DELETE'
  | 'CLIENT_EDIT'
  | 'CLIENT_VIEW'
  | 'CLIENT_COUNT'
  | 'CLIENT_DEBTORS'
  | 'INVOICE_ADD'
  | 'INVOICE_DELETE'
  | 'INVOICE_EDIT'
  | 'INVOICE_VIEW'
  | 'STATS_REVENUE'
  | 'STATS_LOW_STOCK'
  | 'STATS_SALES_TODAY'
  | 'STATS_TOTAL_DEBT'
  | 'CONFIRM_YES'
  | 'CONFIRM_NO'
  | 'REPEAT';

export interface Entity {
  type: 'number' | 'product' | 'client' | 'page' | 'term' | 'invoice';
  value: string | number;
}

export interface ParsedCommand {
  intent: Intent;
  entities: Entity[];
  originalText: string;
  confidence: number;
  requiresConfirmation: boolean;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  navigateTo?: string;
  shouldRefresh?: boolean;
  fallbackIntent?: Intent;
}

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'AWAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'CANCELLED';