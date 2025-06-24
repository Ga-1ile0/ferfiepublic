'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/authContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { getKidPermissions } from '@/server/permissions';
import { sendTokens, getUserAddress } from '@/server/crypto/transfer';
import QRCode from 'react-qr-code';
import { Currency } from '@/components/shared/currency-symbol';
import { availableTokens, getMultiTokenBalances, getExchangeRate } from '@/lib/tokens';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  Send,
  Wallet,
  AlertTriangle,
  Loader2,
  Users,
} from 'lucide-react';
import { ethers } from 'ethers';

// Type definition for token with balance
type TokenWithBalance = {
  id: number | string;
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
  image: string;
  balance: number;
  valueInStablecoin: number;
};

// Define types for transfer permissions
interface TransferPermissions {
  cryptoTransferEnabled: boolean;
  maxTransferAmount: number | null;
  allowedRecipientAddresses: string[];
  allowedTokenSymbols: string[];
  recipientNicknames?: Record<string, string>;
  includeFamilyWallet?: boolean;
}

export default function CryptoTransfer({ className }: { className?: string }) {
  const { user } = useAuth();

  // Dialog state
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('my-wallet');
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenWithBalance | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [nickname, setNickname] = useState('');

  // Data state
  const [walletAddress, setWalletAddress] = useState('');
  const [tokensWithBalances, setTokensWithBalances] = useState<TokenWithBalance[]>([]);
  const [userCurrency, setUserCurrency] = useState<string>('USDC');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permissions state
  const [permissions, setPermissions] = useState<TransferPermissions>({
    cryptoTransferEnabled: true,
    maxTransferAmount: null,
    allowedRecipientAddresses: [],
    allowedTokenSymbols: [],
    recipientNicknames: {},
    includeFamilyWallet: true,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Family wallet address
  const [familyWalletAddress, setFamilyWalletAddress] = useState<string>('');

  // Load user's wallet address
  useEffect(() => {
    if (!user?.id || !open) return;
    (async () => {
      try {
        const address = await getUserAddress(user.id);
        if (address) setWalletAddress(address);
      } catch (err) {
        console.error('Error loading wallet address:', err);
      }
    })();
  }, [user?.id, open]);

  // Load user permissions
  useEffect(() => {
    if (!user?.id || !open) return;
    (async () => {
      try {
        const response = await getKidPermissions(user.id);
        if (response.status === 200 && response.data) {
          setPermissions({
            cryptoTransferEnabled: response.data.cryptoTransferEnabled === true,
            maxTransferAmount: response.data.maxTransferAmount ?? null,
            allowedRecipientAddresses: Array.isArray(response.data.allowedRecipientAddresses)
              ? response.data.allowedRecipientAddresses
              : [],
            allowedTokenSymbols: Array.isArray(response.data.allowedTokenSymbols)
              ? response.data.allowedTokenSymbols
              : [],
            recipientNicknames: response.data.recipientNicknames || {},
            includeFamilyWallet: response.data.includeFamilyWallet !== false,
          });
        }
      } catch (err) {
        console.error('Error loading permissions:', err);
      } finally {
        setPermissionsLoaded(true);
      }
    })();
  }, [user?.id, open]);

  // Load token balances and user's family currency
  useEffect(() => {
    if (!user?.walletAddress || !user?.family?.currencyAddress || !open) return;
    (async () => {
      setIsLoading(true);
      try {
        const familyCurrency = availableTokens.find(
          t => t.contract.toLowerCase() === user.family?.currencyAddress?.toLowerCase() || ''
        );
        if (familyCurrency) setUserCurrency(familyCurrency.symbol);

        const balances = await getMultiTokenBalances(user.walletAddress || '');
        const tokensWithValues = await Promise.all(
          availableTokens.map(async (token, idx) => {
            const bal = balances[idx] || 0;
            let valueInStablecoin = 0;
            if (bal > 0 && familyCurrency) {
              try {
                const rate = await getExchangeRate(token.contract, familyCurrency.contract);
                valueInStablecoin = bal * rate;
              } catch (_) {
                console.error(`Error getting rate for ${token.symbol}`);
              }
            }
            return { ...token, balance: bal, valueInStablecoin };
          })
        );
        const filtered = tokensWithValues
          .filter(t => t.balance > 0)
          .sort((a, b) => b.valueInStablecoin - a.valueInStablecoin);
        setTokensWithBalances(filtered);
        if (filtered.length > 0 && !selectedToken) {
          setSelectedToken(filtered[0]);
        }
      } catch (err) {
        console.error('Error loading tokens:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user?.walletAddress, user?.family?.currencyAddress, open]);

  // Load family wallet address
  useEffect(() => {
    if (!user?.family?.parentId || !open) return;
    (async () => {
      try {
        const addr = await getUserAddress(user?.family?.parentId || '');
        if (addr) setFamilyWalletAddress(addr);
      } catch (err) {
        console.error('Error loading family wallet:', err);
      }
    })();
  }, [user?.family?.parentId, open]);

  const formatAddress = (addr: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');

  const getNickname = (addr: string) => {
    return permissions.recipientNicknames?.[addr.toLowerCase()] || '';
  };

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast({
        title: 'Address copied',
        description: 'Your wallet address has been copied',
      });
    }
  };

  // Pure predicate: no side-effects
  const isRecipientValid = (): boolean => {
    if (!recipient) return false;
    if (!ethers.isAddress(recipient)) return false;

    // If crypto transfers are disabled but family wallet is enabled,
    // only allow sending to family wallet
    if (!permissions.cryptoTransferEnabled && permissions.includeFamilyWallet) {
      return !!familyWalletAddress && recipient.toLowerCase() === familyWalletAddress.toLowerCase();
    }

    // If there are allowed addresses specified, recipient must be in the list
    if (
      permissions.allowedRecipientAddresses.length > 0 &&
      !permissions.allowedRecipientAddresses.some(a => a.toLowerCase() === recipient.toLowerCase())
    )
      return false;

    // If no allowed addresses are specified, any valid Ethereum address is acceptable
    return true;
  };

  // Handle Next button logic
  const handleNext = () => {
    if (step === 1) {
      if (!selectedToken) {
        setError('Please select a token to send');
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (!recipient) {
        setError('Please select a recipient');
        return;
      }
      if (!ethers.isAddress(recipient)) {
        setError('Please enter a valid Ethereum address');
        return;
      }
      if (
        permissions.allowedRecipientAddresses.length > 0 &&
        !permissions.allowedRecipientAddresses.some(
          a => a.toLowerCase() === recipient.toLowerCase()
        )
      ) {
        setError('You can only send to approved recipients');
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      handleSendTransaction();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  const resetDialog = () => {
    setStep(1);
    setAmount(0);
    setRecipient('');
    setSelectedToken(tokensWithBalances[0] || null);
    setIsComplete(false);
    setTxHash('');
    setError(null);
    setActiveTab('my-wallet');
  };

  const handleSendTransaction = async () => {
    if (!user?.id || !selectedToken || !recipient) return;
    // Validate amount
    if (amount <= 0 || amount > selectedToken.balance) {
      setError(`Invalid amount for ${selectedToken.symbol}`);
      return;
    }
    setIsSending(true);
    setError(null);

    try {
      if (nickname === '') {
        setNickname(recipient);
      }
      console.log(nickname);
      const result = await sendTokens(user.id, selectedToken.symbol, amount, recipient, nickname);
      if (result.status === 200) {
        setTxHash(result.txHash || 'unknown');
        setIsComplete(true);
        setTimeout(() => {
          setIsComplete(false);
          setStep(1);
          setOpen(false);
        }, 20000);
      } else {
        setError(result.message || 'Transaction failed');
      }
    } catch (err) {
      console.error('Error sending transaction:', err);
      setError('Failed to send transaction. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={newOpen => {
        setOpen(newOpen);
        if (!newOpen) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={!permissions.cryptoTransferEnabled && !permissions.includeFamilyWallet}
          className="flex items-center gap-2 text-sm bg-white/20 hover:bg-white/30 text-white border-0"
        >
          <Wallet className="h-4 w-4" />
          Wallet
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-[#fff1d6] text-[#b74b28] max-h-[80vh] overflow-y-scroll">
        {!isComplete ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center">
                {activeTab === 'my-wallet' && 'My Wallet'}
                {activeTab === 'send' && step === 1 && 'Select Token & Amount'}
                {activeTab === 'send' && step === 2 && 'Recipient Address'}
                {activeTab === 'send' && step === 3 && 'Confirm Transfer'}
              </DialogTitle>
              <DialogDescription className="text-center pt-2">
                {activeTab === 'my-wallet'}
                {activeTab === 'send' && step === 1 && 'Choose which token and how much to send'}
                {activeTab === 'send' && step === 2 && "Enter the recipient's wallet address"}
                {activeTab === 'send' && step === 3 && 'Verify all details before sending'}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="my-wallet">My Wallet</TabsTrigger>
                <TabsTrigger
                  value="send"
                  disabled={!permissions.cryptoTransferEnabled && !permissions.includeFamilyWallet}
                >
                  Send
                </TabsTrigger>
              </TabsList>

              {/* My Wallet Tab */}
              <TabsContent value="my-wallet" className="space-y-4 py-2">
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div
                      className="flex flex-col items-center space-y-4 p-4 text-white rounded-lg border-2 border-black shadow-yellow-700"
                      style={{
                        backgroundImage:
                          'linear-gradient(to right, rgb(59, 130, 246), rgb(6, 182, 212))',
                      }}
                    >
                      <div className="p-2 bg-white rounded-lg">
                        {walletAddress && (
                          <QRCode value={walletAddress} size={180} className="rounded-md" />
                        )}
                      </div>
                      <div className="flex flex-col items-center">
                        <p className="text-sm text-muted-foreground mb-1">Your Wallet Address</p>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center gap-1">
                            <img src="/base.png" alt="Base Logo" className="h-4 w-4" />
                          </div>
                          <code className="text-xs bg-slate-400 px-2 py-1 rounded">
                            {walletAddress ? formatAddress(walletAddress) : 'Loading...'}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={handleCopyAddress}
                            disabled={!walletAddress}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {permissions.cryptoTransferEnabled && (
                        <Button
                          onClick={() => setActiveTab('send')}
                          variant="default"
                          className="mt-2 w-full"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium">Your Balances</h3>
                      <div className="space-y-2 overflow-y-auto px-2">
                        {tokensWithBalances.length > 0 ? (
                          tokensWithBalances.map(token => (
                            <div
                              key={token.contract}
                              className="flex items-center justify-between p-3 text-white rounded-lg border-2 border-black shadow-yellow-700"
                              style={{
                                backgroundImage:
                                  'linear-gradient(to right, rgb(59, 130, 246), rgb(6, 182, 212))',
                              }}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                                  {token.image ? (
                                    <img
                                      src={token.image}
                                      alt={token.symbol}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Coins className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{token.symbol}</p>
                                  <p className="text-xs text-muted-foreground">{token.name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{token.balance.toFixed(4)}</p>
                                <p className="text-xs text-[#fff1d6]">
                                  <Currency amount={token.valueInStablecoin} />
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No tokens found in your wallet
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Send Tab */}
              <TabsContent value="send">
                {step === 1 && (
                  <div className="space-y-6">
                    {/* Token Selector */}
                    <div className="space-y-3">
                      <Label htmlFor="token" className="text-base">
                        Select Token
                      </Label>
                      <div className="grid max-h-[200px] overflow-y-auto gap-2">
                        {tokensWithBalances.map(token => (
                          <div
                            key={token.contract}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border-2 transition-all ${
                              selectedToken?.contract === token.contract
                                ? 'border-primary bg-primary/5'
                                : 'border-transparent'
                            }`}
                            onClick={() => {
                              setSelectedToken(token);
                              setAmount(0);
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-full overflow-hidden bg-white flex items-center justify-center">
                                {token.image ? (
                                  <img
                                    src={token.image}
                                    alt={token.symbol}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Coins className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{token.symbol}</p>
                                <p className="text-xs text-muted-foreground">{token.name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{token.balance.toFixed(4)}</p>
                              <div className="text-xs text-muted-foreground">
                                <Currency amount={token.valueInStablecoin} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Amount Input */}
                    {selectedToken && (
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between">
                          <Label htmlFor="amount" className="text-base">
                            Amount
                          </Label>
                          <span className="font-medium">
                            {amount > 0 ? amount.toString() : '0'} {selectedToken.symbol}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            value={amount === 0 ? '' : amount}
                            onChange={e => {
                              const value = e.target.value;
                              // Only update if the value is a valid number or empty
                              if (value === '' || !isNaN(parseFloat(value))) {
                                setAmount(value === '' ? 0 : parseFloat(value));
                              }
                            }}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Available: {selectedToken.balance.toFixed(4)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 p-0 underline"
                              onClick={() => setAmount(Number(selectedToken.balance.toFixed(6)))}
                            >
                              Max
                            </Button>
                          </div>
                        </div>
                        {permissions.maxTransferAmount && (
                          <div className="text-xs text-muted-foreground">
                            Maximum transfer limit:{' '}
                            <Currency amount={permissions.maxTransferAmount} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="recipient" className="text-base">
                        Recipient Address
                      </Label>
                      <div className="relative">
                        <Input
                          id="recipient"
                          placeholder="Enter wallet address (0x...)"
                          value={recipient}
                          onChange={e => {
                            // Only allow direct input if no specific addresses are required
                            if (
                              permissions.allowedRecipientAddresses.length === 0 &&
                              permissions.cryptoTransferEnabled
                            ) {
                              setRecipient(e.target.value);
                              // Clear any existing nickname
                              setNickname('');
                            }
                          }}
                          disabled={
                            permissions.allowedRecipientAddresses.length > 0 ||
                            !permissions.cryptoTransferEnabled
                          }
                          className="pl-10 text-white placeholder:text-white/70"
                        />
                        <Wallet className="absolute left-3 top-2.5 h-5 w-5 text-white" />
                      </div>

                      <div className="mt-4 space-y-2">
                        <Label className="text-sm">Select Recipient</Label>
                        <div className="grid max-h-[200px] overflow-y-auto gap-2 px-2">
                          {permissions.includeFamilyWallet && familyWalletAddress && (
                            <Button
                              variant="outline"
                              className="justify-between py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-2 border-black shadow-[#000000] overflow-hidden"
                              onClick={() => {
                                setRecipient(familyWalletAddress);
                                setNickname('Parent');
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <div className="text-left">
                                  <div className="text-sm">Parent</div>
                                  <div className="text-xs truncate max-w-[180px]">
                                    {formatAddress(familyWalletAddress)}
                                  </div>
                                </div>
                              </div>
                              <ExternalLink className="h-3 w-3 opacity-70" />
                            </Button>
                          )}

                          {permissions.cryptoTransferEnabled &&
                          permissions.allowedRecipientAddresses.length > 0
                            ? permissions.allowedRecipientAddresses.map((addr, idx) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  className={`justify-between py-2 overflow-hidden ${
                                    recipient === addr ? 'border-2 border-black' : ''
                                  }`}
                                  onClick={() => {
                                    setRecipient(addr);
                                    setNickname(getNickname(addr));
                                  }}
                                >
                                  <div className="text-left">
                                    {getNickname(addr) && (
                                      <div className="text-sm">{getNickname(addr)}</div>
                                    )}
                                    <span className="text-xs truncate max-w-[180px]">
                                      {formatAddress(addr)}
                                    </span>
                                  </div>
                                  <ExternalLink className="h-3 w-3 opacity-50" />
                                </Button>
                              ))
                            : null}
                        </div>
                      </div>
                    </div>

                    {permissions.cryptoTransferEnabled ? (
                      permissions.allowedRecipientAddresses.length > 0 ? (
                        <div className="bg-white/20 text-yellow-600 backdrop-blur-sm border-2 border-black p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <h3 className="font-medium">Restricted Transfers</h3>
                          </div>
                          <p className="text-sm mt-1">
                            You can only send to the approved wallet addresses listed above.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-blue-50/50 text-blue-700 backdrop-blur-sm border-2 border-blue-200 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            <h3 className="font-medium">Send to Any Address</h3>
                          </div>
                          <p className="text-sm mt-1">
                            You can send to any valid Ethereum address. Make sure to verify the
                            address is correct before sending.
                          </p>
                        </div>
                      )
                    ) : permissions.includeFamilyWallet ? (
                      <div className="bg-white/20 text-yellow-600 backdrop-blur-sm border-2 border-black p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <h3 className="font-medium">Parents Wallet Only</h3>
                        </div>
                        <p className="text-sm mt-1">
                          You can only send crypto to your parents wallet at this time.
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}

                {step === 3 && selectedToken && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg border-2 border-black shadow-yellow-700">
                      <div className="flex justify-between mb-3">
                        <span className="text-muted-foreground">From:</span>
                        <div className="flex items-center">
                          <span className="text-sm">{formatAddress(walletAddress)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={handleCopyAddress}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between mb-3">
                        <span className="text-muted-foreground">To:</span>
                        <span className="text-sm">{formatAddress(recipient)}</span>
                      </div>
                      <div className="flex justify-between mb-3">
                        <span className="text-muted-foreground">Amount:</span>
                        <div className="text-right">
                          <div>
                            {amount > 0 ? amount.toString() : '0'} {selectedToken.symbol}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <Currency
                              amount={
                                (amount / selectedToken.balance) * selectedToken.valueInStablecoin
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/20 backdrop-blur-sm border-2 border-black text-yellow-600 p-4 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <h3 className="font-medium">Important!</h3>
                      </div>
                      <p className="text-sm mt-1">
                        Cryptocurrency transfers are irreversible. Please verify the recipient
                        address and amount before sending.
                      </p>
                    </div>

                    {error && (
                      <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Footer with Next / Send Now */}
            {activeTab === 'send' && (
              <DialogFooter className="flex sm:justify-between">
                {step > 1 ? (
                  <Button variant="ghost" onClick={handleBack} disabled={isSending}>
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                <Button
                  variant={step === 3 ? 'outline' : 'outline'}
                  onClick={handleNext}
                  disabled={
                    isSending ||
                    (step === 1 &&
                      (!selectedToken || amount <= 0 || amount > selectedToken.balance)) ||
                    (step === 2 && !isRecipientValid())
                  }
                  className={step === 3 ? 'bg-black' : ''}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : step === 3 ? (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Now
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            )}
          </>
        ) : (
          <div className="py-12 flex flex-col items-center">
            <div className="rounded-full bg-green-900 p-3 mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Transfer Complete!</h2>
            <p className="text-center text-muted-foreground mb-6">
              You've successfully sent {amount} {selectedToken?.symbol} to{' '}
              {formatAddress(recipient)}
            </p>
            <div className="w-full rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Transaction Hash</p>
              <div className="flex items-center justify-center gap-2">
                <p className="font-mono text-xs truncate max-w-[200px]">
                  {txHash || 'Transaction pending...'}
                </p>
                {txHash && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      navigator.clipboard.writeText(txHash);
                      toast({
                        title: 'Copied to clipboard',
                        description: 'Transaction hash copied',
                      });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {txHash && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 h-6 text-xs"
                  onClick={() => window.open(`https://basescan.org/tx/${txHash}`, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View on BaseScan
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
