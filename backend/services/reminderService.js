const Menu = require("../models/Menu");
const Order = require("../models/Order");
const User = require("../models/User");
const sendMail = require("../utils/mail");
const getFrontendUrl = require("../utils/frontendUrl");

const frontendUrl = getFrontendUrl();

module.exports = async () => {
  console.log("========== Nhắc nhở đặt cơm ==========");

  const menu = await Menu.findOne({
    status: "published",
    deadline: {
      $gte: new Date(),
    },
  }).sort({
    deadline: 1,
  });

  if (!menu) {
    console.log("Không có thực đơn đã phát hành.");
    return null;
  }

  if (new Date() > menu.deadline) {
    return null;
  }

  const users = await User.find({
    role: "guest",
  });

  const orderedIds = await Order.find({
    week: menu.week,
    status: "ordered",
  }).distinct("user");

  const needReminder = users.filter(
    (user) => !orderedIds.some((id) => id.toString() === user._id.toString()),
  );

  console.log("Tuần:", menu.week);
  console.log("Tổng nhân viên:", users.length);
  console.log("Đã đặt:", orderedIds.length);
  console.log("Cần nhắc:", needReminder.length);

  let sent = 0;
  let failed = 0;

  for (const user of needReminder) {
    try {
      let subject = "";
      let html = "";

      if (user.language === "en") {
        subject = "Meal order reminder";

        html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Hello ${user.name},</h2>

            <p>You have not placed your meal order for next week yet.</p>

            <p>
              Please sign in and place your order before the deadline so the kitchen can prepare your meal.
            </p>

            <p style="margin:24px 0;">
              <a
                href="${frontendUrl}/"
                style="
                  background:#2563eb;
                  color:white;
                  padding:12px 20px;
                  text-decoration:none;
                  border-radius:6px;
                  display:inline-block;
                "
              >
                Place your order
              </a>
            </p>

            <p>Thank you.</p>

            <hr>

            <p style="font-size:12px;color:#777;">
              This email was sent automatically by the Food Ordering System.
            </p>
          </div>
        `;
      } else {
        subject = "Nhắc nhở đặt suất ăn";

        html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Xin chào ${user.name},</h2>

            <p>Bạn vẫn chưa đặt suất ăn cho <strong>tuần tới</strong>.</p>

            <p>
              Vui lòng đăng nhập vào hệ thống và hoàn tất việc đặt món trước thời hạn
              để bộ phận bếp có thể chuẩn bị đầy đủ.
            </p>

            <p style="margin:24px 0;">
              <a
                href="${frontendUrl}/"
                style="
                  background:#2563eb;
                  color:white;
                  padding:12px 20px;
                  text-decoration:none;
                  border-radius:6px;
                  display:inline-block;
                "
              >
                Đặt món ngay
              </a>
            </p>

            <p>Xin cảm ơn!</p>

            <hr>

            <p style="font-size:12px;color:#777;">
              Đây là email được gửi tự động từ hệ thống đặt suất ăn.
            </p>
          </div>
        `;
      }

      await sendMail({
        to: user.email,
        subject,
        html,
      });

      sent += 1;
      console.log("✔ Đã gửi:", user.email);
    } catch (err) {
      failed += 1;
      console.log("✘ Gửi thất bại:", user.email);
    }
  }

  return {
    menu,
    totalGuests: users.length,
    orderedGuests: users.length - needReminder.length,
    total: needReminder.length,
    sent,
    failed,
  };
};
