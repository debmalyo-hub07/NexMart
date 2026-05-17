const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

async function resetAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Check if admin exists
    const admins = await db.collection('admins').find({}).toArray();
    console.log('Admins found:', admins.map(a => a.email));

    // Also let's clear the customers and deliveryagents as user requested
    await db.collection('customers').deleteMany({});
    console.log('Customers deleted.');

    await db.collection('deliveryagents').deleteMany({});
    console.log('Delivery agents deleted.');

    // Force create/update admin
    const email = 'debmalyobarman2003@gmail.com';
    const password = 'Admin@1234';
    const hashedPassword = await bcrypt.hash(password, 12);

    await db.collection('admins').updateOne(
      { email },
      { 
        $set: { 
          name: 'Debmalyo Barman', 
          email, 
          password: hashedPassword, 
          role: 'admin',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log(`Admin ${email} reset with password ${password}`);
    
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

resetAdmin();
