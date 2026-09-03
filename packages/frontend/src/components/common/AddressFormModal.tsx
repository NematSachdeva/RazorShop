import React, { useState, useEffect } from 'react';
import { CustomerAddress, AddressPayload } from '../../services/addressService';
import { IconClose } from './Icons';

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: AddressPayload) => Promise<void>;
  initialAddress?: CustomerAddress | null;
  title?: string;
}

export const AddressFormModal: React.FC<AddressFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAddress,
  title = 'Add Delivery Address',
}) => {
  const [fullAddress, setFullAddress] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialAddress) {
      setFullAddress(initialAddress.full_address || '');
      setState(initialAddress.state || '');
      setPinCode(initialAddress.pin_code || '');
      setPhone(initialAddress.phone || '');
      setIsDefault(initialAddress.is_default || false);
    } else {
      setFullAddress('');
      setState('');
      setPinCode('');
      setPhone('');
      setIsDefault(false);
    }
    setError(null);
  }, [initialAddress, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedAddress = fullAddress.trim();
    const trimmedState = state.trim();
    const trimmedPin = pinCode.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedAddress) {
      setError('Please enter your full street address');
      return;
    }
    if (!trimmedState) {
      setError('Please enter state');
      return;
    }
    if (!trimmedPin || !/^[0-9A-Za-z\s-]{3,10}$/.test(trimmedPin)) {
      setError('Please enter a valid PIN / Postal code');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        full_address: trimmedAddress,
        state: trimmedState,
        pin_code: trimmedPin,
        phone: trimmedPhone || undefined,
        is_default: isDefault,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs transition-opacity font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 themed"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          color: 'var(--c-text)',
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--c-border-soft)' }}>
          <h3 className="text-lg font-bold font-display" style={{ color: 'var(--c-text)' }}>
            {initialAddress ? 'Edit Delivery Address' : title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl transition-colors cursor-pointer"
            style={{
              background: 'var(--c-surface2)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-muted)',
            }}
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: 'var(--c-status-red-bg)', border: '1px solid var(--c-border-soft)', color: 'var(--c-status-red-text)' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1 font-display" style={{ color: 'var(--c-text-dim)' }}>
              Full Street Address <span style={{ color: 'var(--c-status-red-text)' }}>*</span>
            </label>
            <textarea
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              placeholder="House/Flat No., Street, Area, Landmark"
              rows={3}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all resize-none font-medium themed"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 font-display" style={{ color: 'var(--c-text-dim)' }}>
                State <span style={{ color: 'var(--c-status-red-text)' }}>*</span>
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State (e.g. Maharashtra)"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all font-medium themed"
                style={{
                  background: 'var(--c-surface2)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 font-display" style={{ color: 'var(--c-text-dim)' }}>
                PIN Code <span style={{ color: 'var(--c-status-red-text)' }}>*</span>
              </label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="6-digit PIN code"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all font-medium themed"
                style={{
                  background: 'var(--c-surface2)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text)',
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 font-display" style={{ color: 'var(--c-text-dim)' }}>
              Contact Phone (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit Mobile Number"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all font-medium themed"
              style={{
                background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_default"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: 'var(--c-gold)' }}
            />
            <label htmlFor="is_default" className="text-xs font-semibold cursor-pointer font-display" style={{ color: 'var(--c-text)' }}>
              Set as default delivery address
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl transition-colors font-display cursor-pointer"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold rounded-xl shadow-sm transition-all font-display cursor-pointer"
              style={{ background: 'var(--c-gold)', color: '#0a0908' }}
            >
              {isSubmitting ? 'Saving...' : initialAddress ? 'Save Changes' : 'Add Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
