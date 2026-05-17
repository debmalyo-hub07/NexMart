import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Category } from '../models/Category';
import { generateSlug } from '../utils/helpers';

// Ensure env variables are loaded from the root workspace directory
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const categories = [
  { name: 'Mobiles & Tablets', slug: 'mobiles', icon: '📱', sub: ['Smartphones', 'Tablets', 'Cases & Covers', 'Power Banks', 'Chargers'] },
  { name: 'Electronics', slug: 'electronics', icon: '💻', sub: ['Laptops', 'Audio & Headphones', 'Cameras', 'Smart Watches', 'Gaming'] },
  { name: 'TVs & Appliances', slug: 'appliances', icon: '📺', sub: ['Televisions', 'Washing Machines', 'Refrigerators', 'Air Conditioners'] },
  { name: 'Fashion', slug: 'fashion', icon: '👗', sub: ["Men's Clothing", "Women's Clothing", 'Shoes', 'Watches', 'Accessories'] },
  { name: 'Beauty & Health', slug: 'beauty', icon: '💄', sub: ['Makeup', 'Skincare', 'Haircare', 'Fragrances', 'Wellness'] },
  { name: 'Home & Furniture', slug: 'home', icon: '🏠', sub: ['Furniture', 'Home Decor', 'Lighting', 'Bedding', 'Kitchen'] },
  { name: 'Grocery', slug: 'grocery', icon: '🛒', sub: ['Snacks', 'Beverages', 'Staples', 'Personal Care', 'Household Care'] },
  { name: 'Sports & Fitness', slug: 'sports', icon: '⚽', sub: ['Fitness Equipment', 'Outdoor', 'Team Sports', 'Yoga'] },
  { name: 'Books & Media', slug: 'books', icon: '📚', sub: ['Fiction', 'Non-Fiction', 'Academic', 'Comics', 'Gaming Discs'] },
];

async function seed() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Check if we already have these categories to avoid deleting products' relationships accidentally
    const existingCount = await Category.countDocuments();
    if (existingCount > 0) {
      console.log('Categories already exist. Deleting existing categories...');
      await Category.deleteMany({});
    }

    for (let i = 0; i < categories.length; i++) {
      const mainCat = categories[i];
      const parent = await Category.create({
        name: mainCat.name,
        slug: mainCat.slug,
        icon: mainCat.icon,
        displayOrder: i,
      });
      console.log(`Created parent: ${mainCat.name}`);

      for (let j = 0; j < mainCat.sub.length; j++) {
        const subName = mainCat.sub[j];
        await Category.create({
          name: subName,
          slug: generateSlug(subName),
          parent: parent._id,
          displayOrder: j,
        });
      }
    }

    console.log('Successfully seeded categories!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
}

seed();
