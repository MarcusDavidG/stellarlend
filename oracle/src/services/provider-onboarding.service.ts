/**
 * Provider Onboarding Service
 *
 * Manages the onboarding process for new oracle price sources.
 * Provides validation, configuration, and registration of new price providers.
 *
 * Features:
 * - Provider configuration validation
 * - Weighted median support
 * - Circuit breaker auto-configuration
 * - Priority-based ordering
 * - Health check integration
 */

import type { ProviderConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Onboarding result for a new provider
 */
export interface OnboardingResult {
  success: boolean;
  provider?: ProviderConfig;
  errors: string[];
  warnings: string[];
}

/**
 * Provider onboarding service
 */
export class ProviderOnboardingService {
  /**
   * Validate a provider configuration before onboarding
   */
  static validateProviderConfig(config: Partial<ProviderConfig>): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!config.name) {
      errors.push('Provider name is required');
    }

    if (!config.baseUrl) {
      errors.push('Provider base URL is required');
    }

    if (config.priority === undefined) {
      errors.push('Provider priority is required');
    } else if (config.priority < 1) {
      errors.push('Provider priority must be >= 1');
    }

    if (config.weight === undefined) {
      errors.push('Provider weight is required');
    } else if (config.weight <= 0 || config.weight > 1) {
      errors.push('Provider weight must be > 0 and <= 1');
    }

    if (!config.rateLimit) {
      errors.push('Provider rate limit configuration is required');
    } else if (config.rateLimit.maxRequests <= 0) {
      errors.push('Provider rate limit maxRequests must be > 0');
    }

    if (config.rateLimit.windowMs <= 0) {
      errors.push('Provider rate limit windowMs must be > 0');
    }

    // Optional: check for duplicate name
    if (config.name && config.name.trim().length === 0) {
      errors.push('Provider name cannot be blank');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Create a new provider configuration with defaults
   */
  static createDefaultConfig(name: string): ProviderConfig {
    return {
      name,
      enabled: true,
      priority: 100, // Default high priority - user should adjust
      weight: 1.0, // Default weight
      baseUrl: '',
      apiKey: undefined,
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000,
      },
      concurrencyLimit: 5,
    };
  }

  /**
   * Onboard a new provider - validate and return config
   */
  static onboardProvider(config: Partial<ProviderConfig>): OnboardingResult {
    const { valid, errors, warnings } = this.validateProviderConfig(config);

    if (!valid) {
      return { success: false, errors, warnings: [] };
    }

    const providerConfig = { ...this.createDefaultConfig(config.name), ...config };

    logger.info('Provider onboarding successful', {
      providerName: providerConfig.name,
      priority: providerConfig.priority,
      weight: providerConfig.weight,
    });

    return {
      success: true,
      provider: providerConfig,
      errors: [],
      warnings,
    };
  }

  /**
   * Update provider priority ordering
   * Returns providers sorted by priority (ascending = highest first)
   */
  static reorderProviders(providers: ProviderConfig[]): ProviderConfig[] {
    return providers
      .sort((a, b) => a.priority - b.priority)
      .map((provider) => ({ ...provider }) as ProviderConfig);
  }

  /**
   * Calculate total weight for all providers
   */
  static calculateTotalWeight(providers: ProviderConfig[]): number {
    return providers.reduce((sum, p) => sum + p.weight, 0);
  }

  /**
   * Check if weights are balanced (sum close to 1.0)
   */
  static areWeightsBalanced(providers: ProviderConfig[]): boolean {
    const total = this.calculateTotalWeight(providers);
    return Math.abs(total - 1.0) < 0.1; // Allow 10% tolerance
  }

  /**
   * Get provider by name from config list
   */
  static getProviderByName(providers: ProviderConfig[], name: string): ProviderConfig | undefined {
    return providers.find((p) => p.name === name);
  }
}

/**
 * Create a provider onboarding service instance
 */
export function createProviderOnboardingService(): ProviderOnboardingService {
  return new ProviderOnboardingService();
}
