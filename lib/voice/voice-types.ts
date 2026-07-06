// ─── Types des intentions ──────────────────────────────────────────
export type Intent =
  // Navigation (sans confirmation)
  | 'NAVIGATE'
  // Recherche (sans confirmation)
  | 'SEARCH'
  // POS / Panier (AVEC confirmation)
  | 'POS_ADD'
  | 'POS_REMOVE'
  | 'POS_CLEAR'
  | 'POS_CHECKOUT'
  | 'POS_CANCEL'
  // Produits (AVEC confirmation pour modification)
  | 'PRODUCT_ADD'
  | 'PRODUCT_DELETE'
  | 'PRODUCT_MODIFY'
  | 'PRODUCT_COUNT'
  // Clients (AVEC confirmation pour création/suppression)
  | 'CLIENT_ADD'
  | 'CLIENT_COUNT'
  | 'CLIENT_DEBTORS'
  // Statistiques (sans confirmation)
  | 'STATS_REVENUE'
  | 'STATS_LOW_STOCK'
  | 'STATS_SALES_TODAY'
  | 'STATS_TOTAL_DEBT'
  // Contrôle assistant
  | 'CONFIRM_YES'
  | 'CONFIRM_NO'
  | 'REPEAT';

export interface Entity {
  type: 'number' | 'product' | 'client' | 'page' | 'term';
  value: string | number;
}

export interface ParsedCommand {
  intent: Intent;
  entities: Entity[];
  originalText: string;
  confidence: number; // 0-1
  requiresConfirmation: boolean;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'AWAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'CANCELLED';

export interface VoiceContext {
  lastCommand: ParsedCommand | null;
  lastResult: CommandResult | null;
  transcript: string;
  confirmationCommand: ParsedCommand | null;
}