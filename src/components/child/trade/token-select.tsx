import { Check, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TokenSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    id: number;
    contract: string;
    name: string;
    symbol: string;
    decimals: number;
    image: string;
  }>;
  disabled?: boolean;
}

export function TokenSelect({ value, onChange, options, disabled = false }: TokenSelectProps) {
  // Find the selected token object
  const selectedToken = options.find(token => token.contract === value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[110px]" disabled={disabled}>
        <SelectValue placeholder="Select token">
          <div className="flex items-center">
            {selectedToken ? (
              <>
                <TokenImage image={selectedToken.image} symbol={selectedToken.symbol} />
                <span className="ml-2 font-medium truncate max-w-[60px]">
                  {selectedToken.symbol}
                </span>
              </>
            ) : (
              <span>Select</span>
            )}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(token => (
          <SelectItem key={token.id} value={token.contract}>
            <div className="flex items-center">
              <TokenImage image={token.image} symbol={token.symbol} />
              <span className="ml-2 truncate max-w-[100px]">{token.symbol}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface TokenImageProps {
  image: string;
  symbol: string;
}

function TokenImage({ image, symbol }: TokenImageProps) {
  return (
    <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center">
      {image ? (
        <img src={image} alt={symbol} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-blue-500">
          {symbol.substring(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}
