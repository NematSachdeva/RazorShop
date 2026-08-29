import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database.js';
import { Customer, CustomerRole } from '../models/Customer.js';
import { env } from '../config/env.js';

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  role?: CustomerRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  name?: string;
  role: CustomerRole;
  token: string;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: CustomerRole;
}

export class AuthService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
  }

  private getCustomerRepository() {
    return this.dataSource.getRepository(Customer);
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: JWTPayload): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    return jwt.sign(payload, secret, { expiresIn: '7d' });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }
      const decoded = jwt.verify(token, secret) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Register a new customer/merchant
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    const { email, password, name, role = 'customer' } = request;

    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Check if email already exists
    const existing = await this.getCustomerRepository().findOne({
      where: { email },
    });

    if (existing) {
      throw new Error('Email already registered');
    }

    // Hash password
    const password_hash = await this.hashPassword(password);

    // Create customer
    const customer = this.getCustomerRepository().create({
      email,
      password_hash,
      name: name || email.split('@')[0],
      role,
    });

    const saved = await this.getCustomerRepository().save(customer);

    // Generate token
    const token = this.generateToken({
      id: saved.id,
      email: saved.email,
      role: saved.role,
    });

    return {
      id: saved.id,
      email: saved.email,
      name: saved.name,
      role: saved.role,
      token,
    };
  }

  /**
   * Login with email and password
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    const { email, password } = request;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find customer
    const customer = await this.getCustomerRepository().findOne({
      where: { email },
    });

    if (!customer) {
      throw new Error('Invalid email or password');
    }

    // Check password
    if (!customer.password_hash) {
      throw new Error('Invalid email or password');
    }

    const isValid = await this.comparePassword(password, customer.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken({
      id: customer.id,
      email: customer.email,
      role: customer.role,
    });

    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      role: customer.role,
      token,
    };
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    return this.getCustomerRepository().findOne({
      where: { id },
    });
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string): Promise<Customer | null> {
    return this.getCustomerRepository().findOne({
      where: { email },
    });
  }
}

export const authService = new AuthService();
