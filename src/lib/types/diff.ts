type DiffChangeType = 'added' | 'removed' | 'unchanged';

export interface StringDiff {
  type: DiffChangeType;
  value: string;
}
