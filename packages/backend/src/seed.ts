import { AppDataSource } from './config/database.js';
import { Customer } from './models/Customer.js';
import { Merchant } from './models/Merchant.js';
import { Product } from './models/Product.js';
import { Inventory } from './models/Inventory.js';
import { MerchantConfig } from './models/MerchantConfig.js';
import bcrypt from 'bcryptjs';

export const DEMO_MERCHANT_UUID = '11111111-1111-1111-1111-111111111111';
export const DEMO_CUSTOMER_UUID = '22222222-2222-2222-2222-222222222222';

const products = [
      // Technology (15 products)
      { name: 'Laptop Stand', description: 'Adjustable aluminum laptop stand', price_cents: 299900, category: 'Technology' },
      { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse with USB receiver', price_cents: 99900, category: 'Technology' },
      { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with Cherry switches', price_cents: 599900, category: 'Technology' },
      { name: 'USB-C Hub', description: '7-in-1 USB-C hub with multiple ports', price_cents: 199900, category: 'Technology' },
      { name: '4K Webcam', description: 'Ultra HD webcam for streaming', price_cents: 799900, category: 'Technology' },
      { name: 'Monitor Light Bar', description: 'Smart light bar for monitor', price_cents: 449900, category: 'Technology' },
      { name: 'Portable SSD 1TB', description: 'Fast portable SSD 1TB USB-C', price_cents: 1499900, category: 'Technology' },
      { name: 'Phone Stand', description: 'Adjustable phone stand for desk', price_cents: 59900, category: 'Technology' },
      { name: 'HDMI Cable', description: '2.0 HDMI cable 2 meter', price_cents: 29900, category: 'Technology' },
      { name: 'DisplayPort Cable', description: 'DisplayPort 1.4 cable for 4K displays', price_cents: 79900, category: 'Technology' },
      { name: 'USB-C Cable', description: 'High-speed USB-C 3.0 cable 1 meter', price_cents: 49900, category: 'Technology' },
      { name: 'Desk Mat', description: 'Large extended desk mat with gaming surface', price_cents: 149900, category: 'Technology' },
      { name: 'Cable Organizer', description: 'Silicone cable management clips', price_cents: 39900, category: 'Technology' },
      { name: 'Desk Lamp', description: 'LED desk lamp with adjustable brightness', price_cents: 249900, category: 'Technology' },
      { name: 'Blue Light Glasses', description: 'Anti-blue light glasses for screen time', price_cents: 249900, category: 'Technology' },

      // Electronics (15 products)
      { name: 'Wireless Charger', description: 'Fast wireless charging pad for smartphones', price_cents: 89900, category: 'Electronics' },
      { name: 'Power Bank 20000mAh', description: 'Fast charging power bank with dual USB ports', price_cents: 199900, category: 'Electronics' },
      { name: 'USB Charging Adapter', description: '65W USB-C charging adapter', price_cents: 129900, category: 'Electronics' },
      { name: 'Smart Watch', description: 'Fitness tracking smartwatch with heart rate monitor', price_cents: 899900, category: 'Electronics' },
      { name: 'Bluetooth Speaker', description: 'Portable waterproof Bluetooth speaker', price_cents: 299900, category: 'Electronics' },
      { name: 'Portable WiFi Router', description: 'Compact 4G WiFi router', price_cents: 399900, category: 'Electronics' },
      { name: 'USB Microphone', description: 'Studio quality USB microphone for recording', price_cents: 449900, category: 'Electronics' },
      { name: 'Screen Protector', description: 'Tempered glass screen protector for phones', price_cents: 19900, category: 'Electronics' },
      { name: 'Phone Case', description: 'Protective silicone phone case', price_cents: 29900, category: 'Electronics' },
      { name: 'Selfie Stick', description: 'Extendable selfie stick with Bluetooth remote', price_cents: 79900, category: 'Electronics' },
      { name: 'Mini Projector', description: 'Portable LED mini projector', price_cents: 1299900, category: 'Electronics' },
      { name: 'Car Mount', description: 'Universal magnetic car phone mount', price_cents: 39900, category: 'Electronics' },
      { name: 'Desktop Organizer', description: 'Multi-compartment desk organizer with charging', price_cents: 149900, category: 'Electronics' },
      { name: 'Screen Cleaner', description: 'Microfiber screen cleaning cloth and spray', price_cents: 19900, category: 'Electronics' },
      { name: 'Cable Box', description: 'Wooden cable management box', price_cents: 99900, category: 'Electronics' },

      // Mobiles & Accessories (15 products)
      { name: 'Phone Tempered Glass', description: '9H tempered glass screen guard', price_cents: 24900, category: 'Mobiles & Accessories' },
      { name: 'Leather Phone Case', description: 'Premium leather flip case for phones', price_cents: 79900, category: 'Mobiles & Accessories' },
      { name: 'Phone Ring Stand', description: 'Metal finger ring phone stand', price_cents: 19900, category: 'Mobiles & Accessories' },
      { name: 'Phone Holder', description: 'Dashboard phone holder for cars', price_cents: 34900, category: 'Mobiles & Accessories' },
      { name: 'Mobile Charger', description: 'Fast charging mobile charger with cable', price_cents: 59900, category: 'Mobiles & Accessories' },
      { name: 'Screen Guard Pack', description: 'Pack of 3 screen guards', price_cents: 49900, category: 'Mobiles & Accessories' },
      { name: 'Phone Pouch', description: 'Neoprene waterproof phone pouch', price_cents: 39900, category: 'Mobiles & Accessories' },
      { name: 'Car Charger', description: 'Dual USB car charging adapter', price_cents: 34900, category: 'Mobiles & Accessories' },
      { name: 'Fast Charging Cable', description: 'Braided fast charging cable', price_cents: 39900, category: 'Mobiles & Accessories' },
      { name: 'Phone Kickstand', description: 'Adjustable phone kickstand', price_cents: 29900, category: 'Mobiles & Accessories' },
      { name: 'Tempered Glass 2.5D', description: '2.5D curved edge tempered glass', price_cents: 34900, category: 'Mobiles & Accessories' },
      { name: 'Phone Back Cover', description: 'Transparent back cover for phones', price_cents: 19900, category: 'Mobiles & Accessories' },
      { name: 'Anti Radiation Phone Pouch', description: 'EMF blocking phone pouch', price_cents: 49900, category: 'Mobiles & Accessories' },
      { name: 'Phone Lanyard', description: 'Phone lanyard with strap', price_cents: 14900, category: 'Mobiles & Accessories' },
      { name: 'Phone Cleaning Kit', description: 'Phone screen cleaning kit', price_cents: 24900, category: 'Mobiles & Accessories' },

      // Audio (15 products)
      { name: 'Wireless Earbuds', description: 'True wireless stereo earbuds with charging case', price_cents: 299900, category: 'Audio' },
      { name: 'Noise Cancelling Headphones', description: 'Over-ear noise cancelling headphones', price_cents: 799900, category: 'Audio' },
      { name: '3.5mm Earphones', description: 'Wired earphones with inline microphone', price_cents: 49900, category: 'Audio' },
      { name: 'Bluetooth Neckband', description: 'Lightweight Bluetooth neckband earphones', price_cents: 149900, category: 'Audio' },
      { name: 'Gaming Headset', description: 'Over-ear gaming headset with microphone', price_cents: 349900, category: 'Audio' },
      { name: 'Portable Speaker', description: 'Compact portable Bluetooth speaker', price_cents: 129900, category: 'Audio' },
      { name: 'Car Audio System', description: 'Dashboard car audio system', price_cents: 399900, category: 'Audio' },
      { name: 'Earphone Case', description: 'Protective case for earphones', price_cents: 29900, category: 'Audio' },
      { name: 'Audio Splitter', description: '3.5mm audio splitter cable', price_cents: 19900, category: 'Audio' },
      { name: 'Microphone Stand', description: 'Adjustable microphone stand', price_cents: 79900, category: 'Audio' },
      { name: 'Studio Headphones', description: 'Professional studio monitoring headphones', price_cents: 649900, category: 'Audio' },
      { name: 'Earphone Cable', description: 'Replacement braided earphone cable', price_cents: 24900, category: 'Audio' },
      { name: 'Bluetooth Adapter', description: 'Bluetooth receiver for audio devices', price_cents: 49900, category: 'Audio' },
      { name: 'Audio Amplifier', description: 'Portable audio amplifier', price_cents: 199900, category: 'Audio' },
      { name: 'Sound Bar', description: 'Compact soundbar for TVs', price_cents: 549900, category: 'Audio' },

      // Computers & Accessories (15 products)
      { name: 'External Hard Drive', description: '2TB external hard drive', price_cents: 349900, category: 'Computers & Accessories' },
      { name: 'Pen Drive 32GB', description: '32GB USB pen drive', price_cents: 34900, category: 'Computers & Accessories' },
      { name: 'RAM 8GB', description: '8GB DDR4 RAM module', price_cents: 299900, category: 'Computers & Accessories' },
      { name: 'SSD 256GB', description: '256GB internal SSD', price_cents: 249900, category: 'Computers & Accessories' },
      { name: 'Laptop Bag', description: 'Professional laptop backpack', price_cents: 199900, category: 'Computers & Accessories' },
      { name: 'Cooling Pad', description: 'Laptop cooling pad with fans', price_cents: 99900, category: 'Computers & Accessories' },
      { name: 'USB Hub', description: '4-port USB hub', price_cents: 59900, category: 'Computers & Accessories' },
      { name: 'Keyboard Mouse Combo', description: 'Wireless keyboard and mouse combo', price_cents: 149900, category: 'Computers & Accessories' },
      { name: 'Monitor', description: '24 inch Full HD monitor', price_cents: 899900, category: 'Computers & Accessories' },
      { name: 'Webcam', description: '1080P HD webcam', price_cents: 149900, category: 'Computers & Accessories' },
      { name: 'Mouse Pad', description: 'Large gaming mouse pad', price_cents: 39900, category: 'Computers & Accessories' },
      { name: 'Laptop Lock', description: 'Cable lock for laptops', price_cents: 49900, category: 'Computers & Accessories' },
      { name: 'Screen Privacy Filter', description: 'Privacy screen filter for monitors', price_cents: 99900, category: 'Computers & Accessories' },
      { name: 'Laptop Stand Adjustable', description: 'Adjustable laptop stand', price_cents: 149900, category: 'Computers & Accessories' },
      { name: 'Graphics Card', description: 'NVIDIA graphics card', price_cents: 1899900, category: 'Computers & Accessories' },

      // Home & Kitchen (15 products)
      { name: 'Coffee Maker', description: 'Automatic drip coffee maker', price_cents: 449900, category: 'Home & Kitchen' },
      { name: 'Blender', description: 'High-power blender mixer', price_cents: 299900, category: 'Home & Kitchen' },
      { name: 'Toaster', description: '2-slice bread toaster', price_cents: 199900, category: 'Home & Kitchen' },
      { name: 'Water Bottle', description: 'Stainless steel water bottle 1L', price_cents: 79900, category: 'Home & Kitchen' },
      { name: 'Lunch Box', description: 'Stainless steel lunch box', price_cents: 49900, category: 'Home & Kitchen' },
      { name: 'Cutting Board Set', description: 'Chopping board set with knives', price_cents: 129900, category: 'Home & Kitchen' },
      { name: 'Pressure Cooker', description: '5L stainless steel pressure cooker', price_cents: 199900, category: 'Home & Kitchen' },
      { name: 'Non-stick Pan', description: 'Non-stick frying pan', price_cents: 99900, category: 'Home & Kitchen' },
      { name: 'Knife Set', description: 'Professional knife set', price_cents: 199900, category: 'Home & Kitchen' },
      { name: 'Microwave Oven', description: 'Convection microwave oven', price_cents: 549900, category: 'Home & Kitchen' },
      { name: 'Food Container', description: 'Glass food container set', price_cents: 34900, category: 'Home & Kitchen' },
      { name: 'Dish Rack', description: 'Stainless steel dish rack', price_cents: 49900, category: 'Home & Kitchen' },
      { name: 'Soap Dispenser', description: 'Automatic soap dispenser', price_cents: 34900, category: 'Home & Kitchen' },
      { name: 'Sponge Holder', description: 'Stainless steel sponge holder', price_cents: 19900, category: 'Home & Kitchen' },
      { name: 'Tea Infuser', description: 'Stainless steel tea infuser', price_cents: 24900, category: 'Home & Kitchen' },

      // Clothing (15 products)
      { name: 'Cotton T-Shirt', description: 'Comfortable 100% cotton t-shirt', price_cents: 19900, category: 'Clothing' },
      { name: 'Jeans', description: 'Blue denim jeans', price_cents: 99900, category: 'Clothing' },
      { name: 'Formal Shirt', description: 'White formal shirt', price_cents: 79900, category: 'Clothing' },
      { name: 'Jacket', description: 'Casual winter jacket', price_cents: 249900, category: 'Clothing' },
      { name: 'Hoodie', description: 'Warm cotton hoodie', price_cents: 129900, category: 'Clothing' },
      { name: 'Shorts', description: 'Casual cotton shorts', price_cents: 39900, category: 'Clothing' },
      { name: 'Sports Tracksuit', description: 'Polyester sports tracksuit', price_cents: 149900, category: 'Clothing' },
      { name: 'Polo T-Shirt', description: 'Cotton polo t-shirt', price_cents: 49900, category: 'Clothing' },
      { name: 'Thermal Wear', description: 'Winter thermal innerwear', price_cents: 39900, category: 'Clothing' },
      { name: 'Cargo Pants', description: 'Multi-pocket cargo pants', price_cents: 79900, category: 'Clothing' },
      { name: 'Swim Wear', description: 'Chlorine resistant swim wear', price_cents: 59900, category: 'Clothing' },
      { name: 'Blazer', description: 'Formal blazer jacket', price_cents: 199900, category: 'Clothing' },
      { name: 'Striped Shirt', description: 'Striped casual shirt', price_cents: 59900, category: 'Clothing' },
      { name: 'V-Neck Sweater', description: 'Woolen v-neck sweater', price_cents: 99900, category: 'Clothing' },
      { name: 'Dungarees', description: 'Casual cotton dungarees', price_cents: 69900, category: 'Clothing' },

      // Footwear (15 products)
      { name: 'Sports Shoes', description: 'Running sports shoes', price_cents: 199900, category: 'Footwear' },
      { name: 'Casual Sneakers', description: 'Comfortable casual sneakers', price_cents: 149900, category: 'Footwear' },
      { name: 'Formal Shoes', description: 'Black formal shoes', price_cents: 129900, category: 'Footwear' },
      { name: 'Sandals', description: 'Comfortable casual sandals', price_cents: 39900, category: 'Footwear' },
      { name: 'Flip Flops', description: 'Beach flip flops', price_cents: 19900, category: 'Footwear' },
      { name: 'Loafers', description: 'Brown leather loafers', price_cents: 99900, category: 'Footwear' },
      { name: 'Boots', description: 'Leather boots', price_cents: 179900, category: 'Footwear' },
      { name: 'Slippers', description: 'Indoor slippers', price_cents: 29900, category: 'Footwear' },
      { name: 'Kids Shoes', description: 'Colorful kids shoes', price_cents: 69900, category: 'Footwear' },
      { name: 'Joggers Shoes', description: 'Joggers sports shoes', price_cents: 149900, category: 'Footwear' },
      { name: 'Basketball Shoes', description: 'Professional basketball shoes', price_cents: 249900, category: 'Footwear' },
      { name: 'Cricket Shoes', description: 'Professional cricket shoes', price_cents: 179900, category: 'Footwear' },
      { name: 'Dress Heels', description: 'Women dress heels', price_cents: 99900, category: 'Footwear' },
      { name: 'Ankle Boots', description: 'Leather ankle boots', price_cents: 129900, category: 'Footwear' },
      { name: 'School Shoes', description: 'Black school shoes', price_cents: 49900, category: 'Footwear' },

      // Bags & Accessories (15 products)
      { name: 'Backpack', description: 'Spacious college backpack', price_cents: 199900, category: 'Bags & Accessories' },
      { name: 'Shoulder Bag', description: 'Canvas shoulder bag', price_cents: 149900, category: 'Bags & Accessories' },
      { name: 'Travel Bag', description: 'Large travel duffel bag', price_cents: 249900, category: 'Bags & Accessories' },
      { name: 'Laptop Backpack', description: 'Professional laptop backpack', price_cents: 299900, category: 'Bags & Accessories' },
      { name: 'Crossbody Bag', description: 'Leather crossbody bag', price_cents: 179900, category: 'Bags & Accessories' },
      { name: 'School Bag', description: 'Colorful school backpack', price_cents: 99900, category: 'Bags & Accessories' },
      { name: 'Wallet', description: 'RFID blocking wallet', price_cents: 49900, category: 'Bags & Accessories' },
      { name: 'Money Belt', description: 'Travel money belt', price_cents: 34900, category: 'Bags & Accessories' },
      { name: 'Sunglasses', description: 'UV protection sunglasses', price_cents: 79900, category: 'Bags & Accessories' },
      { name: 'Watch', description: 'Analog wrist watch', price_cents: 99900, category: 'Bags & Accessories' },
      { name: 'Scarf', description: 'Woolen winter scarf', price_cents: 39900, category: 'Bags & Accessories' },
      { name: 'Belt', description: 'Leather belt', price_cents: 29900, category: 'Bags & Accessories' },
      { name: 'Cap', description: 'Baseball cap', price_cents: 24900, category: 'Bags & Accessories' },
      { name: 'Gloves', description: 'Winter gloves', price_cents: 19900, category: 'Bags & Accessories' },
      { name: 'Tie', description: 'Formal silk tie', price_cents: 34900, category: 'Bags & Accessories' },

      // Sports & Fitness (15 products)
      { name: 'Yoga Mat', description: 'Non-slip yoga mat', price_cents: 49900, category: 'Sports & Fitness' },
      { name: 'Dumbbells Set', description: '10kg dumbbells set', price_cents: 199900, category: 'Sports & Fitness' },
      { name: 'Resistance Bands', description: 'Set of resistance bands', price_cents: 29900, category: 'Sports & Fitness' },
      { name: 'Skipping Rope', description: 'Speed skipping rope', price_cents: 19900, category: 'Sports & Fitness' },
      { name: 'Push-up Stand', description: 'Ab push-up bar', price_cents: 24900, category: 'Sports & Fitness' },
      { name: 'Cricket Bat', description: 'Wooden cricket bat', price_cents: 149900, category: 'Sports & Fitness' },
      { name: 'Football', description: 'Professional football', price_cents: 49900, category: 'Sports & Fitness' },
      { name: 'Badminton Racket', description: 'Badminton racket set', price_cents: 99900, category: 'Sports & Fitness' },
      { name: 'Tennis Racket', description: 'Professional tennis racket', price_cents: 249900, category: 'Sports & Fitness' },
      { name: 'Bicycle', description: 'Mountain bicycle', price_cents: 799900, category: 'Sports & Fitness' },
      { name: 'Skateboard', description: 'Professional skateboard', price_cents: 349900, category: 'Sports & Fitness' },
      { name: 'Roller Skates', description: 'Adjustable roller skates', price_cents: 199900, category: 'Sports & Fitness' },
      { name: 'Fitness Tracker', description: 'Smart fitness tracker band', price_cents: 199900, category: 'Sports & Fitness' },
      { name: 'Protein Shaker', description: 'Protein shaker bottle', price_cents: 19900, category: 'Sports & Fitness' },
      { name: 'Foam Roller', description: 'Muscle recovery foam roller', price_cents: 39900, category: 'Sports & Fitness' },

      // Books & Stationery (15 products)
      { name: 'Notebook A4', description: 'Ruled notebook A4 size', price_cents: 24900, category: 'Books & Stationery' },
      { name: 'Pen Set', description: 'Pack of 10 ballpoint pens', price_cents: 19900, category: 'Books & Stationery' },
      { name: 'Pencil Set', description: 'HB pencil set', price_cents: 14900, category: 'Books & Stationery' },
      { name: 'Drawing Book', description: 'Sketchbook A3', price_cents: 34900, category: 'Books & Stationery' },
      { name: 'Colors Set', description: '24 color pencil set', price_cents: 49900, category: 'Books & Stationery' },
      { name: 'Marker Set', description: 'Permanent marker set', price_cents: 24900, category: 'Books & Stationery' },
      { name: 'Highlighters', description: 'Neon highlighter pack', price_cents: 14900, category: 'Books & Stationery' },
      { name: 'Diary', description: 'Hardcover diary', price_cents: 39900, category: 'Books & Stationery' },
      { name: 'Planner', description: 'Daily planner book', price_cents: 29900, category: 'Books & Stationery' },
      { name: 'Sticky Notes', description: 'Colorful sticky notes pad', price_cents: 9900, category: 'Books & Stationery' },
      { name: 'Stapler', description: 'Heavy duty stapler', price_cents: 19900, category: 'Books & Stationery' },
      { name: 'Tape Dispenser', description: 'Desk tape dispenser', price_cents: 24900, category: 'Books & Stationery' },
      { name: 'Eraser', description: 'Rubber eraser', price_cents: 4900, category: 'Books & Stationery' },
      { name: 'Sharpener', description: 'Automatic pencil sharpener', price_cents: 19900, category: 'Books & Stationery' },
      { name: 'Glue Stick', description: 'Glue stick pack', price_cents: 9900, category: 'Books & Stationery' },

      // Beauty & Personal Care (15 products)
      { name: 'Face Wash', description: 'Gentle face wash', price_cents: 24900, category: 'Beauty & Personal Care' },
      { name: 'Shampoo', description: 'Herbal hair shampoo', price_cents: 34900, category: 'Beauty & Personal Care' },
      { name: 'Conditioner', description: 'Hair conditioner bottle', price_cents: 34900, category: 'Beauty & Personal Care' },
      { name: 'Toothbrush', description: 'Electric toothbrush', price_cents: 99900, category: 'Beauty & Personal Care' },
      { name: 'Toothpaste', description: 'Fluoride toothpaste', price_cents: 14900, category: 'Beauty & Personal Care' },
      { name: 'Body Lotion', description: 'Moisturizing body lotion', price_cents: 29900, category: 'Beauty & Personal Care' },
      { name: 'Soap', description: 'Luxury soap bars', price_cents: 19900, category: 'Beauty & Personal Care' },
      { name: 'Deodorant', description: 'Anti-bacterial deodorant', price_cents: 24900, category: 'Beauty & Personal Care' },
      { name: 'Hair Oil', description: 'Coconut hair oil', price_cents: 19900, category: 'Beauty & Personal Care' },
      { name: 'Face Mask', description: 'Sheet face mask', price_cents: 9900, category: 'Beauty & Personal Care' },
      { name: 'Lipstick', description: 'Long-lasting lipstick', price_cents: 34900, category: 'Beauty & Personal Care' },
      { name: 'Mascara', description: 'Waterproof mascara', price_cents: 39900, category: 'Beauty & Personal Care' },
      { name: 'Hair Dryer', description: 'Professional hair dryer', price_cents: 149900, category: 'Beauty & Personal Care' },
      { name: 'Trimmer', description: 'Electric body trimmer', price_cents: 79900, category: 'Beauty & Personal Care' },
      { name: 'Perfume', description: 'Eau de toilette perfume', price_cents: 49900, category: 'Beauty & Personal Care' },

      // Toys & Games (15 products)
      { name: 'Board Game', description: 'Family board game', price_cents: 49900, category: 'Toys & Games' },
      { name: 'Chess Set', description: 'Wooden chess board set', price_cents: 79900, category: 'Toys & Games' },
      { name: 'Puzzle', description: '1000 piece jigsaw puzzle', price_cents: 34900, category: 'Toys & Games' },
      { name: 'Playing Cards', description: 'Standard playing card deck', price_cents: 9900, category: 'Toys & Games' },
      { name: 'Dice Game', description: 'Set of gaming dice', price_cents: 14900, category: 'Toys & Games' },
      { name: 'Toy Car', description: 'Remote control toy car', price_cents: 149900, category: 'Toys & Games' },
      { name: 'Action Figure', description: 'Superhero action figure', price_cents: 49900, category: 'Toys & Games' },
      { name: 'Lego Set', description: 'Lego building block set', price_cents: 199900, category: 'Toys & Games' },
      { name: 'Doll', description: 'Fashion doll', price_cents: 79900, category: 'Toys & Games' },
      { name: 'Building Blocks', description: 'Wooden building blocks', price_cents: 39900, category: 'Toys & Games' },
      { name: 'Rubiks Cube', description: 'Speed rubiks cube', price_cents: 39900, category: 'Toys & Games' },
      { name: 'Yo-Yo', description: 'Professional yo-yo', price_cents: 19900, category: 'Toys & Games' },
      { name: 'Frisbee', description: 'Flying frisbee disc', price_cents: 14900, category: 'Toys & Games' },
      { name: 'Kite', description: 'Colorful flying kite', price_cents: 9900, category: 'Toys & Games' },
      { name: 'Video Game', description: 'Latest video game', price_cents: 399900, category: 'Toys & Games' },

      // Pet Supplies (15 products)
      { name: 'Dog Food', description: 'Dry dog food 5kg', price_cents: 149900, category: 'Pet Supplies' },
      { name: 'Cat Food', description: 'Wet cat food pouches', price_cents: 34900, category: 'Pet Supplies' },
      { name: 'Dog Bed', description: 'Comfortable dog bed', price_cents: 79900, category: 'Pet Supplies' },
      { name: 'Cat Bed', description: 'Cozy cat bed', price_cents: 49900, category: 'Pet Supplies' },
      { name: 'Dog Leash', description: 'Retractable dog leash', price_cents: 34900, category: 'Pet Supplies' },
      { name: 'Cat Collar', description: 'Adjustable cat collar', price_cents: 14900, category: 'Pet Supplies' },
      { name: 'Dog Toy', description: 'Squeaky dog toy', price_cents: 19900, category: 'Pet Supplies' },
      { name: 'Cat Toy', description: 'Interactive cat toy', price_cents: 24900, category: 'Pet Supplies' },
      { name: 'Pet Brush', description: 'Grooming pet brush', price_cents: 24900, category: 'Pet Supplies' },
      { name: 'Pet Shampoo', description: 'Dog and cat shampoo', price_cents: 29900, category: 'Pet Supplies' },
      { name: 'Water Bowl', description: 'Stainless steel pet bowl', price_cents: 19900, category: 'Pet Supplies' },
      { name: 'Food Bowl', description: 'Pet food bowl', price_cents: 14900, category: 'Pet Supplies' },
      { name: 'Pet Crate', description: 'Portable pet carrier', price_cents: 99900, category: 'Pet Supplies' },
      { name: 'Litter Box', description: 'Cat litter box', price_cents: 49900, category: 'Pet Supplies' },
      { name: 'Pet Treats', description: 'Healthy pet treats', price_cents: 34900, category: 'Pet Supplies' },

      // Automotive (15 products)
      { name: 'Car Mat', description: 'Anti-skid car floor mat', price_cents: 29900, category: 'Automotive' },
      { name: 'Car Polish', description: 'Liquid car polish', price_cents: 19900, category: 'Automotive' },
      { name: 'Car Seat Cover', description: 'Universal car seat cover', price_cents: 79900, category: 'Automotive' },
      { name: 'Steering Wheel Cover', description: 'Leather steering wheel cover', price_cents: 39900, category: 'Automotive' },
      { name: 'Car Air Freshener', description: 'Hanging car air freshener', price_cents: 14900, category: 'Automotive' },
      { name: 'Car Shampoo', description: 'Foaming car shampoo', price_cents: 24900, category: 'Automotive' },
      { name: 'Windshield Cleaner', description: 'Windshield glass cleaner', price_cents: 19900, category: 'Automotive' },
      { name: 'Car Vacuum', description: 'Portable car vacuum cleaner', price_cents: 149900, category: 'Automotive' },
      { name: 'Car Organizer', description: 'Multi-pocket car organizer', price_cents: 34900, category: 'Automotive' },
      { name: 'Car Phone Mount', description: 'Dashboard phone mount', price_cents: 24900, category: 'Automotive' },
      { name: 'Car Tool Kit', description: 'Emergency car tool kit', price_cents: 49900, category: 'Automotive' },
      { name: 'Jumper Cables', description: 'Heavy duty jumper cables', price_cents: 79900, category: 'Automotive' },
      { name: 'Tire Gauge', description: 'Digital tire pressure gauge', price_cents: 24900, category: 'Automotive' },
      { name: 'Car Battery', description: '12V car battery', price_cents: 399900, category: 'Automotive' },
      { name: 'Car Wax', description: 'Protective car wax', price_cents: 29900, category: 'Automotive' },

      // Furniture & Office (15 products)
      { name: 'Office Chair', description: 'Ergonomic office chair', price_cents: 549900, category: 'Furniture & Office' },
      { name: 'Desk', description: 'Wooden office desk', price_cents: 299900, category: 'Furniture & Office' },
      { name: 'Bookshelf', description: '3-tier wooden bookshelf', price_cents: 199900, category: 'Furniture & Office' },
      { name: 'File Cabinet', description: '4-drawer file cabinet', price_cents: 249900, category: 'Furniture & Office' },
      { name: 'Desk Drawer', description: 'Desk storage drawer', price_cents: 79900, category: 'Furniture & Office' },
      { name: 'Wall Shelves', description: 'Floating wall shelves', price_cents: 99900, category: 'Furniture & Office' },
      { name: 'Office Stool', description: 'Adjustable office stool', price_cents: 99900, category: 'Furniture & Office' },
      { name: 'Document Holder', description: 'Tilting document holder', price_cents: 34900, category: 'Furniture & Office' },
      { name: 'Desk Lamp', description: 'LED desk lamp', price_cents: 79900, category: 'Furniture & Office' },
      { name: 'Cable Tray', description: 'Under-desk cable tray', price_cents: 29900, category: 'Furniture & Office' },
      { name: 'Office Plants', description: 'Indoor office plant', price_cents: 49900, category: 'Furniture & Office' },
      { name: 'Desk Organizer', description: 'Desktop organizer caddy', price_cents: 39900, category: 'Furniture & Office' },
      { name: 'Bulletin Board', description: 'Cork bulletin board', price_cents: 29900, category: 'Furniture & Office' },
      { name: 'Wall Clock', description: 'Silent wall clock', price_cents: 34900, category: 'Furniture & Office' },
      { name: 'Magazine Rack', description: 'Metal magazine holder', price_cents: 24900, category: 'Furniture & Office' },

      // Electrical & Gadgets (15 products)
      { name: 'Power Strip', description: '4-outlet power strip', price_cents: 24900, category: 'Electrical & Gadgets' },
      { name: 'Extension Cord', description: '10m extension cord', price_cents: 34900, category: 'Electrical & Gadgets' },
      { name: 'LED Bulb', description: '9W LED bulb', price_cents: 14900, category: 'Electrical & Gadgets' },
      { name: 'Tube Light', description: '18W LED tube light', price_cents: 34900, category: 'Electrical & Gadgets' },
      { name: 'Night Light', description: 'Motion sensor night light', price_cents: 29900, category: 'Electrical & Gadgets' },
      { name: 'Smart Plug', description: 'WiFi smart plug', price_cents: 79900, category: 'Electrical & Gadgets' },
      { name: 'Power Bank', description: '10000mAh power bank', price_cents: 99900, category: 'Electrical & Gadgets' },
      { name: 'Voltage Stabilizer', description: 'Automatic voltage stabilizer', price_cents: 199900, category: 'Electrical & Gadgets' },
      { name: 'UPS Battery', description: 'Backup UPS battery', price_cents: 299900, category: 'Electrical & Gadgets' },
      { name: 'Solar Light', description: 'Solar powered light', price_cents: 49900, category: 'Electrical & Gadgets' },
      { name: 'Emergency Light', description: 'LED emergency light', price_cents: 39900, category: 'Electrical & Gadgets' },
      { name: 'Rechargeable Battery', description: 'AA rechargeable battery', price_cents: 19900, category: 'Electrical & Gadgets' },
      { name: 'Battery Charger', description: 'Multi-battery charger', price_cents: 39900, category: 'Electrical & Gadgets' },
      { name: 'Soldering Iron', description: 'Electric soldering iron', price_cents: 79900, category: 'Electrical & Gadgets' },
      { name: 'Multimeter', description: 'Digital multimeter', price_cents: 49900, category: 'Electrical & Gadgets' },
    ];

export async function seedDatabase(ds: any = AppDataSource) {
  try {
    if (!ds.isInitialized) {
      await ds.initialize();
    }
    console.log('Seeding database...');

    const demoCustomerPassword = await bcrypt.hash('password123', 10);

    // 1. Seed demo merchant in Merchant table
    const merchantRepo = ds.getRepository(Merchant);
    let demoMerchant = await merchantRepo.findOne({
      where: [{ id: DEMO_MERCHANT_UUID }, { email: 'merchant@example.com' }],
    });
    if (!demoMerchant) {
      demoMerchant = await merchantRepo.save(
        merchantRepo.create({
          id: DEMO_MERCHANT_UUID,
          email: 'merchant@example.com',
          name: 'Demo Merchant',
          contact_phone: '+919876543200',
          status: 'active',
        })
      );
    }

    // 2. Seed demo merchant in Customer table for auth login
    const customerRepo = ds.getRepository(Customer);
    let merchantAuthUser = await customerRepo.findOne({
      where: [{ id: DEMO_MERCHANT_UUID }, { email: 'merchant@example.com' }],
    });
    if (!merchantAuthUser) {
      await customerRepo.save(
        customerRepo.create({
          id: DEMO_MERCHANT_UUID,
          email: 'merchant@example.com',
          name: 'Demo Merchant',
          password_hash: demoCustomerPassword,
          role: 'merchant',
        })
      );
    } else {
      merchantAuthUser.password_hash = demoCustomerPassword;
      merchantAuthUser.role = 'merchant';
      if (merchantAuthUser.id !== DEMO_MERCHANT_UUID) {
        try {
          await customerRepo.query('UPDATE customers SET id = $1 WHERE email = $2', [
            DEMO_MERCHANT_UUID,
            'merchant@example.com',
          ]);
          merchantAuthUser.id = DEMO_MERCHANT_UUID;
        } catch {
          // Ignored if foreign keys reference existing ID
        }
      }
      await customerRepo.save(merchantAuthUser);
    }

    // 3. Seed demo customers
    const customersData = [
      {
        id: DEMO_CUSTOMER_UUID,
        email: 'customer@example.com',
        phone: '+919876543210',
        name: 'Demo Customer',
        password_hash: demoCustomerPassword,
        role: 'customer' as const,
      },
      {
        email: 'alice@example.com',
        phone: '+919876543211',
        name: 'Alice Kumar',
        password_hash: demoCustomerPassword,
        role: 'customer' as const,
      },
      {
        email: 'bob@example.com',
        phone: '+919876543212',
        name: 'Bob Singh',
        password_hash: demoCustomerPassword,
        role: 'customer' as const,
      },
      {
        email: 'charlie@example.com',
        phone: '+919876543213',
        name: 'Charlie Patel',
        password_hash: demoCustomerPassword,
        role: 'customer' as const,
      },
      {
        email: 'xanematsachdevabis@gmail.com',
        phone: '+919876543299',
        name: 'Nemat Sachdeva',
        password_hash: demoCustomerPassword,
        role: 'customer' as const,
      },
    ];

    for (const customerData of customersData) {
      const existing = await customerRepo.findOne({
        where: { email: customerData.email },
      });
      if (!existing) {
        await customerRepo.save(customerRepo.create(customerData));
      } else {
        existing.password_hash = customerData.password_hash;
        existing.role = customerData.role;
        await customerRepo.save(existing);
      }
    }

    // 4. Seed products with merchant_id = DEMO_MERCHANT_UUID
    const productRepo = ds.getRepository(Product);
    for (const productData of products) {
      const existing = await productRepo.findOne({
        where: { name: productData.name },
      });
      if (!existing) {
        await productRepo.save(
          productRepo.create({
            ...productData,
            merchant_id: DEMO_MERCHANT_UUID,
          })
        );
      } else if (!existing.merchant_id) {
        existing.merchant_id = DEMO_MERCHANT_UUID;
        await productRepo.save(existing);
      }
    }
    console.log(`✓ Seeded products`);

    // 5. Seed inventory
    const inventoryRepo = ds.getRepository(Inventory);
    const allProducts = await productRepo.find();
    for (const product of allProducts) {
      const existing = await inventoryRepo.findOne({
        where: { product_id: product.id },
      });
      if (!existing) {
        await inventoryRepo.save(
          inventoryRepo.create({
            product_id: product.id,
            quantity_on_hand: Math.floor(Math.random() * 100) + 10,
            reserved: 0,
          })
        );
      }
    }
    console.log('✓ Seeded inventory');

    // 6. Seed MerchantConfig
    const configRepo = ds.getRepository(MerchantConfig);
    let merchantConfig = await configRepo.findOne({
      where: { merchant_id: DEMO_MERCHANT_UUID },
    });
    if (!merchantConfig) {
      await configRepo.save(
        configRepo.create({
          merchant_id: DEMO_MERCHANT_UUID,
          max_recovery_attempts: 3,
          max_discount_percent: 30,
          allowed_channels: ['email', 'sms', 'whatsapp'],
          max_promise_days: 14,
          ai_insights_enabled: true,
          bundle_recommendations_enabled: true,
          discount_strategy_enabled: true,
          inventory_opt_enabled: true,
          recovery_targeting_enabled: true,
          min_confidence_score: 70,
        })
      );
    }
    console.log('✓ Seeded merchant config');
  } catch (error) {
    console.error('Seeding failed:', error);
  }
}

// If run directly from CLI
if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  seedDatabase().then(() => {
    if (AppDataSource.isInitialized) {
      AppDataSource.destroy();
    }
  });
}
