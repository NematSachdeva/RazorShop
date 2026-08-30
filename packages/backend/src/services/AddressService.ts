import { DataSource, Repository } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { CustomerAddress } from '../models/CustomerAddress.js';

export interface CreateAddressDTO {
  full_address: string;
  state: string;
  pin_code: string;
  phone?: string;
  is_default?: boolean;
}

export interface UpdateAddressDTO {
  full_address?: string;
  state?: string;
  pin_code?: string;
  phone?: string;
  is_default?: boolean;
}

export class AddressService {
  constructor(private dataSource: DataSource = AppDataSource) {}

  private getAddressRepo(): Repository<CustomerAddress> {
    return this.dataSource.getRepository(CustomerAddress);
  }

  async listAddresses(customerId: string): Promise<CustomerAddress[]> {
    return this.getAddressRepo().find({
      where: { customer_id: customerId },
      order: { is_default: 'DESC', created_at: 'DESC' },
    });
  }

  async getAddressById(addressId: string, customerId: string): Promise<CustomerAddress | null> {
    return this.getAddressRepo().findOne({
      where: { id: addressId, customer_id: customerId },
    });
  }

  async getDefaultAddress(customerId: string): Promise<CustomerAddress | null> {
    let address = await this.getAddressRepo().findOne({
      where: { customer_id: customerId, is_default: true },
    });

    if (!address) {
      // Fallback to most recent address if no explicit default is set
      address = await this.getAddressRepo().findOne({
        where: { customer_id: customerId },
        order: { created_at: 'DESC' },
      });
    }

    return address;
  }

  async createAddress(customerId: string, dto: CreateAddressDTO): Promise<CustomerAddress> {
    const full_address = (dto.full_address || '').trim();
    const state = (dto.state || '').trim();
    const pin_code = (dto.pin_code || '').trim();
    const phone = dto.phone ? dto.phone.trim() : undefined;

    if (!full_address) {
      throw new Error('Full address is required');
    }
    if (!state) {
      throw new Error('State is required');
    }
    if (!pin_code || !/^[0-9A-Za-z\s-]{3,10}$/.test(pin_code)) {
      throw new Error('Valid PIN / Postal code is required');
    }

    const repo = this.getAddressRepo();
    const count = await repo.count({ where: { customer_id: customerId } });

    // If first address or is_default explicitly requested
    const shouldBeDefault = Boolean(dto.is_default) || count === 0;

    if (shouldBeDefault) {
      await repo.update({ customer_id: customerId }, { is_default: false });
    }

    const newAddress = repo.create({
      customer_id: customerId,
      full_address,
      state,
      pin_code,
      phone,
      is_default: shouldBeDefault,
    });

    return repo.save(newAddress);
  }

  async updateAddress(
    addressId: string,
    customerId: string,
    dto: UpdateAddressDTO
  ): Promise<CustomerAddress> {
    const repo = this.getAddressRepo();
    const address = await repo.findOne({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new Error('Address not found or unauthorized');
    }

    if (dto.full_address !== undefined) {
      const val = dto.full_address.trim();
      if (!val) throw new Error('Full address cannot be empty');
      address.full_address = val;
    }

    if (dto.state !== undefined) {
      const val = dto.state.trim();
      if (!val) throw new Error('State cannot be empty');
      address.state = val;
    }

    if (dto.pin_code !== undefined) {
      const val = dto.pin_code.trim();
      if (!val || !/^[0-9A-Za-z\s-]{3,10}$/.test(val)) {
        throw new Error('Valid PIN / Postal code is required');
      }
      address.pin_code = val;
    }

    if (dto.phone !== undefined) {
      address.phone = dto.phone ? dto.phone.trim() : undefined;
    }

    if (dto.is_default === true && !address.is_default) {
      await repo.update({ customer_id: customerId }, { is_default: false });
      address.is_default = true;
    } else if (dto.is_default === false && address.is_default) {
      address.is_default = false;
    }

    return repo.save(address);
  }

  async setDefaultAddress(addressId: string, customerId: string): Promise<CustomerAddress> {
    return this.updateAddress(addressId, customerId, { is_default: true });
  }

  async deleteAddress(addressId: string, customerId: string): Promise<void> {
    const repo = this.getAddressRepo();
    const address = await repo.findOne({
      where: { id: addressId, customer_id: customerId },
    });

    if (!address) {
      throw new Error('Address not found or unauthorized');
    }

    const wasDefault = address.is_default;
    await repo.remove(address);

    if (wasDefault) {
      // Pick next available address as default
      const remaining = await repo.findOne({
        where: { customer_id: customerId },
        order: { created_at: 'DESC' },
      });
      if (remaining) {
        remaining.is_default = true;
        await repo.save(remaining);
      }
    }
  }
}
