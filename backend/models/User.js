const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    kitchen: {
      type: String,
      default: "K1",
    },

    role: {
      type: String,
      enum: [
        "admin",
        "admin_kitchen",
        "guest",
      ],
      default: "guest",
    },
    language: {
      type: String,

      enum: ["vi", "en"],

      default: "vi",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    inactiveFrom: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Phục vụ thống kê Dashboard theo vai trò và bếp.
userSchema.index({ role: 1, kitchen: 1 });

module.exports = mongoose.model("User", userSchema);
