import type React from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { RoleProvider } from '@/components/role-provider';
import { Wallet } from '@coinbase/onchainkit/wallet';
import { Providers } from './providers';
import { AuthProvider } from '@/contexts/authContext';
import localFont from 'next/font/local';
import { ToastContainer } from 'react-toastify';
import { Bounce } from 'react-toastify';
import { PrivateKeyDownloadChecker } from '@/components/parent/private-key-download-checker';
import { Viewport } from '@/components/shared/viewport';
const gatur = localFont({
    src: './fonts/Gatur-Black.woff2',
    variable: '--font-gatur',
    weight: '700',
});
export const metadata = {
    title: 'ferfie',
    description: 'The Most Based Family Platform',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'ferfie',
    },
};

export const viewport = {
    themeColor: '#fab049',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <Viewport />
            </head>
            <body
                className={`${gatur.variable} antialiased max-w-[100vw] overflow-x-hidden`}
                suppressHydrationWarning
            >
                <ThemeProvider attribute="class" defaultTheme="light">
                    <Providers>
                        <RoleProvider>
                            <AuthProvider>
                                <Wallet>{children}</Wallet>
                                <PrivateKeyDownloadChecker />
                                <ToastContainer
                                    position="top-center"
                                    autoClose={5000}
                                    hideProgressBar
                                    newestOnTop={false}
                                    closeOnClick={true}
                                    rtl={false}
                                    pauseOnFocusLoss={false}
                                    draggable
                                    pauseOnHover={false}
                                    theme="dark"
                                    transition={Bounce}
                                />
                            </AuthProvider>
                        </RoleProvider>
                    </Providers>
                </ThemeProvider>
            </body>
        </html>
    );
}
