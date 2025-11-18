import { ConfigOption } from './UserSelection';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface SelectionSummaryProps {
  selectedUser?: ConfigOption;
  selectedNetwork: string | null;
  selectedWallet: string | null;
  onUserClick?: () => void;
  onNetworkClick?: () => void;
  onWalletClick?: () => void;
}

export function SelectionSummary({
  selectedUser,
  selectedNetwork,
  selectedWallet,
  onUserClick,
  onNetworkClick,
  onWalletClick,
}: SelectionSummaryProps) {
  if (!selectedUser && !selectedNetwork && !selectedWallet) return null;

  const renderItem = (
    label: string,
    value: string | null | undefined,
    onClick?: () => void,
    icon?: React.ReactNode
  ) => {
    if (!value) return null;

    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--cds-text-tertiary)] uppercase tracking-wider hidden sm:inline-block">
          {label}:
        </span>
        <Badge 
          variant="neutral" 
          size="md" 
          className={`bg-white border border-[var(--cds-border)] ${onClick ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors group' : ''}`}
        >
          <span 
             onClick={onClick} 
             className="flex items-center gap-1.5 font-medium text-[var(--cds-text-primary)]"
          >
            {icon}
            {value}
            {onClick && (
               <svg className="w-3 h-3 text-[var(--cds-text-tertiary)] group-hover:text-[var(--cds-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
               </svg>
            )}
          </span>
        </Badge>
      </div>
    );
  };

  return (
    <Card padding="sm" className="mb-8 bg-gray-50/50 border-dashed">
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
        {renderItem('Network', selectedNetwork, onNetworkClick)}
        {renderItem('Task', selectedWallet, onWalletClick)}
        {renderItem('Profile', selectedUser?.displayName, onUserClick)}
      </div>
    </Card>
  );
}
