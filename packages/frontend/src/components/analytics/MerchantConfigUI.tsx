/**
 * MerchantConfigUI Component (M8)
 * Allows merchant to view and update configuration/guard rails
 */

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';

interface MerchantConfig {
  id: string;
  merchant_id: string;
  max_recovery_attempts: number;
  max_discount_percent: number;
  allowed_channels: string[];
  max_promise_days: number;
  ai_insights_enabled: boolean;
  bundle_recommendations_enabled: boolean;
  discount_strategy_enabled: boolean;
  inventory_opt_enabled: boolean;
  recovery_targeting_enabled: boolean;
  min_confidence_score: number;
}

export default function MerchantConfigUI() {
  const [config, setConfig] = useState<MerchantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<Partial<MerchantConfig>>({});

  const channelOptions = ['email', 'sms', 'whatsapp'];

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getApiUrl('/merchant/config'), {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load config');
      }

      const data: MerchantConfig = await response.json();
      setConfig(data);
      setFormState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleNumberChange = (field: keyof MerchantConfig, value: string) => {
    const num = parseInt(value);
    setFormState((prev) => ({ ...prev, [field]: num }));
  };

  const handleBoolChange = (field: keyof MerchantConfig, value: boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleChannelToggle = (channel: string) => {
    const current = (formState.allowed_channels || []) as string[];
    if (current.includes(channel)) {
      setFormState((prev) => ({
        ...prev,
        allowed_channels: current.filter((c) => c !== channel),
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        allowed_channels: [...current, channel],
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(getApiUrl('/merchant/config'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save config');
      }

      const updated: MerchantConfig = await response.json();
      setConfig(updated);
      setFormState(updated);
      setSuccess('Configuration saved successfully!');

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setFormState(config);
      setError(null);
      setSuccess(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded shadow p-6 mb-8">
        <p className="text-center text-gray-600">Loading configuration...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-white rounded shadow p-6 mb-8">
        <p className="text-center text-red-600">Failed to load configuration</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow p-6 mb-8">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Merchant Configuration</h2>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Recovery Attempts */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Max Recovery Attempts
          </label>
          <div className="flex gap-2 items-end">
            <input
              type="number"
              min="1"
              max="20"
              value={formState.max_recovery_attempts || 3}
              onChange={(e) => handleNumberChange('max_recovery_attempts', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
            />
            <span className="text-xs text-gray-500">(1-20)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Maximum attempts to recover a payment</p>
        </div>

        {/* Max Discount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Max Discount Percent
          </label>
          <div className="flex gap-2 items-end">
            <input
              type="number"
              min="0"
              max="100"
              value={formState.max_discount_percent || 30}
              onChange={(e) => handleNumberChange('max_discount_percent', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
            />
            <span className="text-xs text-gray-500">(%)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Maximum discount for recovery offers</p>
        </div>

        {/* Promise Days */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Max Promise-to-Pay Days
          </label>
          <div className="flex gap-2 items-end">
            <input
              type="number"
              min="1"
              max="90"
              value={formState.max_promise_days || 30}
              onChange={(e) => handleNumberChange('max_promise_days', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
            />
            <span className="text-xs text-gray-500">(1-90)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Maximum days for promise deadline</p>
        </div>

        {/* Confidence Score */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Min AI Confidence Score
          </label>
          <div className="flex gap-2 items-end">
            <input
              type="number"
              min="0"
              max="100"
              value={formState.min_confidence_score || 70}
              onChange={(e) => handleNumberChange('min_confidence_score', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
            />
            <span className="text-xs text-gray-500">(%)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum confidence for AI recommendations</p>
        </div>
      </div>

      {/* Channels */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Allowed Recovery Channels
        </label>
        <div className="space-y-2">
          {channelOptions.map((channel) => (
            <label key={channel} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={(formState.allowed_channels || []).includes(channel)}
                onChange={() => handleChannelToggle(channel)}
                className="w-4 h-4 rounded"
              />
              <span className="capitalize">{channel}</span>
            </label>
          ))}
        </div>
      </div>

      {/* AI Features */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Feature Toggles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              key: 'ai_insights_enabled',
              label: 'Daily AI Insights',
              description: 'Generate daily merchant insights',
            },
            {
              key: 'bundle_recommendations_enabled',
              label: 'Bundle Recommendations',
              description: 'AI product bundle suggestions',
            },
            {
              key: 'discount_strategy_enabled',
              label: 'Discount Strategy',
              description: 'AI discount recommendations',
            },
            {
              key: 'inventory_opt_enabled',
              label: 'Inventory Optimization',
              description: 'AI inventory insights',
            },
            {
              key: 'recovery_targeting_enabled',
              label: 'Recovery Targeting',
              description: 'AI recovery campaign targeting',
            },
          ].map((feature) => (
            <label key={feature.key} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={(formState as any)[feature.key] || false}
                onChange={(e) => handleBoolChange(feature.key as keyof MerchantConfig, e.target.checked)}
                className="w-4 h-4 mt-1 rounded"
              />
              <div>
                <p className="font-semibold text-gray-900">{feature.label}</p>
                <p className="text-xs text-gray-600">{feature.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-6 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> These settings control AI merchant intelligence features and recovery constraints. Changes are applied immediately.
        </p>
      </div>
    </div>
  );
}
