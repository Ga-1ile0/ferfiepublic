import { NextRequest, NextResponse } from 'next/server';
import { storeAllTokenPrices } from '@/server/tokenRates';

// Flag to track if a fetch is in progress
let isFetchInProgress = false;

export async function GET(request: NextRequest) {
  // Guard to prevent concurrent executions
  if (isFetchInProgress) {
    return NextResponse.json(
      { success: false, message: 'A token rate fetch is already in progress' },
      { status: 429 }
    );
  }

  try {
    isFetchInProgress = true;

    // Fetch and store token prices
    const result = await storeAllTokenPrices();

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch token prices' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: true, results: result.results },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in tokenrate API route:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred while fetching token rates' },
      { status: 500 }
    );
  } finally {
    isFetchInProgress = false;
  }
}
