import { Inventory } from './Inventory.js';

describe('Inventory Model', () => {
  it('should create inventory with valid data', () => {
    const inventory = new Inventory();
    inventory.id = '123';
    inventory.product_id = 'prod-123';
    inventory.quantity_on_hand = 100;
    inventory.reserved = 5;

    expect(inventory.quantity_on_hand).toBe(100);
    expect(inventory.reserved).toBe(5);
  });

  it('should have entity-level defaults for quantities when instantiated', () => {
    const inventory = new Inventory();
    inventory.product_id = 'prod-123';

    // Entity-level defaults apply on instantiation
    expect(inventory.quantity_on_hand).toBe(0);
    expect(inventory.reserved).toBe(0);
  });

  it('should allow modification of inventory quantities', () => {
    const inventory = new Inventory();
    inventory.product_id = 'prod-123';
    inventory.quantity_on_hand = 50;
    inventory.reserved = 10;

    expect(inventory.quantity_on_hand).toBe(50);
    expect(inventory.reserved).toBe(10);
  });
});
