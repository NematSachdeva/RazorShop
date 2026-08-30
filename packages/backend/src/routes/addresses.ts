import { Router, Request, Response } from 'express';
import { AddressService } from '../services/AddressService.js';
import { AuthService, authService as defaultAuthService } from '../services/AuthService.js';
import { createAuthenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAddressesRouter(
  addressService: AddressService,
  authService: AuthService = defaultAuthService
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);

  // Require customer authentication for all address operations
  router.use(authenticate);

  const requireCustomer = (req: Request, res: Response, next: any) => {
    if (!req.user || req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Only customer accounts can manage delivery addresses' });
    }
    next();
  };

  router.use(requireCustomer);

  // GET /api/addresses
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const addresses = await addressService.listAddresses(req.user!.id);
      res.json(addresses);
    })
  );

  // GET /api/addresses/default
  router.get(
    '/default',
    asyncHandler(async (req: Request, res: Response) => {
      const address = await addressService.getDefaultAddress(req.user!.id);
      if (!address) {
        return res.status(404).json({ error: 'No default address found' });
      }
      res.json(address);
    })
  );

  // POST /api/addresses
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const address = await addressService.createAddress(req.user!.id, req.body);
        res.status(201).json(address);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Invalid address data' });
      }
    })
  );

  // PUT /api/addresses/:id
  router.put(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid address ID format' });
      }

      try {
        const updated = await addressService.updateAddress(id, req.user!.id, req.body);
        res.json(updated);
      } catch (err: any) {
        if (err.message.includes('not found') || err.message.includes('unauthorized')) {
          return res.status(404).json({ error: err.message });
        }
        res.status(400).json({ error: err.message });
      }
    })
  );

  // PUT /api/addresses/:id/default
  router.put(
    '/:id/default',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid address ID format' });
      }

      try {
        const updated = await addressService.setDefaultAddress(id, req.user!.id);
        res.json(updated);
      } catch (err: any) {
        res.status(404).json({ error: err.message });
      }
    })
  );

  // DELETE /api/addresses/:id
  router.delete(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'Invalid address ID format' });
      }

      try {
        await addressService.deleteAddress(id, req.user!.id);
        res.status(200).json({ message: 'Address deleted successfully' });
      } catch (err: any) {
        res.status(404).json({ error: err.message });
      }
    })
  );

  return router;
}

import { AppDataSource } from '../config/database.js';
export default createAddressesRouter(new AddressService(AppDataSource));
