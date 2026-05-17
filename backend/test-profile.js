const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });
const { Admin } = require('./src/models/Admin');

async function testProfile() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const admin = await Admin.findOne({ email: 'debmalyobarman2003@gmail.com' });
  console.log("Admin from DB:", admin.toObject());

  // simulate API response
  const responseData = admin;
  console.log("What API sends:", responseData);
  
  process.exit(0);
}

testProfile();
