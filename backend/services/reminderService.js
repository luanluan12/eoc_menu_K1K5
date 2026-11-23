const Menu = require("../models/Menu");
const Order = require("../models/Order");
const User = require("../models/User");
const sendMail = require("../utils/mail");
const getFrontendUrl = require("../utils/frontendUrl");

const frontendUrl = getFrontendUrl();

const buildReminder = (user) => {
  if (user.language === "en") {
    return {
      subject: "Meal order reminder",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Hello ${user.name},</h2>
          <p>You have not placed your meal order for next week yet.</p>
          <p>Please sign in and place your order before the deadline so the kitchen can prepare your meal.</p>
          <p style="margin:24px 0;"><a href="${frontendUrl}/" style="background:#2563eb;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Place your order</a></p>
          <p>Thank you.</p><hr><p style="font-size:12px;color:#777;">This email was sent automatically by the Food Ordering System.</p>
        </div>
      `,
    };
  }

  return {
    subject: "Nhắc nhở đặt suất ăn",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Xin chào ${user.name},</h2>
        <p>Bạn vẫn chưa đặt suất ăn cho <strong>tuần tới</strong>.</p>
        <p>Vui lòng đăng nhập vào hệ thống và hoàn tất việc đặt món trước thời hạn để bộ phận bếp có thể chuẩn bị đầy đủ.</p>
        <p style="margin:24px 0;"><a href="${frontendUrl}/" style="background:#2563eb;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Đặt món ngay</a></p>
        <p>Xin cảm ơn!</p><hr><p style="font-size:12px;color:#777;">Đây là email được gửi tự động từ hệ thống đặt suất ăn.</p>
      </div>
    `,
  };
};

module.exports = async () => {
  console.log("========== Nhắc nhở đặt cơm ==========");

  const menus = await Menu.find({
    status: "published",
    deadline: { $gte: new Date() },
  }).sort({ deadline: 1 });

  if (menus.length === 0) {
    console.log("Không có thực đơn đã phát hành.");
    return null;
  }

  let totalGuests = 0;
  let orderedGuests = 0;
  let reminders = 0;
  let sent = 0;
  let failed = 0;

  for (const menu of menus) {
    const guestType = menu.guestType === "expert" ? "expert" : "employee";
    const users = await User.find({ role: "guest", guestType });
    const orderedIds = new Set(
      (await Order.find({ menu: menu._id, status: "ordered" }).distinct("user"))
        .map((id) => String(id)),
    );
    const needReminder = users.filter((user) => !orderedIds.has(String(user._id)));

    totalGuests += users.length;
    orderedGuests += users.length - needReminder.length;
    reminders += needReminder.length;
    console.log(`Tuần ${menu.week} (${guestType}): ${users.length} user, ${needReminder.length} cần nhắc.`);

    for (const user of needReminder) {
      try {
        await sendMail({ to: user.email, ...buildReminder(user) });
        sent += 1;
        console.log("✔ Đã gửi:", user.email);
      } catch (err) {
        failed += 1;
        console.log("✘ Gửi thất bại:", user.email, err.message);
      }
    }
  }

  return { menus, totalGuests, orderedGuests, total: reminders, sent, failed };
};
