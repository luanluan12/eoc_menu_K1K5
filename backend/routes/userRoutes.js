const express = require("express");
const router = express.Router();

const multer = require("multer");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const userController = require("../controllers/userController");

// ==========================
// Upload Excel
// ==========================

const upload = multer({
  dest: "uploads/",
});

// ==========================
// USER CRUD
// ==========================

// Danh sách User
router.get(
  "/",
  auth,
  admin("admin", "admin_kitchen"),
  userController.getUsers,
);

// Thêm User
router.post(
  "/",
  auth,
  admin("admin", "admin_kitchen"),
  userController.createUser,
);

// Cập nhật User
router.put(
  "/:id",
  auth,
  admin("admin", "admin_kitchen"),
  userController.updateUser,
);

// Nghỉ việc
router.put(
  "/:id/resign",
  auth,
  admin("admin", "admin_kitchen"),
  userController.resignUser,
);

// Xóa User
router.delete(
  "/:id",
  auth,
  admin("admin", "admin_kitchen"),
  userController.deleteUser,
);

// ==========================
// PASSWORD
// ==========================

// Đổi mật khẩu
router.put("/change-password", auth, userController.changePassword);

// Reset mật khẩu
router.put(
  "/reset-password/:id",
  auth,
  admin("admin", "admin_kitchen"),
  userController.resetPassword,
);

// ==========================
// SEARCH
// ==========================

// Tìm kiếm User
router.get(
  "/search",
  auth,
  admin("admin", "admin_kitchen"),
  userController.searchUsers,
);

// Phân trang
router.get("/page", auth, admin("admin"), userController.pagination);

// ==========================
// IMPORT EXCEL
// ==========================

router.post(
  "/import",
  auth,
  admin("admin", "admin_kitchen"),
  upload.single("file"),
  userController.importExcel,
);

router.get(
  "/template",
  auth,
  admin("admin", "admin_kitchen"),
  userController.downloadTemplate,
);

// ==========================
// GET USER BY ID
// ==========================

router.get(
  "/:id",
  auth,
  admin("admin", "admin_kitchen"),
  userController.getUserById,
);

module.exports = router;
