import { useState, useCallback } from 'react';

// Higher-order function for async operations with state management
export function useAsyncState<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

// Higher-order function for operations that need error handling
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  onError?: (error: string) => void
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      onError?.(errorMsg);
      return null;
    }
  };
}

// Higher-order function for operations that trigger refresh
export function withRefresh<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  refreshFn?: () => void | Promise<void>
) {
  return async (...args: T): Promise<R> => {
    const result = await fn(...args);
    await refreshFn?.();
    return result;
  };
}

// Compose multiple async operations
export function composeAsync<T>(...fns: Array<() => Promise<T>>): () => Promise<T[]> {
  return () => Promise.all(fns.map(fn => fn()));
}