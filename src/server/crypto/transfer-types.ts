// Define types for permissions data from the database
export interface PermissionData {
  id: string;
  userId: string;
  tradingEnabled: boolean;
  nftEnabled: boolean;
  giftCardsEnabled: boolean;
  maxTradeAmount: number | null;
  maxGiftCardAmount: number | null;
  requireGiftCardApproval: boolean;
  allowedTokenSymbols: string[];
  allowedNftSlugs: string[];
  allowedGiftCardCategories: string[];
  // Crypto transfer fields
  cryptoTransferEnabled: boolean;
  maxTransferAmount: number | null;
  allowedRecipientAddresses: string[];
  // Legacy fields
  allowEth?: boolean;
  allowUsdc?: boolean;
  allowBase?: boolean;
  allowGamingGiftCards?: boolean;
  allowFoodGiftCards?: boolean;
  allowEntertainmentGiftCards?: boolean;
  allowShoppingGiftCards?: boolean;
}

export interface TransferResult {
  status: number;
  message: string;
  txHash?: string;
}
