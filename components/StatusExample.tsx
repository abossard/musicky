import { useStatus } from '../hooks/useStatus';
import { useEffect } from 'react';

/**
 * Example component showing how to use the status context
 * This component automatically updates the status when mounted
 */
export function StatusExample() {
  const { setStatus } = useStatus();

  useEffect(() => {
    // Set status when component mounts
    setStatus("Component Loaded", "green");

    // Cleanup - reset to ready when unmounting
    return () => {
      setStatus("Ready", "green");
    };
  }, [setStatus]);

  const handleAsyncOperation = async () => {
    setStatus("Loading data...", "blue");
    
    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStatus("Data loaded successfully", "green");
    } catch (error) {
      setStatus("Failed to load data", "red");
    }
  };

  return (
    <div>
      <h3>Status Example Component</h3>
      <button onClick={handleAsyncOperation}>
        Simulate Async Operation
      </button>
    </div>
  );
}
