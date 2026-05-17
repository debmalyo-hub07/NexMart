const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/nexmart");
    console.log("Connected to MongoDB.");

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections found:", collections.map(c => c.name));

    const db = mongoose.connection.db;
    
    // Check if 'orders' exists
    const ordersCollection = db.collection('orders');
    if (ordersCollection) {
      const result = await ordersCollection.deleteMany({});
      console.log(`Cleared ${result.deletedCount} documents from 'orders' collection.`);
    }

    // Check if 'users' exists (for migration or splitting later)
    const usersCollection = db.collection('users');
    if (usersCollection) {
      const userCount = await usersCollection.countDocuments();
      console.log(`Found ${userCount} users in 'users' collection.`);
      
      const rolesCount = await usersCollection.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } }
      ]).toArray();
      console.log(`User roles summary:`, rolesCount);
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

cleanup();
