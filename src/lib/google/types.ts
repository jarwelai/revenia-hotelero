/**
 * Google Business Profile API types.
 * Used by the Google OAuth client and review reply integration.
 */

export interface GoogleAccount {
  name: string        // accounts/{accountId}
  accountName: string
  type: string
  role: string
}

export interface GoogleLocation {
  name: string        // accounts/{accountId}/locations/{locationId}
  title: string
  storefrontAddress?: {
    addressLines: string[]
    locality: string
    regionCode: string
  }
}

export interface GoogleReviewReply {
  comment: string
  updateTime: string
}

export interface GoogleApiError {
  code: number
  message: string
  status: string
}
