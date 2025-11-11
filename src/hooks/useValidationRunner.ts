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

  const setErrorState = useCallback((message: string) => {
    setState({
      status: 'error',
      error: message,
      result: null,
    });
  }, []);

  const runValidation = useCallback(async (): Promise<ValidationData | null> => {
    if (isRunningRef.current) {
      return null;
    }

    isRunningRef.current = true;
    setState({
      status: 'installing-deps',
      error: null,
      result: null,
    });

    try {
      console.log(`🔍 Checking dependencies for ${network.toLowerCase()}/${upgradeId}`);
      const depsResponse = await fetch('/api/install-deps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          network: network.toLowerCase(),
          upgradeId,
        }),
      });

      const depsResult = await depsResponse.json();

      if (!depsResult.success) {
        const message = `ValidationResults::handleRunValidation: install-deps api returned an error: ${depsResult.error}`;
        setErrorState(message);
        return null;
      }

      if (depsResult.depsInstalled) {
        console.log(
          `✅ Dependencies installed successfully for ${network.toLowerCase()}/${upgradeId}`
        );
      }

      console.log('Running validation with options:', {
        upgradeId,
        network,
        userType,
      });

      setState(prev => ({
        ...prev,
        status: 'running',
      }));

      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upgradeId,
          network: network.toLowerCase(),
          userType,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        const message = `ValidationResults::handleRunValidation: validate api returned an error: ${
          result.error || 'Validation failed'
        }`;
        setErrorState(message);
        console.error('Validation failed:', result.error);
        return null;
      }

      console.log('Validation completed successfully');

      setState({
        status: 'success',
        error: null,
        result: result.data as ValidationData,
      });

      return result.data as ValidationData;
    } catch (err) {
      const message = `ValidationResults::handleRunValidation: error running validation: ${
        err instanceof Error ? err.message : 'Network error occurred'
      }`;
      setErrorState(message);
      console.error('Validation error:', err);
      return null;
    } finally {
      isRunningRef.current = false;
    }
  }, [network, setErrorState, upgradeId, userType]);

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
