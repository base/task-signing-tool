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
    options: { onClick?: () => void; title: string }
  ) => {
    if (!label) return null;

    const { onClick, title } = options;

    const baseClasses =
      'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all';

    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
        title={title}
      >
        {label}
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    ) : (
      <span className={`${baseClasses} border-gray-200 bg-gray-50 text-gray-700`}>{label}</span>
    );
  };

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Current Selection
      </div>
      <div className="flex flex-wrap gap-2">
        {renderBadge(selectedNetwork, {
          onClick: onNetworkClick,
          title: 'Change network',
        })}
        {renderBadge(selectedWallet, {
          onClick: onWalletClick,
          title: 'Change task',
        })}
        {renderBadge(selectedUser?.displayName, {
          onClick: onUserClick,
          title: 'Change profile',
        })}
      </div>
    </div>
  );
}
