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
const gatur = localFont({
  src: './fonts/Gatur-Black.woff2',
  variable: '--font-gatur',
  weight: '700',
});
export const metadata = {
  title: 'ferfie.',
  description: 'The Most Based Family Platform',
  manifest: '/manifest.json',
  themeColor: '#fab049',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ferfie.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${gatur.variable}  antialiased`} suppressHydrationWarning>
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
