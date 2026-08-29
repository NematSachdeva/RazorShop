/**
 * PaymentSimulator - Inject deterministic failures for testing recovery flows
 */

export type FailureScenario = 
  | 'failure_network'
  | 'failure_declined'
  | 'failure_timeout'
  | 'failure_insufficient_funds'
  | 'failure_3ds_failed';

export interface SimulatedFailure {
  scenario: FailureScenario;
  reason: string;
  shouldRetry: boolean;
  recoverableBy: string[];
}

export class PaymentSimulator {
  private static scenarios: Record<FailureScenario, SimulatedFailure> = {
    failure_network: {
      scenario: 'failure_network',
      reason: 'network_error',
      shouldRetry: true,
      recoverableBy: ['retry_payment', 'offer_discount', 'contact_customer'],
    },
    failure_declined: {
      scenario: 'failure_declined',
      reason: 'card_declined',
      shouldRetry: true,
      recoverableBy: ['offer_discount', 'contact_customer', 'escalate'],
    },
    failure_timeout: {
      scenario: 'failure_timeout',
      reason: 'timeout',
      shouldRetry: true,
      recoverableBy: ['retry_payment', 'contact_customer'],
    },
    failure_insufficient_funds: {
      scenario: 'failure_insufficient_funds',
      reason: 'insufficient_funds',
      shouldRetry: true,
      recoverableBy: ['offer_discount', 'contact_customer'],
    },
    failure_3ds_failed: {
      scenario: 'failure_3ds_failed',
      reason: '3ds_authentication_failed',
      shouldRetry: false,
      recoverableBy: ['offer_discount', 'contact_customer', 'escalate'],
    },
  };

  /**
   * Get failure scenario details
   */
  static getScenario(scenario: FailureScenario): SimulatedFailure {
    return this.scenarios[scenario];
  }

  /**
   * Inject failure into payment flow for testing
   */
  static shouldInjectFailure(demoParam?: string): { scenario: FailureScenario; failure: SimulatedFailure } | null {
    if (!demoParam) {
      return null;
    }

    const scenario = demoParam as FailureScenario;
    if (scenario in this.scenarios) {
      return {
        scenario,
        failure: this.scenarios[scenario],
      };
    }

    return null;
  }

  /**
   * Get all available scenarios for documentation
   */
  static getAllScenarios(): Record<FailureScenario, SimulatedFailure> {
    return this.scenarios;
  }
}

export default PaymentSimulator;
