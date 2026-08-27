import { AppDataSource } from './src/config/database.js';
import { Order } from './src/models/Order.js';
import { Customer } from './src/models/Customer.js';

async function test() {
  await AppDataSource.initialize();
  
  // Create a test customer and order
  const customerRepo = AppDataSource.getRepository(Customer);
  const customer = customerRepo.create({
    email: `test-${Date.now()}@example.com`,
    name: 'Test User'
  });
  const savedCustomer = await customerRepo.save(customer);
  
  const orderRepo = AppDataSource.getRepository(Order);
  const order = orderRepo.create({
    customer_id: savedCustomer.id,
    total_cents: 100000,
    status: 'pending'
  });
  const savedOrder = await orderRepo.save(order);
  
  console.log('Created order:', savedOrder.id);
  
  // Now try the ON CONFLICT with this real order
  try {
    const result = await AppDataSource.query(
      `INSERT INTO "payment_attempts"
        ("id", "order_id", "razorpay_order_id", "attempt_number", "created_at", "updated_at")
       VALUES (gen_random_uuid(), $1, NULL, $2, now(), now())
       ON CONFLICT ("order_id", "attempt_number") DO NOTHING
       RETURNING "id"`,
      [savedOrder.id, 1]
    );
    console.log('ON CONFLICT with column list: SUCCESS');
    console.log('Result:', result);
  } catch (e: any) {
    console.log('ON CONFLICT with column list: FAILED');
    console.log('Error:', e.message);
  }
  
  await AppDataSource.destroy();
}

test().catch(console.error);
