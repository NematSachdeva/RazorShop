import React, { useState, useEffect } from 'react';
import { CustomerAddress, AddressPayload, frontendAddressService } from '../../services/addressService';
import { AddressFormModal } from './AddressFormModal';
import { IconMapPin, IconClose, IconPlus, IconPhone, IconTrash } from './Icons';

interface AddressesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddressesModal: React.FC<AddressesModalProps> = ({ isOpen, onClose }) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await frontendAddressService.listAddresses();
      setAddresses(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAddresses();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAddress = async (payload: AddressPayload) => {
    if (editingAddress) {
      await frontendAddressService.updateAddress(editingAddress.id, payload);
    } else {
      await frontendAddressService.createAddress(payload);
    }
    await loadAddresses();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this address?')) {
      try {
        await frontendAddressService.deleteAddress(id);
        await loadAddresses();
      } catch (err: any) {
        setError(err.message || 'Failed to delete address');
      }
    }
  };

  const handleSetDefault = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await frontendAddressService.setDefaultAddress(id);
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || 'Failed to set default address');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs transition-opacity font-sans"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col themed"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--c-border-soft)' }}>
            <div className="flex items-center gap-2.5">
              <IconMapPin className="w-5 h-5 text-[var(--c-gold)]" />
              <div>
                <h3 className="text-lg font-bold font-display" style={{ color: 'var(--c-text)' }}>Saved Delivery Addresses</h3>
                <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Manage your saved shipping addresses for faster checkout</p>
              </div>
            </div>
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

          {/* List Content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-xs font-medium" style={{ color: 'var(--c-muted)' }}>
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mr-2" style={{ borderColor: 'var(--c-gold)' }} />
                <span>Loading saved addresses...</span>
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-12 space-y-3 rounded-2xl border border-dashed" style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-xs border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                  <IconMapPin className="w-6 h-6 text-[var(--c-muted)]" />
                </div>
                <p className="text-sm font-bold font-display" style={{ color: 'var(--c-text)' }}>No saved addresses yet</p>
                <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--c-muted)' }}>
                  Add a delivery address to prefill your shipping details during checkout.
                </p>
              </div>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-4 rounded-xl border transition-all themed"
                  style={{
                    background: addr.is_default ? 'var(--c-gold-dim)' : 'var(--c-surface2)',
                    borderColor: addr.is_default ? 'var(--c-gold)' : 'var(--c-border)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm font-display" style={{ color: 'var(--c-text)' }}>{addr.full_address}</span>
                        {addr.is_default && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md font-display" style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--c-gold)' }}>
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--c-text-dim)' }}>
                        {addr.state} — {addr.pin_code}
                      </p>
                      {addr.phone && (
                        <p className="text-xs flex items-center gap-1.5 pt-0.5" style={{ color: 'var(--c-muted)' }}>
                          <IconPhone className="w-3.5 h-3.5" />
                          <span>{addr.phone}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!addr.is_default && (
                        <button
                          onClick={(e) => handleSetDefault(addr.id, e)}
                          className="px-2.5 py-1 text-xs rounded-lg transition-colors font-semibold font-display cursor-pointer"
                          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
                        >
                          Make Default
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAddress(addr);
                          setIsFormOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg transition-colors font-bold font-display cursor-pointer"
                        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-gold)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(addr.id, e)}
                        className="px-2.5 py-1 text-xs rounded-lg transition-colors font-bold flex items-center gap-1 font-display cursor-pointer"
                        style={{ background: 'var(--c-status-red-bg)', border: '1px solid var(--c-border-soft)', color: 'var(--c-status-red-text)' }}
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t flex justify-between items-center" style={{ borderColor: 'var(--c-border-soft)' }}>
            <button
              onClick={() => {
                setEditingAddress(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 font-display cursor-pointer"
              style={{ background: 'var(--c-gold)', color: '#0a0908' }}
            >
              <IconPlus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl transition-colors font-display cursor-pointer"
              style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text-dim)' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <AddressFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveAddress}
        initialAddress={editingAddress}
      />
    </>
  );
};
