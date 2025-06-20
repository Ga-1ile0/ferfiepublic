import axios from 'axios';

export type HardcodedNft = {
  id: number;
  contract: string;
  name: string;
  slug: string;
  image: string;
  banner: string;
};


export const availableNfts: HardcodedNft[] = [
  {
    id: 1,
    contract: '0x3319197b0d0f8ccd1087f2d2e47a8fb7c0710171',
    name: 'Wealthy Hypio Babies',
    slug: 'wealthy-hypio-babies',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAGq6uCMJX%2BtGQPmT4YIXAK4VA2IgRksQrcN76hSg8OnYLPR6iL26uSUYomaoxVQmo5NNNJS%2FTUt%2FhECTl%2BfXG1Ms0wazLKVYDDGyamhAklHMPCyE5rvOLurABiGsXBnZYw%3D%3D?width=250',
    banner:
      'https://i.seadn.io/s/primary-drops/0x3319197b0d0f8ccd1087f2d2e47a8fb7c0710171/34131627:about:media:7a907fbc-3ae4-4ccb-8e6e-9a42e45b6f9c.gif?w=500&auto=format',
  },
  {
    id: 2,
    contract: '0x56dfe6ae26bf3043dc8fdf33bf739b4ff4b3bc4a',
    name: 're:generates',
    slug: 'regenerates',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAIYpev452AQgX6bsora2mDds77eQAr4TqUbdzZMPAySauupXjDV7bAA41Uf0A7t3DCqvPRWSoa8mGo2sxgZtuqFWvHHcGJikFoHR2CPdvZXU8xnQoq%2FQuawi96FgEGD3bw%3D%3D?width=250',
    banner:
      'https://i.seadn.io/s/primary-drops/0x56dfe6ae26bf3043dc8fdf33bf739b4ff4b3bc4a/33411207:about:media:1d6e8ed7-6cc3-4d63-bcae-c493c0b31ac3.jpeg?w=500&auto=format',
  },
  {
    id: 3,
    contract: '0xa449b4f43d9a33fcdcf397b9cc7aa909012709fd',
    name: 'onchain gaias',
    slug: 'onchain-gaias',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAGWMlxciEQCESPKStAj21DrRUM9Yb3k%2Blg5QXu6IeSUtEV9XbsKDSkz%2FB%2F0aYXx9V3%2Fg4rhtx0Tuha7Nu94tUsO5UFXN8luN9cD6eLsR3K%2BS4y6pTJ3S5DADuvbrEbO9JQ%3D%3D?width=250',
    banner:
      'https://i.seadn.io/s/primary-drops/0xa449b4f43d9a33fcdcf397b9cc7aa909012709fd/31598462:about:media:756d25b2-c64b-4096-9afc-abb36f36cc6a.jpeg?w=500&auto=format',
  },
  {
    id: 4,
    contract: '0x227f81f5f697cdd9554a43bbab01d7a85b9466c1',
    name: 'Shredding Sassy - Base',
    slug: 'shredding-sassy-base',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAGEW0NdmaA%2F5GLKaPGW7NdAqyHjz1Xw%2B0NZzPqAFDFqb8%2BjaOkJblp9PJGJIvkqktxizJZ0SCTK1ZhjpYJmOaCuroRbrnhQrCF8wiNTvyI%2F9H4Vqj%2BRT7q9P%2Bwe6fXo9Aw%3D%3D?width=250',
    banner: 'https://i.seadn.io/s/raw/files/afab4bb504c5ba8db85d796b3b7343e4.png?w=500&auto=format',
  },
  {
    id: 5,
    contract: '0x01101e7f80e4564f6a74d5ba85838c997fdaae4c',
    name: 'ONtegrity',
    slug: 'ontegirty',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuADyb5V3ZdOVC%2BcI8%2B4nKZT6l4GKEUBFLFMsgO0fClxrNIiWouhmSjbAflKcDgbSP0vD%2FA2nJfPL4uFa1GgQfqTghmFCcCEJGCuvJCpOf9z%2FKVUJ1YOFpjtoQ2RPBizjOUw%3D%3D?width=250',
    banner:
      'https://i.seadn.io/s/primary-drops/0x01101e7f80e4564f6a74d5ba85838c997fdaae4c/34671331:about:media:1b23185a-23df-4fec-b5dd-a3f3a0681404.jpeg?w=500&auto=format',
  },
  {
    id: 6,
    contract: '0xee7d1b184be8185adc7052635329152a4d0cdefa',
    name: 'Kemonokaki',
    slug: 'kemonokaki',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAGq6uCMJX%2BtGQPmT4YIXAK6eZo9GQuoEdmcrMMk4vg%2FBJKs346Nhk2VSriCoaGR7aYs2SW6dZEfVPdAQpyLB7DLLL1blMcIOVLJxHKuFg7iJMaxyGk7izev2FZSqD6qtLA%3D%3D?width=250',
    banner:
      'https://i.seadn.io/s/primary-drops/0xee7d1b184be8185adc7052635329152a4d0cdefa/32589124:about:media:2d39ceed-a62b-4bab-89ff-63f3c669da9f.png?w=500&auto=format',
  },
  {
    id: 7,
    contract: '0xcb28749c24af4797808364d71d71539bc01e76d4',
    name: 'based punks',
    slug: 'basedpunks',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAEaPekw4eyhAp5W%2FhuiJBJ%2FRiVbWygEhBj37cRJxjqsGk6hrIFHJr4xKX2iiBNj%2F2B5sQKBDEBRXzrz2yrJw8e3f01WAGa48Fi7DPsQfVpzKBOBQohayr6om2qHZpySR8Q%3D%3D?width=250',
    banner:
      'https://i.seadn.io/s/primary-drops/0xcb28749c24af4797808364d71d71539bc01e76d4/31775389:about:media:06c699f1-94dc-4f1d-aa87-97654e0c6ae6.png?w=500&auto=format',
  },
  {
    id: 8,
    contract: '0x2d53d0545cd1275b69040e3c50587e2cc4443a52',
    name: 'Base Gods',
    slug: 'basegods',
    image:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAKM5v2dthdDNgoFYsopVhfXcE1kwLxKWOGZe3ONA94t6PYQosRURPfz4kgEmsmyISFUQNt%2BaBx0sczDOxsberHYsTIqYTVVHqTtrSMRUw7Fus2pc%2Fo3kDbaHyT4J33muEQ%3D%3D?width=250',
    banner:
      'https://img.reservoir.tools/images/v2/base/z9JRSpLYGu7%2BCZoKWtAuAHKntCJqa3lFuGLn%2FFMZtX5ywVyB6L2Zyj2Ev3JH1GrqzecGjAf6R4c1%2Fp88XUyJiEZxYFyYP8hEAcfpzGbgyEAGQgUm%2BHAsKM8cZNzdq3rSIGjfRalDvCZTqh3S9tez6qQ2Fg%2F4lQRQGJKzDtrKnimETMM%2BZpYDKmuWM1zngB4rKr3zn3FhSYjq1%2B2RaTn3YA%3D%3D',
  },
];

