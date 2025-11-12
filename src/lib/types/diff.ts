export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface StringDiff {
  type: DiffChangeType;
  value: string;
}
