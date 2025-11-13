import { ConfigOption } from './UserSelection';

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

  const renderBadge = (
    label: string | null | undefined,
    onClick?: () => void
  ) => {
    if (!label) return null;

    const baseClasses = 'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors';

    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`${baseClasses} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300`}
        >
          {label}
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      );
    }

    return (
      <span className={`${baseClasses} border-slate-200 bg-slate-50 text-slate-700`}>
        {label}
      </span>
    );
  };

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Selected
      </div>
      <div className="flex flex-wrap gap-2">
        {renderBadge(selectedNetwork, onNetworkClick)}
        {renderBadge(selectedWallet, onWalletClick)}
        {renderBadge(selectedUser?.displayName, onUserClick)}
      </div>
    </div>
  );
}
