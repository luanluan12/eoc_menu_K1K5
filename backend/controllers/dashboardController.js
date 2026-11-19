const User = require("../models/User");
const Order = require("../models/Order");
const moment = require("moment-timezone");

exports.getDashboard = async (req, res) => {
  try {
    const supportedKitchens = ["K1", "K5"];
    const kitchensInScope =
      req.user.role === "admin_kitchen"
        ? supportedKitchens.includes(req.user.kitchen)
          ? [req.user.kitchen]
          : []
        : supportedKitchens;
    const userFilter = {
      role: "guest",
      kitchen: { $in: kitchensInScope },
    };

    if (req.user.role === "admin_kitchen") {
      userFilter.kitchen = kitchensInScope[0] || { $in: [] };
    }

    const startOfDay = moment()
      .tz("Asia/Ho_Chi_Minh")
      .startOf("day");
    const endOfDay = startOfDay.clone().add(1, "day");
    const dateRange = {
      $gte: startOfDay.toDate(),
      $lt: endOfDay.toDate(),
    };

    // Hai truy vấn độc lập chạy song song. MongoDB chỉ lấy các order có món
    // trong ngày hôm nay thay vì tải toàn bộ lịch sử về Node.js để lọc.
    const [totalUsers, kitchenStats] = await Promise.all([
      User.countDocuments(userFilter),
      Order.aggregate([
        {
          $match: {
            status: "ordered",
            days: { $elemMatch: { date: dateRange } },
          },
        },
        { $unwind: "$days" },
        { $match: { "days.date": dateRange } },
        {
          $match: {
            $or: [
              { "days.mains.0": { $exists: true } },
              { "days.drink": { $ne: null } },
              { "days.soup": { $ne: null } },
            ],
          },
        },
        {
          $lookup: {
            from: User.collection.name,
            localField: "user",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        { $match: { "user.kitchen": { $in: kitchensInScope } } },
        {
          $group: {
            _id: "$user.kitchen",
            ordered: { $sum: 1 },
            received: {
              $sum: { $cond: [{ $eq: ["$days.received", true] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const kitchenStatsByName = new Map(
      kitchenStats.map((item) => [item._id, item]),
    );
    const kitchens = kitchensInScope.map((kitchen) => {
      const stats = kitchenStatsByName.get(kitchen);
      const ordered = stats?.ordered || 0;
      const received = stats?.received || 0;

      return {
        kitchen,
        ordered,
        received,
        pending: ordered - received,
      };
    });
    const todayOrders = kitchens.reduce((sum, item) => sum + item.ordered, 0);
    const received = kitchens.reduce((sum, item) => sum + item.received, 0);

    return res.json({
      success: true,
      data: {
        totalUsers,
        todayOrders,
        received,
        pending: todayOrders - received,
        kitchens,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
