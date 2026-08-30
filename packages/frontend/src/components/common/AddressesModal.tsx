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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity font-sans"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <IconMapPin className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">Saved Delivery Addresses</h3>
                <p className="text-xs text-gray-500">Manage your saved shipping addresses for faster checkout</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {/* List Content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-500 text-xs font-medium">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                <span>Loading saved addresses...</span>
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mx-auto text-gray-400 shadow-xs border border-gray-200">
                  <IconMapPin className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-bold text-gray-800">No saved addresses yet</p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Add a delivery address to prefill your shipping details during checkout.
                </p>
              </div>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-xl border transition-all ${
                    addr.is_default
                      ? 'bg-blue-50/50 border-blue-300 shadow-xs'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{addr.full_address}</span>
                        {addr.is_default && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 rounded-md">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        {addr.state} — {addr.pin_code}
                      </p>
                      {addr.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 pt-0.5">
                          <IconPhone className="w-3.5 h-3.5" />
                          <span>{addr.phone}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!addr.is_default && (
                        <button
                          onClick={(e) => handleSetDefault(addr.id, e)}
                          className="px-2.5 py-1 text-xs text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-semibold"
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
                        className="px-2.5 py-1 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(addr.id, e)}
                        className="px-2.5 py-1 text-xs text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors font-bold flex items-center gap-1"
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
          <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={() => {
                setEditingAddress(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <IconPlus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
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
