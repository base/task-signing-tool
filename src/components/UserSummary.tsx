import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ConfigOption } from './UserSelection';

interface UserSummaryProps {
  selectedUser: ConfigOption | undefined;
  onChange?: () => void;
}

export function UserSummary({ selectedUser, onChange }: UserSummaryProps) {
  if (!selectedUser) return null;

  return (
    <Card padding="sm" className="mb-8 bg-gray-50/50 border-dashed">
      <div className="flex items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-[var(--cds-primary)] text-white flex items-center justify-center font-bold">
            {selectedUser.displayName.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-[var(--cds-text-primary)]">
              {selectedUser.displayName}
            </h3>
            <p className="text-xs text-[var(--cds-text-secondary)] font-mono mt-0.5">
              {selectedUser.fileName}
            </p>
          </div>
        </div>
        {onChange && (
          <Button variant="ghost" size="sm" onClick={onChange} className="shrink-0">
            Change
          </Button>
        )}
      </div>
    </Card>
  );
}
