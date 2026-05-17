const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '../.env' });

async function cleanDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Clear Orders collection completely
    console.log('Clearing orders collection...');
    const resultOrders = await db.collection('orders').deleteMany({});
    console.log(`Deleted ${resultOrders.deletedCount} order documents.`);

    // 2. Drop deprecated collections if they exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (collectionNames.includes('users')) {
      console.log('Dropping deprecated "users" collection...');
      await db.collection('users').drop();
    }
    
    if (collectionNames.includes('otprecords')) {
      console.log('Dropping deprecated "otprecords" collection...');
      await db.collection('otprecords').drop();
    }

    if (collectionNames.includes('sessions')) {
      console.log('Clearing sessions...');
      await db.collection('sessions').deleteMany({});
    }

    // 3. Clear existing role collections to start fresh (optional but safe since they just migrated)
    // Actually let's not drop customers/admins/deliveryagents unless asked, but maybe they want a clean slate?
    // "there are still old data and collections in the NexMart database in mongodb."
    // I will just drop the deprecated collections.

    console.log('Cleanup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanDatabase();
