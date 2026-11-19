const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const admin = require("../middleware/admin");

const dashboardController = require("../controllers/dashboardController");

router.get(

    "/",

    auth,

    admin("admin", "admin_kitchen"),

    dashboardController.getDashboard

);

module.exports = router;    
