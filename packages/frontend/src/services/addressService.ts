import { getApiUrl } from '../config/api';
import { authService } from './authService';

export interface CustomerAddress {
  id: string;
  customer_id: string;
  full_address: string;
  state: string;
  pin_code: string;
  phone?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressPayload {
  full_address: string;
  state: string;
  pin_code: string;
  phone?: string;
  is_default?: boolean;
}

class AddressService {
  async listAddresses(): Promise<CustomerAddress[]> {
    const response = await fetch(getApiUrl('/addresses'), {
      headers: {
        ...authService.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch saved addresses');
    }

    return response.json();
  }

  async getDefaultAddress(): Promise<CustomerAddress | null> {
    const response = await fetch(getApiUrl('/addresses/default'), {
      headers: {
        ...authService.getAuthHeader(),
      },
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      throw new Error('Failed to fetch default address');
    }

    return response.json();
  }

  async createAddress(payload: AddressPayload): Promise<CustomerAddress> {
    const response = await fetch(getApiUrl('/addresses'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save address');
    }

    return response.json();
  }

  async updateAddress(id: string, payload: Partial<AddressPayload>): Promise<CustomerAddress> {
    const response = await fetch(getApiUrl(`/addresses/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update address');
    }

    return response.json();
  }

  async setDefaultAddress(id: string): Promise<CustomerAddress> {
    const response = await fetch(getApiUrl(`/addresses/${id}/default`), {
      method: 'PUT',
      headers: {
        ...authService.getAuthHeader(),
      },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to set default address');
    }

    return response.json();
  }

  async deleteAddress(id: string): Promise<void> {
    const response = await fetch(getApiUrl(`/addresses/${id}`), {
      method: 'DELETE',
      headers: {
        ...authService.getAuthHeader(),
      },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete address');
    }
  }
}

export const frontendAddressService = new AddressService();
