/**
 * Centralized Error Handling
 * 
 * Following "A Philosophy of Software Design":
 * - Single responsibility for error management
 * - Consistent error interface across the app
 * - Information hiding of error details
 */

export interface AppError {
  id: string;
  message: string;
  details?: string;
  timestamp: Date;
  type: 'network' | 'validation' | 'file' | 'audio' | 'unknown';
  recoverable: boolean;
}

export type ErrorHandler = (error: AppError) => void;

/**
 * Centralized error management service
 */
class ErrorManager {
  private handlers: ErrorHandler[] = [];
  private errors: AppError[] = [];

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index >= 0) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Report an error
   */
  reportError(error: unknown, context?: string): AppError {
    const appError = this.createAppError(error, context);
    this.errors.push(appError);
    this.notifyHandlers(appError);
    return appError;
  }

  /**
   * Get all errors
   */
  getErrors(): AppError[] {
    return [...this.errors];
  }

  /**
   * Clear specific error
   */
  clearError(id: string): void {
    this.errors = this.errors.filter(e => e.id !== id);
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.errors = [];
  }

  private createAppError(error: unknown, context?: string): AppError {
    const id = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    
    if (error instanceof Error) {
      return {
        id,
        message: this.formatErrorMessage(error.message, context),
        details: error.stack,
        timestamp,
        type: this.classifyError(error),
        recoverable: this.isRecoverable(error)
      };
    }
    
    return {
      id,
      message: this.formatErrorMessage(String(error), context),
      timestamp,
      type: 'unknown',
      recoverable: true
    };
  }

  private formatErrorMessage(message: string, context?: string): string {
    if (context) {
      return `${context}: ${message}`;
    }
    return message;
  }

  private classifyError(error: Error): AppError['type'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    
    if (message.includes('file') || message.includes('path') || message.includes('permission')) {
      return 'file';
    }
    
    if (message.includes('audio') || message.includes('codec') || message.includes('playback')) {
      return 'audio';
    }
    
    return 'unknown';
  }

  private isRecoverable(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Non-recoverable errors
    if (message.includes('permission denied') || 
        message.includes('not found') ||
        message.includes('corrupt')) {
      return false;
    }
    
    // Most errors are recoverable with retry
    return true;
  }

  private notifyHandlers(error: AppError): void {
    this.handlers.forEach(handler => {
      try {
        handler(error);
      } catch (e) {
        console.error('Error handler failed:', e);
      }
    });
  }
}

// Singleton instance
export const errorManager = new ErrorManager();

/**
 * Higher-order function to wrap async operations with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = errorManager.reportError(error, context);
      throw appError;
    }
  };
}

/**
 * Hook for using error manager in React components
 */
import { useState, useEffect } from 'react';

export function useErrors() {
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(() => {
    const updateErrors = () => {
      setErrors(errorManager.getErrors());
    };

    updateErrors();
    const unsubscribe = errorManager.onError(updateErrors);
    
    return unsubscribe;
  }, []);

  return {
    errors,
    clearError: errorManager.clearError.bind(errorManager),
    clearAllErrors: errorManager.clearAllErrors.bind(errorManager)
  };
}