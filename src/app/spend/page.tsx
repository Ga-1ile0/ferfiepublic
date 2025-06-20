'use client';

import { Navbar } from '@/components/shared/navbar';
import { GiftCardInterface } from '@/components/child/gift-card-interface';
import { TradeInterface } from '@/components/child/trade-interface';
import { NFTInterface } from '@/components/child/nft-interface';
import { useRole } from '@/components/role-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Static } from '@/components/Static';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/authContext';
import { getKidPermissions } from '@/server/permissions';

export default function SpendPage() {
    const { role } = useRole();
    const router = useRouter();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [permissions, setPermissions] = useState({
        tradingEnabled: false,
        giftCardsEnabled: false,
        nftEnabled: false,
    });

    // Redirect if parent tries to access this page
    useEffect(() => {
        if (role === 'parent') {
            router.push('/');
        }
    }, [role, router]);

    // Fetch permissions to determine which features are enabled
    useEffect(() => {
        const fetchPermissions = async () => {
            if (!user?.id) return;

            try {
                setIsLoading(true);
                const response = await getKidPermissions(user.id);

                if (response.status === 200 && response.data) {
                    setPermissions({
                        tradingEnabled: response.data.tradingEnabled,
                        giftCardsEnabled: response.data.giftCardsEnabled,
                        nftEnabled: response.data.nftEnabled,
                    });
                }
            } catch (error) {
                console.error('Error fetching permissions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPermissions();
    }, [user?.id]);

    // If all features are disabled, redirect to home
    useEffect(() => {
        if (
            !isLoading &&
            !permissions.tradingEnabled &&
            !permissions.giftCardsEnabled &&
            !permissions.nftEnabled
        ) {
            router.push('/');
        }
    }, [isLoading, permissions, router]);

    // Determine which tab to show by default
    const defaultTab = permissions.tradingEnabled
        ? 'trade'
        : permissions.giftCardsEnabled
            ? 'gift-cards'
            : 'nfts';

    // If only one feature is enabled, don't show tabs
    const showTabs =
        (permissions.tradingEnabled && permissions.giftCardsEnabled) ||
        (permissions.tradingEnabled && permissions.nftEnabled) ||
        (permissions.giftCardsEnabled && permissions.nftEnabled);

    return (
        <main className="min-h-screen">
            <div className="fixed left-0 top-0 -z-10 h-screen w-full">
                <Static />
            </div>
            <div className="container mx-auto px-4 py-8">
                <h1 className=" my-0 mb-2 text-3xl font-bold text-shadow-small">Spend</h1>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : showTabs ? (
                    <Tabs defaultValue={defaultTab} className="w-full">
                        <TabsList 
                            className={`grid w-full mb-6 ${
                                [permissions.tradingEnabled, permissions.giftCardsEnabled, permissions.nftEnabled].filter(Boolean).length === 2 
                                    ? 'grid-cols-2' 
                                    : 'grid-cols-3'
                            }`}
                        >
                            {permissions.tradingEnabled && <TabsTrigger value="trade">Trade</TabsTrigger>}
                            {permissions.giftCardsEnabled && (
                                <TabsTrigger value="gift-cards">Gift Cards</TabsTrigger>
                            )}
                            {permissions.nftEnabled && <TabsTrigger value="nfts">NFTs</TabsTrigger>}
                        </TabsList>

                        {permissions.tradingEnabled && (
                            <TabsContent value="trade">
                                <TradeInterface />
                            </TabsContent>
                        )}

                        {permissions.giftCardsEnabled && (
                            <TabsContent value="gift-cards">
                                <GiftCardInterface />
                            </TabsContent>
                        )}

                        {permissions.nftEnabled && (
                            <TabsContent value="nfts">
                                <NFTInterface />
                            </TabsContent>
                        )}
                    </Tabs>
                ) : (
                    // If only one feature is enabled, show it without tabs
                    <>
                        {permissions.tradingEnabled && <TradeInterface />}
                        {permissions.giftCardsEnabled && <GiftCardInterface />}
                        {permissions.nftEnabled && <NFTInterface />}
                    </>
                )}
            </div>
            <Navbar />
        </main>
    );
}
