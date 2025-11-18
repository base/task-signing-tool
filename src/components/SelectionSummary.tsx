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
    options: { onClick?: () => void; icon?: string; title: string }
  ) => {
    if (!label) return null;

    const { onClick, icon, title } = options;
    const baseClasses = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150';
    
    const content = (
      <>
        {icon && <span className="text-base">{icon}</span>}
        <span>{label}</span>
      </>
    );

    if (onClick) {
      return (
        <button 
          type="button" 
          onClick={onClick} 
          className={`${baseClasses} hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
          title={title}
          style={{
            background: 'var(--cb-primary-light)',
            color: 'var(--cb-primary)',
            border: '1px solid var(--cb-primary)',
            boxShadow: 'var(--cb-shadow-sm)'
          }}
        >
          {content}
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      );
    }

    return (
      <span 
        className={baseClasses}
        style={{
          background: 'var(--cb-surface)',
          color: 'var(--cb-text-secondary)',
          border: '1px solid var(--cb-border)'
        }}
      >
        {content}
      </span>
    );
  };

  return (
    <div 
      className="mb-8 rounded-xl p-5" 
      style={{ 
        background: 'var(--cb-surface)',
        border: '1px solid var(--cb-border)',
        boxShadow: 'var(--cb-shadow-sm)'
      }}
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cb-text-tertiary)' }}>
        Current Selection
      </div>
      <div className="flex flex-wrap gap-2">
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
