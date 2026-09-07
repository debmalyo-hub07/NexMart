const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Credentials come from the environment — never hardcoded (a plaintext seed
// password sat in this file in git history; rotated 2026-09-08).
const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;

async function resetAdmin() {
  try {
    if (!email || !password) {
      console.error(
        'Missing ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD in the environment.\n' +
        'Set them in ../.env (see .env.example) and rerun: node reset-admin.js'
      );
      process.exit(1);
    }

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
    console.log(`Admin ${email} reset — password taken from ADMIN_SEED_PASSWORD (never printed).`);

  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

resetAdmin();
