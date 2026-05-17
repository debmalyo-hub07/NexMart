const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

async function drop() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.db.collection('otps').drop();
    console.log('otps collection dropped');
  } catch(e) {
    console.log(e.message);
  }
  process.exit(0);
}
drop();
