'use client';
import './globals.css';
import type { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { coinbaseWallet, metaMask, injected, walletConnect } from 'wagmi/connectors';

const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'ferfie.',
    }),
    metaMask(),
    injected(),
    walletConnect({
      projectId: '38926b821d0776e3c766d73d75581dc7',
    }),
  ],
  ssr: true,
  transports: {
    [base.id]: http(),
  },
});

// Create a React-Query client
const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
          config={{
            appearance: {
              name: 'ferfie.', // Displayed in modal header
              // logo: 'https://app.ferfie.com/icon512_rounded.png',// Displayed in modal header
              mode: 'dark', // 'light' | 'dark' | 'auto'
              theme: 'custom',
            },
            wallet: {
              // Spent hours trying to style the modal to no avail, will try again later
              display: 'modal',
              //   termsUrl: 'https://ferfie.com/terms',
              //   privacyUrl: 'https://ferfie.com/privacy',
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
