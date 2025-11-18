import { ConfigOption } from './UserSelection';
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

  const renderBadge = (
    label: string | null | undefined,
    options: { onClick?: () => void; title: string }
  ) => {
    if (!label) return null;

    const { onClick, title } = options;
    const content = label;

    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-200 hover:shadow-md focus-ring"
          title={title}
        >
          {content}
        </button>
      );
    }

    return (
      <Badge variant="info" className="px-4 py-2">
        {content}
      </Badge>
    );
  };

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <h3 className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
        Current Selection
      </h3>
      <div className="flex flex-wrap justify-center gap-3">
        {selectedNetwork && renderBadge(selectedNetwork, {
          onClick: onNetworkClick,
          title: 'Click to change network',
        })}
        {selectedWallet && renderBadge(selectedWallet, {
          onClick: onWalletClick,
          title: 'Click to change task',
        })}
        {selectedUser?.displayName && renderBadge(selectedUser.displayName, {
          onClick: onUserClick,
          title: 'Click to change profile',
        })}
      </div>
    </div>
  );
}
