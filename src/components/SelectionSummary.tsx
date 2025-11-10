import type { FC } from 'react';
import { ConfigOption } from './UserSelection';

interface SelectionSummaryProps {
  selectedUser?: ConfigOption;
  selectedNetwork: string | null;
  selectedWallet: string | null;
  onUserClick?: () => void;
  onNetworkClick?: () => void;
  onWalletClick?: () => void;
}

export const SelectionSummary: FC<SelectionSummaryProps> = ({
  selectedUser,
  selectedNetwork,
  selectedWallet,
  onUserClick,
  onNetworkClick,
  onWalletClick,
}) => {
  if (!selectedUser && !selectedNetwork && !selectedWallet) return null;

  const badgeBaseClasses =
    'inline-flex items-center gap-1 text-white px-3.5 py-1.5 rounded-full text-sm font-medium shadow-[0_2px_4px_rgba(99,102,241,0.3)] transition-all duration-200';
  const clickableBadgeClasses = `${badgeBaseClasses} bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-100`;
  const nonClickableBadgeClasses = `${badgeBaseClasses} bg-gradient-to-r from-indigo-500 to-violet-500`;

  return (
    <div className="mb-8 rounded-2xl border border-white/20 bg-indigo-50/50 p-5 backdrop-blur-lg">
      <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-600">
        Your Selections
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {/* NEW ORDER: Network, Upgrade, User */}

        {selectedNetwork &&
          (onNetworkClick ? (
            <button
              type="button"
              onClick={onNetworkClick}
              className={clickableBadgeClasses}
              title="Click to change network selection"
            >
              <span>🌐</span>
              {selectedNetwork}
            </button>
          ) : (
            <span className={nonClickableBadgeClasses}>
              <span>🌐</span>
              {selectedNetwork}
            </span>
          ))}

        {selectedWallet &&
          (onWalletClick ? (
            <button
              type="button"
              onClick={onWalletClick}
              className={clickableBadgeClasses}
              title="Click to change upgrade selection"
            >
              {selectedWallet}
            </button>
          ) : (
            <span className={nonClickableBadgeClasses}>{selectedWallet}</span>
          ))}

        {selectedUser &&
          (onUserClick ? (
            <button
              type="button"
              onClick={onUserClick}
              className={clickableBadgeClasses}
              title="Click to change user selection"
            >
              {selectedUser.displayName}
            </button>
          ) : (
            <span className={nonClickableBadgeClasses}>{selectedUser.displayName}</span>
          ))}
      </div>
    </div>
  );
};
