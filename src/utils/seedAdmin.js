/**
 * Controlled Administrator Account Creation Script
 * Allows system administrators to securely initialize or reset the admin account.
 */

const bcrypt = require('bcryptjs');
const { connectDB, closeDB } = require('../config/db');
require('dotenv').config();

async function seedAdmin() {
  const db = await connectDB();
  const usersCol = db.collection('users');

  const email = process.env.ADMIN_EMAIL || 'admin@bloodlink.org';
  const password = process.env.ADMIN_PASSWORD || 'Admin@BloodLink2026';
  const name = process.env.ADMIN_NAME || 'BloodLink Administrator';
  const phone = process.env.ADMIN_PHONE || '9876543210';
  const city = process.env.ADMIN_CITY || 'Ahmedabad';
  const locality = process.env.ADMIN_LOCALITY || 'Navrangpura';

  console.log(`[Admin Seed] Configuring administrator account for ${email}...`);

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await usersCol.updateOne(
    { email: email },
    {
      $set: {
        name,
        email,
        passwordHash,
        phone,
        city,
        locality,
        role: 'admin',
        status: 'active',
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log(`✔ Administrator configured successfully.`);
  console.log(`  Email: ${email}`);
  console.log(`  Role: admin`);
  await closeDB();
}

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding admin:', err);
      process.exit(1);
    });
}

module.exports = { seedAdmin };
