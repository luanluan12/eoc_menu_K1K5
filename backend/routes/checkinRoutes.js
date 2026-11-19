const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const admin = require("../middleware/admin");

const checkinController = require("../controllers/checkinController");

router.get(
  "/today",

  auth,

  admin("admin", "admin_kitchen"),

  checkinController.getTodayQr,
);

router.get(
  "/today/checkins",
  auth,
  admin("admin", "admin_kitchen"),
  checkinController.getTodayCheckins,
);

router.post(
  "/",

  auth,

  checkinController.checkIn,
);

module.exports = router;
