import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/authContext';

interface CurrencyProps {
  amount: number | null;
  className?: string;
}

interface SymbolProps {
  className?: string;
}

interface TokenProps {
  className?: string;
}

const getCurrencySymbol = (currency: string | undefined): string => {
  if (!currency) return '';

  switch (currency) {
    case 'USDC':
      return '$';
    case 'EURC':
      return '€';
    case 'CADC':
      return '$';
    case 'BRZ':
      return 'R$';
    case 'IDRX':
      return 'Rp';
    default:
      console.log('currency', currency);
      throw new Error('Unsupported currency selected');
  }
};

export const Currency: React.FC<CurrencyProps> = ({ amount, className = '' }) => {
  const { user } = useAuth();
  const [currencySymbol, setCurrencySymbol] = useState<string>('');

  useEffect(() => {
    if (!user?.family?.currency) return;
    setCurrencySymbol(getCurrencySymbol(user.family.currency));
  }, [user?.family?.currency]);

  // Handle null or undefined amount values safely
  const formattedAmount = amount !== null && amount !== undefined ? amount.toFixed(2) : '0.00';
  return (
    <div className={className}>
      {currencySymbol}
      {formattedAmount} {user?.family?.currency || '...'}
    </div>
  );
};

export const Symbol: React.FC<SymbolProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const [currencySymbol, setCurrencySymbol] = useState<string>('');

  useEffect(() => {
    if (!user?.family?.currency) return;
    setCurrencySymbol(getCurrencySymbol(user.family.currency));
  }, [user?.family?.currency]);

  return <div className={className}>{currencySymbol}</div>;
};

export const Token: React.FC<TokenProps> = ({ className = '' }) => {
  const { user } = useAuth();

  return <div className={className}>{user?.family?.currency || '...'}</div>;
};
