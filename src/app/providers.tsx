'use client';
import './globals.css';
import type { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { coinbaseWallet, metaMask, injected, walletConnect } from 'wagmi/connectors';
import { PostHogProvider } from '../components/PostHogProvider';

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


const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
    return (
        <PostHogProvider>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <OnchainKitProvider
                        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                        chain={base}
                        config={{
                            appearance: {
                                name: 'ferfie.',
                                // logo: 'https://app.ferfie.com/icon512_rounded.png',
                                mode: 'dark',
                                theme: 'custom',
                            },
                            wallet: {
                                display: 'modal',
                            },
                        }}
                    >
                        {children}
                    </OnchainKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </PostHogProvider>
    );
}
