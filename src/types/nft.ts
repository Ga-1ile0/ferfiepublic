// NFT Collection Types
export interface NFT {
    id: number
    name: string
    collection: string
    description: string
    price: number
    image: string
    creator: string
    ownerCount?: string
    tokenCount?: string
    slug?: string
    banner?: string
    contractAddress?: string
    verified?: boolean
    lowestPrice?: number
    twitterUsername?: string
    discordUrl?: string
    volume?: {
      "7day": string
      "30day": string
    }
    externalUrl?: string
  }

  export interface NFTDetailDialogProps {
    nft: NFT | null
    open: boolean
    onOpenChange: (open: boolean) => void
  }

  // Token Types
  export interface TokenAttribute {
    key: string
    value: string
    count: number
    floorAskPrice?: {
      amount: {
        native: number
      }
    }
  }

  export interface AttributeFilter {
    [key: string]: string[]
  }

  export interface Token {
    token: {
      contract: string
      tokenId: string
      name: string
      description: string
      image: string
      imageSmall: string
      rarityRank?: number
      owner?: string
      attributes?: { key: string; value: string }[]
      collection?: {
        id: string
        name: string
        image?: string
        verified?: boolean
        floorAskPrice?: {
          amount?: {
            raw?: string
            decimal?: number
            usd?: number
            native?: number
          }
        }
      }
      lastSale?: {
        price: {
          amount: {
            decimal: number
            native: number
            usd: number
          }
        }
      }
    }
    market: {
      floorAsk?: {
        price?: {
          amount?: {
            native?: number
            usd?: number
            decimal?: number
          }
        }
      }
      topBid?: {
        price?: {
          currency?: {
            contract: string
            name: string
            symbol: string
            decimals: number
          },
          amount?: {
            native?: number
            usd?: number
            decimal?: number
          }
        }
      }
    }
  }

  // Grid layout types
  export type GridLayout = 1 | 2 | 3

  // Token Activity Types
  export interface TokenActivityCurrency {
    contract: string
    name: string
    symbol: string
    decimals: number
  }

  export interface TokenActivityAmount {
    raw: string
    decimal: number
    usd: number
    native: number
  }

  export interface TokenActivityPrice {
    currency: TokenActivityCurrency
    amount: TokenActivityAmount
  }

  export interface TokenActivitySource {
    domain: string
    name: string
    icon: string
  }

  export interface TokenActivityOrder {
    id: string
    side: string
    source: TokenActivitySource
    criteria?: {
      kind: string
      data: {
        collection: {
          id: string
          name: string
          image: string
          isSpam: boolean
          isNsfw: boolean
        }
        token?: {
          tokenId: string
          name: string | null
          image: string | null
          isSpam: boolean
          isNsfw: boolean
        }
      }
    }
  }

  export interface TokenActivity {
    type: string
    fromAddress: string
    toAddress: string | null
    price: TokenActivityPrice | null
    amount: number
    timestamp: number
    createdAt: string
    contract: string
    token: {
      tokenId: string
      isSpam: boolean
      isNsfw: boolean
      tokenName: string
      tokenImage: string
      rarityScore?: number
      rarityRank?: number
    }
    collection: {
      collectionId: string
      isSpam: boolean
      isNsfw: boolean
      collectionName: string
      collectionImage: string
    }
    txHash?: string
    logIndex?: number
    batchIndex?: number
    fillSource?: TokenActivitySource
    comment?: string | null
    order?: TokenActivityOrder
    isAirdrop?: boolean
  }

  export interface TokenActivitiesResponse {
    activities: TokenActivity[]
    continuation: string | null
  }

  export interface TokenData {
    token: {
      contract: string
      tokenId: string
      name: string
      description: string
      image: string
      imageSmall: string
      rarityRank?: number
      owner?: string
      attributes?: { key: string; value: string }[]
      collection?: {
        id: string
        name: string
        image?: string
        verified?: boolean
        floorAskPrice?: {
          amount?: {
            raw?: string
            decimal?: number
            usd?: number
            native?: number
          }
        }
      }
      lastSale?: {
        price: {
          amount: {
            decimal: number
            native: number
            usd: number
          }
        }
      }
    }
    market: {
      floorAsk?: {
        price?: {
          amount?: {
            native?: number
            usd?: number
            decimal?: number
          }
        }
      }
      topBid?: {
        price?: {
          amount?: {
            native?: number
            usd?: number
            decimal?: number
          }
        }
      }
    }
  }

  export interface NFTTokenDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    token: TokenData | null
    isLoading?: boolean
  }

  // Reservoir Collection Types
  export interface ReservoirCollection {
    id: string
    slug: string
    name: string
    image: string
    banner: string
    creator: string
    description?: string
    primaryContract: string
    ownerCount: string
    tokenCount: string
    twitterUsername?: string
    twitterUrl?: string | null
    discordUrl?: string
    externalUrl?: string
    volume?: {
      "7day": string
      "30day": string
    }
    floorAsk?: {
      price?: {
        amount?: {
          raw?: string
          decimal?: number
          usd?: number
          native?: number
        }
        currency?: {
          contract: string
          name: string
          symbol: string
          decimals: number
        }
      }
    }
  }

  // NFT History Types
  export interface NFTHistoryItem {
    id: string
    type: "purchase" | "sale" | "listing" | "offer" | "cancelled" | "transfer"
    name: string
    collection: string
    price: number
    date: string
    image: string
    txHash?: string | null
    timestamp?: Date
    description?: string
  }
