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
    'inline-flex items-center gap-1 text-white px-3.5 py-1.5 rounded-full text-sm font-medium shadow-[0_2px_4px_rgba(99,102,241,0.3)] transition-all duration-200';
  const clickableBadgeClasses = `${badgeBaseClasses} bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-100`;
  const nonClickableBadgeClasses = `${badgeBaseClasses} bg-gradient-to-r from-indigo-500 to-violet-500`;

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
    <div className="mb-8 rounded-2xl border border-white/20 bg-indigo-50/50 p-5 backdrop-blur-lg">
      <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-600">
        Your Selections
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
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
