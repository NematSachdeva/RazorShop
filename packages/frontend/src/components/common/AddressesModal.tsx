import React, { useState, useEffect } from 'react';
import { CustomerAddress, AddressPayload, frontendAddressService } from '../../services/addressService';
import { AddressFormModal } from './AddressFormModal';

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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Saved Delivery Addresses</h3>
              <p className="text-xs text-slate-400">Manage your saved shipping addresses for faster checkout</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* List Content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                <span>Loading saved addresses...</span>
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-slate-400">
                  📍
                </div>
                <p className="text-sm font-medium text-slate-300">No saved addresses yet</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Add a delivery address to prefill your shipping details during checkout.
                </p>
              </div>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-xl border transition-all ${
                    addr.is_default
                      ? 'bg-blue-950/30 border-blue-500/50 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100">{addr.full_address}</span>
                        {addr.is_default && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {addr.state} — {addr.pin_code}
                      </p>
                      {addr.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <span>📞</span> {addr.phone}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!addr.is_default && (
                        <button
                          onClick={(e) => handleSetDefault(addr.id, e)}
                          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
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
                        className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/40 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(addr.id, e)}
                        className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
            <button
              onClick={() => {
                setEditingAddress(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5"
            >
              <span>+ Add New Address</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl transition-colors"
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
