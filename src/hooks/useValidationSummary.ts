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
}

export const useValidationSummary = (validationResult: ValidationData | null): ValidationSummary =>
  useMemo(() => {
    const itemsByStep = buildValidationItems(validationResult);
    const navList = buildNavList(itemsByStep);
    const blockingErrorsExist = hasBlockingErrors(itemsByStep);
    const stepCounts = getStepCounts(itemsByStep);

    return {
      itemsByStep,
      navList,
      blockingErrorsExist,
      stepCounts,
    };
  }, [validationResult]);
