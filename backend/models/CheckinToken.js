const mongoose = require("mongoose");

const checkinTokenSchema = new mongoose.Schema(
  {
    kitchen: {
      type: String,
      required: true,
    },

    token: {
      type: String,
      required: true,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);
checkinTokenSchema.index(
  {
    kitchen: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("CheckinToken", checkinTokenSchema);
