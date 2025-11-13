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

  const badgeBaseClasses =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200';
  const clickableBadgeClasses = `${badgeBaseClasses} bg-blue-100 text-blue-700 hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`;
  const nonClickableBadgeClasses = `${badgeBaseClasses} bg-gray-100 text-gray-700`;

  const renderBadge = (
    label: string | null | undefined,
    options: { onClick?: () => void; icon?: string; title: string }
  ) => {
    if (!label) return null;

    const { onClick, icon, title } = options;
    const content = (
      <>
        {icon ? <span className="text-base">{icon}</span> : null}
        <span>{label}</span>
        {onClick && (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </>
    );

    return onClick ? (
      <button type="button" onClick={onClick} className={clickableBadgeClasses} title={title}>
        {content}
      </button>
    ) : (
      <span className={nonClickableBadgeClasses}>{content}</span>
    );
  };

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Current:
        </span>
        {renderBadge(selectedNetwork, {
          onClick: onNetworkClick,
          icon: '🌐',
          title: 'Click to change network',
        })}
        {renderBadge(selectedWallet, {
          onClick: onWalletClick,
          title: 'Click to change task',
        })}
        {renderBadge(selectedUser?.displayName, {
          onClick: onUserClick,
          title: 'Click to change profile',
        })}
      </div>
    </div>
  );
}
