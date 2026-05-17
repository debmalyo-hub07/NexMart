const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/test");
    const db = mongoose.connection.db;

    const usersCollection = db.collection('users');
    if (!usersCollection) {
      console.log('No users collection found. Exiting.');
      process.exit(0);
    }

    const users = await usersCollection.find({}).toArray();
    console.log(`Found ${users.length} users to migrate.`);

    const adminsCollection = db.collection('admins');
    const customersCollection = db.collection('customers');
    const agentsCollection = db.collection('deliveryagents');

    for (const user of users) {
      const { _id, name, email, password, role, address, city, vehicleType, status, whitelistedIP, createdAt, updatedAt } = user;
      
      const baseDoc = { _id, name, email, password, role, whitelistedIP, createdAt, updatedAt };

      if (role === 'admin') {
        await adminsCollection.updateOne({ _id }, { $set: baseDoc }, { upsert: true });
        console.log(`Migrated admin: ${email}`);
      } else if (role === 'agent') {
        await agentsCollection.updateOne({ _id }, { $set: { ...baseDoc, vehicleType, city, status: status || 'pending' } }, { upsert: true });
        console.log(`Migrated agent: ${email}`);
      } else {
        // Default to customer
        await customersCollection.updateOne({ _id }, { $set: { ...baseDoc, address, city, role: 'customer' } }, { upsert: true });
        console.log(`Migrated customer: ${email}`);
      }
    }

    console.log('Migration complete. Deleting users collection...');
    try {
      await usersCollection.drop();
      console.log('Users collection dropped.');
    } catch(e) {
      console.log('Error dropping users collection or it was already dropped.');
    }
    
    // Also drop otp collection as per requirements: "Delete all OTP generation, SMS sending, and phone verification logic"
    try {
      const otpCollection = db.collection('otprecords');
      if (otpCollection) {
        await otpCollection.drop();
        console.log('otprecords collection dropped.');
      }
    } catch(e) {}

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

migrate();
