const mongoose = require("mongoose");
const User = require("../models/User");

const connectDB = async () => {
  try {

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    const migration = await User.updateMany(
      { role: "admin_floor" },
      { $set: { role: "admin_kitchen" } },
    );

    if (migration.modifiedCount > 0) {
      console.log(
        `Migrated ${migration.modifiedCount} admin account(s) to admin_kitchen.`,
      );
    }

    const adminRoleMigration = await User.updateMany(
      { role: "admin_eocmn" },
      { $set: { role: "admin" } },
    );

    if (adminRoleMigration.modifiedCount > 0) {
      console.log(
        `Migrated ${adminRoleMigration.modifiedCount} account(s) to admin role.`,
      );
    }

    await User.updateMany(
      { role: "admin", kitchen: { $ne: "K1, K5" } },
      { $set: { kitchen: "K1, K5" } },
    );

    const languageMigration = await User.updateMany(
      { language: "ko" },
      { $set: { language: "en" } },
    );

    if (languageMigration.modifiedCount > 0) {
      console.log(
        `Migrated ${languageMigration.modifiedCount} user language setting(s) to English.`,
      );
    }

    console.log("MongoDB Connected");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
