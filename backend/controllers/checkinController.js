const crypto = require("crypto");
const QRCode = require("qrcode");
const moment = require("moment-timezone");
const Order = require("../models/Order");
const User = require("../models/User");

const CheckinToken = require("../models/CheckinToken");
const {
  getMealPeriodAt,
  getMealsForPeriod,
  getReceivedPeriods,
  isPeriodReceived,
  markPeriodReceived,
} = require("../utils/mealCheckin");

exports.getTodayQr = async (req, res) => {
  try {
    let checkin = await CheckinToken.findOne({
      kitchen: req.user.kitchen,
    });

    if (!checkin) {
      checkin = await CheckinToken.create({
        kitchen: req.user.kitchen,

        token: crypto.randomUUID(),

        active: true,
      });
    } else {
    }

    const qrImage = await QRCode.toDataURL(
      JSON.stringify({
        token: checkin.token,
      }),
    );

    return res.json({
      success: true,

      data: {
        kitchen: req.user.kitchen,

        token: checkin.token,

        qrImage,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

exports.getTodayCheckins = async (req, res) => {
  try {
    const startOfDay = moment().tz("Asia/Ho_Chi_Minh").startOf("day");
    const endOfDay = startOfDay.clone().add(1, "day");

    const users = await User.find({
      kitchen: req.user.kitchen,
    }).select("_id");

    const orders = await Order.find({
      status: "ordered",
      user: { $in: users.map((user) => user._id) },
      days: {
        $elemMatch: {
          date: {
            $gte: startOfDay.toDate(),
            $lt: endOfDay.toDate(),
          },
          $or: [
            { received: true },
            { receivedLunch: true },
            { receivedDinner: true },
          ],
        },
      },
    }).populate("user", "name email kitchen employeeId");

    const checkins = orders
      .flatMap((order) => {
        const day = order.days.find((item) =>
          moment(item.date).tz("Asia/Ho_Chi_Minh").isSame(startOfDay, "day"),
        );

        if (!day || !order.user) return [];

        return getReceivedPeriods(day).map((period) => ({
          orderId: order._id,
          mealPeriod: period,
          employee: {
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
            employeeId: order.user.employeeId,
          },
          receivedAt:
            (period === "lunch" ? day.receivedLunchAt : day.receivedDinnerAt) ||
            day.receivedAt,
          ...getMealsForPeriod(day, period),
        }));
      })
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    return res.json({
      success: true,
      data: checkins,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Thiếu token.",
      });
    }

    const today = moment().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");

    // ======================
    // Kiểm tra QR
    // ======================

    const checkin = await CheckinToken.findOne({
      token,

      active: true,
    });

    if (!checkin) {
      return res.status(400).json({
        success: false,
        message: "QR không hợp lệ",
      });
    }

    const mealPeriod = getMealPeriodAt();

    if (!mealPeriod) {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể nhận suất ăn trong khung giờ 06:00–21:00.",
      });
    }

    // ======================
    // Tìm Order
    // ======================

    const startOfToday = moment()
      .tz("Asia/Ho_Chi_Minh")
      .startOf("day")
      .toDate();

    const startOfTomorrow = moment()
      .tz("Asia/Ho_Chi_Minh")
      .add(1, "day")
      .startOf("day")
      .toDate();

    const order = await Order.findOne({
      user: req.user.id,
      status: "ordered",
      days: {
        $elemMatch: {
          date: {
            $gte: startOfToday,
            $lt: startOfTomorrow,
          },
        },
      },
    }).populate("user", "name email kitchen employeeId");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn cho hôm nay.",
      });
    }

    if (checkin.kitchen !== order.user.kitchen) {
      return res.status(403).json({
        success: false,
        message: "QR không thuộc bếp của bạn.",
      });
    }

    // ======================
    // Tìm ngày hôm nay
    // ======================

    const day = order.days.find((d) => {
      return (
        moment(d.date)
          .tz("Asia/Ho_Chi_Minh")

          .format("YYYY-MM-DD") === today
      );
    });

    if (!day) {
      return res.status(400).json({
        success: false,
        message: "Hôm nay không có suất ăn.",
      });
    }

    const mealData = getMealsForPeriod(day, mealPeriod);
    const hasMeal =
      mealData.mains.length > 0 || mealData.drink || mealData.soup;

    if (!hasMeal) {
      return res.status(400).json({
        success: false,
        message:
          mealPeriod === "lunch"
            ? "Bạn không đăng ký suất ăn buổi trưa hôm nay."
            : "Bạn không đăng ký suất ăn buổi chiều hôm nay.",
      });
    }

    if (isPeriodReceived(day, mealPeriod)) {
      return res.status(409).json({
        success: false,
        message:
          mealPeriod === "lunch"
            ? "Bạn đã nhận suất ăn buổi trưa."
            : "Bạn đã nhận suất ăn buổi chiều.",
      });
    }

    const receivedAt = new Date();
    markPeriodReceived(day, mealPeriod, receivedAt);

    await order.save();
    const io = req.app.get("io");

    io.emit("checkin-success", {
      orderId: order._id,
      employee: {
        name: order.user.name,

        email: order.user.email,

        kitchen: order.user.kitchen,

        employeeId: order.user.employeeId,
      },

      receivedAt,
      mealPeriod,

      ...mealData,
    });

    return res.json({
      success: true,
      message: "Check-in thành công.",
      data: {
        date: day.date,
        receivedAt,
        mealPeriod,
        ...mealData,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};
