import { useMemo } from 'react';

import { ValidationData, ValidationItemsByStep } from '@/lib/types';
import {
  buildNavList,
  buildValidationItems,
  getStepCounts,
  hasBlockingErrors,
  ValidationNavEntry,
  StepCounts,
} from '@/lib/validation-results-utils';

interface ValidationSummary {
  itemsByStep: ValidationItemsByStep;
  navList: ValidationNavEntry[];
  blockingErrorsExist: boolean;
  stepCounts: StepCounts;
  taskOriginFailed: boolean;
  taskOriginDisabled: boolean;
}

export const useValidationSummary = (validationResult: ValidationData | null): ValidationSummary =>
  useMemo(() => {
    const itemsByStep = buildValidationItems(validationResult);
    const navList = buildNavList(itemsByStep);
    const blockingErrorsExist = hasBlockingErrors(itemsByStep);
    const stepCounts = getStepCounts(itemsByStep);

    // Determine task origin validation state
    const taskOriginItem = itemsByStep.taskOrigin[0];
    const taskOriginDisabled = taskOriginItem?.isDisabled ?? false;
    const taskOriginFailed = !taskOriginDisabled && taskOriginItem ? !taskOriginItem.allPassed : false;

    return {
      itemsByStep,
      navList,
      blockingErrorsExist,
      stepCounts,
      taskOriginFailed,
      taskOriginDisabled,
    };
  }, [validationResult]);
