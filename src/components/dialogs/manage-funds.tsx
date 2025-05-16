'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Minus, Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { base } from 'viem/chains';
import { parseEther } from 'viem';
import { useAuth } from '@/contexts/authContext';
import { Token, Symbol } from '@/components/shared/currency-symbol';
import { toast } from 'react-toastify';
import { useAccount, useSignMessage } from 'wagmi';
import { withdrawalFunds } from '@/server/crypto/withdrawal';

// form validation schema
const MAX_DECIMALS = 5;
const MIN_VALUE = 1 / Math.pow(10, MAX_DECIMALS); // e.g., 0.00001
const decimalCheck = (val: string) => {
  if (val === '' || isNaN(Number(val))) return false;
  if (val.toLowerCase().includes('e')) return false; // block scientific notation
  const parts = val.split('.');
  if (parts.length > 1 && parts[1].length > MAX_DECIMALS) return false;
  // block values smaller than allowed precision (e.g., 0.000001)
  if (Number(val) > 0 && Number(val) < MIN_VALUE) return false;
  return true;
};

const formSchema = z.object({
  amount: z
    .string()
    .refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Amount must be a non-negative number',
    })
    .refine(decimalCheck, {
      message: `Amount must be a valid number, have at most ${MAX_DECIMALS} decimal places, not be scientific notation, and not less than ${MIN_VALUE}`,
    }),
  eth: z
    .string()
    .refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'ETH must be a non-negative number',
    })
    .refine(decimalCheck, {
      message: `ETH must be a valid number, have at most ${MAX_DECIMALS} decimal places, not be scientific notation, and not less than ${MIN_VALUE}`,
    }),
});

const ManageFunds = () => {
  const [value, setValue] = useState<string>('');
  const [ethValue, setEthValue] = useState<string>('0.0001');
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'add' | 'withdrawal'>('add');
  const { user, stableBalance } = useAuth();
  const { isConnected } = useAccount();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: '', eth: '0.0001' },
    mode: 'onChange',
  });

  // switch to the async version of signMessage
  //@ts-ignore
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('amount', e.target.value, { shouldValidate: true });
    setValue(e.target.value);
  };

  const handleEthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('eth', e.target.value, { shouldValidate: true });
    setEthValue(e.target.value);
  };

  const handleWithdrawal = async () => {
    // validate form
    const valid = await form.trigger('amount');
    if (!valid || Number(value) <= 0 || Number(value) > (stableBalance ?? 0)) {
      toast.error('Invalid withdrawal amount or insufficient balance.');
      return;
    }
    if (!isConnected) {
      toast.error('Please connect your wallet first.');
      return;
    }

    const message = `Please sign this message to confirm your intent to withdraw ${value} units. This is not a transaction and will not cost gas.`;

    try {
      // opens the wallet, waits for the user to sign
      const signature = await signMessageAsync({ message });
      console.log('Message signed successfully. Signature:', signature);
      console.log('Withdrawal amount requested:', value);
      if (user?.id) {
        withdrawalFunds(user.id, value.toString());
      }
      toast.success(`Withdrawal for ${value} sent!`);
      // TODO: replace the console.logs above with your actual transfer logic
      form.reset();
      setValue('');
      // setOpen(false); // optionally close drawer
    } catch (error: any) {
      console.error('Failed to sign message:', error);
      toast.error('Failed to sign message');
    }
  };

  // deposit logic unchanged...
  const transactionCalls = React.useMemo(() => {
    if (!user?.familyAddress || !user?.family?.currencyAddress) {
      return [];
    }
    const calls = [];
    // Only include ETH transfer if ethValue > 0
    if (activeTab === 'add' && ethValue && Number(ethValue) > 0) {
      calls.push({
        to: user.familyAddress,
        value: parseEther(ethValue),
      });
    }
    // Only include stablecoin transfer if value > 0
    if (activeTab === 'add' && value && Number(value) > 0) {
      calls.push({
        address: user?.family?.currencyAddress,
        functionName: 'transfer',
        abi: [
          {
            inputs: [
              { internalType: 'address', name: 'recipient', type: 'address' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
            ],
            name: 'transfer',
            outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        args: [user?.familyAddress, parseEther(value)],
      });
    }
    return calls;
  }, [user, value, ethValue, activeTab]);

  const isWithdrawalDisabled =
    !value ||
    Number(value) <= 0 ||
    Number(value) > (stableBalance ?? 0) ||
    !form.formState.isValid ||
    isSigning;
  const isDepositDisabled = !form.formState.isValid || transactionCalls.length === 0;

  useEffect(() => {
    form.reset({ amount: '', eth: '0.0001' });
    setValue('');
    setEthValue('0.0001');
  }, [activeTab, form]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <Wallet className="mr-2 h-4 w-4" />
          Manage Funds
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-transparent backdrop-blur-xl">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Manage Funds</DrawerTitle>
            <DrawerDescription>
              {activeTab === 'add'
                ? 'Deposit crypto to your account'
                : `Withdraw crypto from your account. Available: ${stableBalance}`}
            </DrawerDescription>
          </DrawerHeader>

          <Tabs
            value={activeTab}
            onValueChange={v => setActiveTab(v as any)}
            className="w-full mx-auto p-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add">
                <Plus className="mr-2 h-4 w-4" />
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdrawal">
                <Minus className="mr-2 h-4 w-4" />
                Withdraw
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form className="space-y-6 p-4 mb-24 mt-24">
                {/* Stablecoin input */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {activeTab === 'add'
                          ? 'Stablecoin Amount to Deposit'
                          : 'Amount to Withdraw'}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Symbol className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            className="pl-10 pr-18"
                            {...field}
                            onChange={handleAmountChange}
                          />
                          <Token className="absolute right-10 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormMessage />
                      {activeTab === 'withdrawal' && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Available balance: {stableBalance}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
                {/* ETH input, only for deposit */}
                {activeTab === 'add' && (
                  <FormField
                    control={form.control}
                    name="eth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ETH to Deposit (used for gas fees)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground">
                              Ξ
                            </span>
                            <Input
                              id="amount"
                              type="number"
                              placeholder="0.00"
                              className="pl-10 pr-18"
                              {...field}
                              onChange={handleEthChange}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground pt-1">
                          ETH is required for gas fees. Default: 0.0001 ETH.
                        </p>
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end space-x-2 mt-8">
                  {activeTab === 'add' && (
                    // @ts-ignore
                    <Transaction chainId={base.id} calls={transactionCalls}>
                      <TransactionButton
                        className="border-[2px] rounded-md h-12 bg-[rgba(255,241,214,0.95)] text-[#B74B28] border-black shadow-yellow-700 shadow-[-5px_6px_0px_#000000] hover:shadow-[-2px_3px_0px_#000000] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                        text="Deposit"
                        disabled={isDepositDisabled}
                      />
                      <TransactionStatus>
                        <TransactionStatusLabel />
                        <TransactionStatusAction />
                      </TransactionStatus>
                    </Transaction>
                  )}

                  {activeTab === 'withdrawal' && (
                    <Button
                      type="button"
                      onClick={handleWithdrawal}
                      disabled={isWithdrawalDisabled}
                      className="border-[2px] w-full rounded-md h-12 bg-[rgba(255,241,214,0.95)] text-[#B74B28] border-black shadow-yellow-700 shadow-[-5px_6px_0px_#000000] hover:shadow-[-2px_3px_0px_#000000] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                      {isSigning ? 'Signing...' : 'Withdraw'}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ManageFunds;