// NFT Portfolio types
export type NFTItem = {
  id: string;
  name: string;
  collection: string;
  image: string;
  value: number; // Value in user's currency
  acquired: string;
  tokenId: string;
  contract: string;
  ethValue: number;
};

/**
 * Fetch NFTs owned by a user
 * @param userAddress The user's wallet address
 * @param currencyAddress The currency to display values in
 */
export async function getUserNFTs(
  userAddress: string,
  currencyAddress: string
): Promise<NFTItem[]> {
  try {
    // Build collection parameters from availableNfts
    const collectionParams = availableNfts.map(nft => `collection=${nft.contract}`).join('&');

    // Build Reservoir API URL
    const apiUrl = `https://api-base.reservoir.tools/users/${userAddress}/tokens/v10?${collectionParams}&includeTopBid=true&displayCurrency=${currencyAddress}`;

    console.log('Fetching NFTs from:', apiUrl);

    // Make the API request
    const response = await axios.get(apiUrl, {
      headers: {
        accept: '*/*',
        'x-api-key': process.env.NEXT_PUBLIC_RESERVOIR_API_KEY,
      },
    });

    const data = response.data;
    console.log('NFT data response:', data);

    if (!data.tokens || !Array.isArray(data.tokens)) {
      console.warn('No NFTs found or invalid response format');
      return [];
    }

    // Map the response to our NFTItem format
    const nfts: NFTItem[] = data.tokens.map((item: any) => {
      const token = item.token;
      const ownership = item.ownership;
      const topBid = token.topBid;

      // Use topBid value if available, otherwise use floorAsk value or 0
      let value = 0;
      if (topBid && topBid.price && topBid.price.amount) {
        value = topBid.price.amount.decimal || 0;
      }
      let ethValue = 0;
      if (topBid && topBid.price && topBid.price.amount) {
        ethValue = topBid.price.amount.native || 0;
      }

      // Format acquisition date
      let acquired = 'Unknown';
      if (ownership && ownership.acquiredAt) {
        const acquiredDate = new Date(ownership.acquiredAt);
        // If within the last month, show in weeks/days
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - acquiredDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 7) {
          acquired = `${diffDays} days ago`;
        } else if (diffDays < 30) {
          acquired = `${Math.floor(diffDays / 7)} weeks ago`;
        } else if (diffDays < 365) {
          acquired = `${Math.floor(diffDays / 30)} months ago`;
        } else {
          acquired = acquiredDate.toLocaleDateString();
        }
      }

      return {
        id: `${token.contract}-${token.tokenId}`,
        name: token.name || `#${token.tokenId}`,
        collection: token.collection?.name || 'Unknown Collection',
        image: token.image || token.imageSmall || '',
        value: value,
        acquired: acquired,
        tokenId: token.tokenId,
        contract: token.contract,
        ethValue: ethValue,
      };
    });

    console.log('Processed NFTs:', nfts);
    return nfts;
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    return [];
  }
}
