import { useCallback, useRef, useState } from 'react';

import { ValidationData } from '@/lib/types';

type RunnerStatus = 'idle' | 'installing-deps' | 'running' | 'success' | 'error';

interface ValidationRunnerParams {
  network: string;
  upgradeId: string;
  userType: string;
}

interface ValidationRunnerState {
  status: RunnerStatus;
  error: string | null;
  result: ValidationData | null;
}

const INITIAL_STATE: ValidationRunnerState = {
  status: 'idle',
  error: null,
  result: null,
};

const toErrorState = (message: string): ValidationRunnerState => ({
  status: 'error',
  error: message,
  result: null,
});

type InstallDepsResponse = {
  success: boolean;
  error?: string;
  depsInstalled?: boolean;
};

type ValidateResponse = {
  success: boolean;
  error?: string;
  data?: ValidationData;
};

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json() as Promise<T>;
};

interface UseValidationRunnerReturn extends ValidationRunnerState {
  runValidation: () => Promise<ValidationData | null>;
  reset: () => void;
  isLoading: boolean;
  isInstallingDeps: boolean;
}

export const useValidationRunner = ({
  network,
  upgradeId,
  userType,
}: ValidationRunnerParams): UseValidationRunnerReturn => {
  const [state, setState] = useState<ValidationRunnerState>(INITIAL_STATE);
  const isRunningRef = useRef(false);

  const runValidation = useCallback(async (): Promise<ValidationData | null> => {
    if (isRunningRef.current) {
      return null;
    }

    isRunningRef.current = true;
    const networkSlug = network.toLowerCase();

    setState({
      status: 'installing-deps',
      error: null,
      result: null,
    });

    try {
      console.log(`🔍 Checking dependencies for ${networkSlug}/${upgradeId}`);
      const depsResult = await postJson<InstallDepsResponse>('/api/install-deps', {
        network: networkSlug,
        upgradeId,
      });

      if (!depsResult.success) {
        setState(
          toErrorState(`install-deps failed: ${depsResult.error ?? 'Unknown error occurred'}`)
        );
        return null;
      }

      if (depsResult.depsInstalled) {
        console.log(`✅ Dependencies installed successfully for ${networkSlug}/${upgradeId}`);
      }

      console.log('Running validation with options:', {
        upgradeId,
        network,
        userType,
      });

      setState({
        status: 'running',
        error: null,
        result: null,
      });

      const validationResult = await postJson<ValidateResponse>('/api/validate', {
        upgradeId,
        network: networkSlug,
        userType,
      });

      if (!validationResult.success) {
        setState(toErrorState(`validate failed: ${validationResult.error ?? 'Validation failed'}`));
        console.error('Validation failed:', validationResult.error);
        return null;
      }

      if (!validationResult.data) {
        setState(toErrorState('validate failed: missing data in response'));
        console.error('Validation failed: missing data in response');
        return null;
      }

      console.log('Validation completed successfully');

      setState({
        status: 'success',
        error: null,
        result: validationResult.data as ValidationData,
      });

      return validationResult.data as ValidationData;
    } catch (err) {
      console.error('Validation error:', err);
      setState(
        toErrorState(
          `validation error: ${err instanceof Error ? err.message : 'Network error occurred'}`
        )
      );
      return null;
    } finally {
      isRunningRef.current = false;
    }
  }, [network, upgradeId, userType]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    runValidation,
    reset,
    isLoading: state.status === 'installing-deps' || state.status === 'running',
    isInstallingDeps: state.status === 'installing-deps',
  };
};
