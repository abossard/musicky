/**
 * Performance Monitoring Utility
 * 
 * Simple, production-ready performance tracking following
 * "A Philosophy of Software Design" principles:
 * - Deep module hiding implementation complexity
 * - Simple interface for performance measurement
 * - Information hiding of internal metrics details
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  average: number;
  min: number;
  max: number;
  count: number;
  total: number;
}

/**
 * Centralized performance monitoring service
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private enabled: boolean = process.env.NODE_ENV === 'production';
  private maxMetrics: number = 1000; // Prevent memory leaks

  /**
   * Measure async operation performance
   */
  async measure<T>(name: string, operation: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    if (!this.enabled) {
      return await operation();
    }

    const startTime = performance.now();
    const timestamp = new Date();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        name,
        duration,
        timestamp,
        metadata: { ...metadata, success: true }
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        name,
        duration,
        timestamp,
        metadata: { ...metadata, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      throw error;
    }
  }

  /**
   * Measure sync operation performance
   */
  measureSync<T>(name: string, operation: () => T, metadata?: Record<string, any>): T {
    if (!this.enabled) {
      return operation();
    }

    const startTime = performance.now();
    const timestamp = new Date();
    
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        name,
        duration,
        timestamp,
        metadata: { ...metadata, success: true }
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        name,
        duration,
        timestamp,
        metadata: { ...metadata, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      throw error;
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getStats(operationName: string): PerformanceStats | null {
    const metrics = this.metrics.filter(m => m.name === operationName);
    
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration);
    const total = durations.reduce((sum, d) => sum + d, 0);
    
    return {
      average: total / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      count: durations.length,
      total
    };
  }

  /**
   * Get all performance data for monitoring dashboard
   */
  getAllStats(): Record<string, PerformanceStats> {
    const operations = [...new Set(this.metrics.map(m => m.name))];
    const stats: Record<string, PerformanceStats> = {};
    
    for (const operation of operations) {
      const operationStats = this.getStats(operation);
      if (operationStats) {
        stats[operation] = operationStats;
      }
    }
    
    return stats;
  }

  /**
   * Get recent slow operations (> 1 second)
   */
  getSlowOperations(thresholdMs: number = 1000): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > thresholdMs)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20); // Top 20 slowest
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  cleanup(): void {
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      stats: this.getAllStats(),
      slowOperations: this.getSlowOperations(),
      totalMetrics: this.metrics.length
    }, null, 2);
  }

  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Cleanup old metrics periodically
    if (this.metrics.length % 100 === 0) {
      this.cleanup();
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatic performance measurement
 */
export function measurePerformance(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operationName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return await performanceMonitor.measure(
        operationName,
        () => originalMethod.apply(this, args),
        { className: target.constructor.name, method: propertyKey }
      );
    };

    return descriptor;
  };
}

/**
 * Simple timing utility for manual measurements
 */
export class Timer {
  private startTime: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
  }

  end(metadata?: Record<string, any>): number {
    const duration = performance.now() - this.startTime;
    
    performanceMonitor.measureSync(
      this.name,
      () => duration,
      metadata
    );
    
    return duration;
  }
}

/**
 * React hook for performance monitoring in components
 */
import { useEffect, useRef } from 'react';

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    
    performanceMonitor.measureSync(
      `React.${componentName}.render`,
      () => renderTime,
      { component: componentName, type: 'render' }
    );
  });

  return {
    measureOperation: (name: string, operation: () => Promise<any>) =>
      performanceMonitor.measure(`${componentName}.${name}`, operation),
    
    startTimer: (name: string) => new Timer(`${componentName}.${name}`)
  };
}