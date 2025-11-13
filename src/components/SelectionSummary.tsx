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
    'inline-flex items-center gap-2 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg transition-all duration-300 relative overflow-hidden';
  const clickableBadgeClasses = `${badgeBaseClasses} bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-700 hover:via-pink-700 hover:to-amber-600 hover:-translate-y-1 hover:shadow-xl hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2`;
  const nonClickableBadgeClasses = `${badgeBaseClasses} bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500`;

  const renderBadge = (
    label: string | null | undefined,
    options: { onClick?: () => void; icon?: string; title: string }
  ) => {
    if (!label) return null;

    const { onClick, icon, title } = options;
    const content = (
      <>
        {icon ? <span>{icon}</span> : null}
        {label}
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
    <div className="mb-8 rounded-2xl border border-purple-200/50 bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-amber-50/80 p-6 backdrop-blur-xl shadow-lg ring-1 ring-white/50">
      <h3 className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-purple-700">
        Your Selections
      </h3>
      <div className="flex flex-wrap justify-center gap-3">
        {renderBadge(selectedNetwork, {
          onClick: onNetworkClick,
          icon: '🌐',
          title: 'Click to change network selection',
        })}
        {renderBadge(selectedWallet, {
          onClick: onWalletClick,
          title: 'Click to change wallet selection',
        })}
        {renderBadge(selectedUser?.displayName, {
          onClick: onUserClick,
          title: 'Click to change user selection',
        })}
      </div>
    </div>
  );
}
