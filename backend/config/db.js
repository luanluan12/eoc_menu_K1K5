const mongoose = require("mongoose");
const User = require("../models/User");
const Menu = require("../models/Menu");

const connectDB = async () => {
  try {

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    // Legacy menus had a unique index on `week`. Replace it with week + audience
    // so the same week can have one employee menu and one expert menu.
    await Menu.createCollection().catch(() => {});
    await Menu.updateMany(
      { guestType: { $exists: false } },
      { $set: { guestType: "employee" } },
    );
    const menuIndexes = await Menu.collection.indexes();
    const legacyWeekIndex = menuIndexes.find(
      (index) => index.unique && index.key?.week === 1 && Object.keys(index.key).length === 1,
    );
    if (legacyWeekIndex) {
      await Menu.collection.dropIndex(legacyWeekIndex.name);
      console.log("Migrated unique menu week index to support separate audiences.");
    }
    await Menu.collection.createIndex(
      { week: 1, guestType: 1 },
      { unique: true, name: "week_1_guestType_1" },
    );

    const guestTypeMigration = await User.updateMany(
      { role: "guest", $or: [{ guestType: { $exists: false } }, { guestType: null }] },
      { $set: { guestType: "employee" } },
    );
    if (guestTypeMigration.modifiedCount > 0) {
      console.log(`Migrated ${guestTypeMigration.modifiedCount} legacy guest(s) to employee type.`);
    }

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
    throw err;
  }
};

module.exports = connectDB;
