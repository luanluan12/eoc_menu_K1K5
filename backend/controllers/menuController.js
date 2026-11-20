const Menu = require("../models/Menu");
const User = require("../models/User");

const sendMail = require("../utils/mail");
const orderMailTemplate = require("../utils/orderMailTemplate");
const { copyMenuImage, deleteMenuImage } = require("../services/r2Storage");
const Order = require("../models/Order");
const { createOrderToken } = require("../utils/orderToken");
const getFrontendUrl = require("../utils/frontendUrl");
const mongoose = require("mongoose");

const normalizeMeals = async (meals = {}, resolveImage = async (_period, _category, _index, item) => ({ image: item?.image || "", imagePublicId: item?.imagePublicId || "" })) => {
  const result = {};
  for (const period of ["lunch", "dinner"]) {
    result[period] = {};
    for (const category of ["rice", "vegetarian", "noodles", "soup"]) {
      result[period][category] = await Promise.all((meals?.[period]?.[category] || []).map(async (item, index) => {
        const imageInfo = await resolveImage(period, category, index, item);
        return {
          _id: item?._id || new mongoose.Types.ObjectId(),
          name: typeof item === "string" ? item : item?.name || "",
          nameEn: item?.nameEn || "",
          image: imageInfo.image || "",
          imagePublicId: imageInfo.imagePublicId || "",
          subtitle: item?.subtitle || "",
          subtitleEn: item?.subtitleEn || "",
          category,
        };
      }));
    }
  }
  return result;
};

exports.createMenu = async (req, res) => {
  try {
    const { week, year, openTime, deadline } = req.body;

    if (!week) {
      return res.status(400).json({
        success: false,

        message: "Week is required.",
      });
    }

    const existed = await Menu.findOne({
      week,
    });

    if (existed) {
      return res.status(400).json({
        success: false,

        message: "Menu tuần đã tồn tại.",
      });
    }

    let days = [];

    try {
      days = JSON.parse(req.body.days || "[]");
    } catch {
      return res.status(400).json({
        success: false,

        message: "Dữ liệu days không hợp lệ.",
      });
    }

    if (days.length !== 6) {
      return res.status(400).json({
        success: false,

        message: "Một tuần phải có đúng 6 ngày.",
      });
    }

    const findFile = (fieldName) => {
      return req.files.find((file) => file.fieldname === fieldName);
    };

    const getImage = async (fieldName, dish = {}) => {
      const file = findFile(fieldName);

      if (file) {
        return {
          image: file.path,
          imagePublicId: file.filename,
        };
      }

      const copiedImage = await copyMenuImage(dish.imagePublicId);
      if (copiedImage) return copiedImage;

      // Ảnh cũ ngoài R2 không thể copy bằng key; giữ URL nhưng không nhận quyền xoá.
      return { image: dish.image || "", imagePublicId: "" };
    };

    const resultDays = await Promise.all(days.map(async (day, dayIndex) => {
      const mains = await Promise.all((day.mains || []).map(async (dish, index) => {
        const imageInfo = await getImage(`main_${dayIndex}_${index}_image`, dish);

        return {
          name: dish.name,

          nameEn: dish.nameEn || "",

          subtitle: dish.subtitle || "",

          subtitleEn: dish.subtitleEn || "",

          vegetarian: dish.vegetarian || false,

          type: dish.type,

          image: imageInfo.image,

          imagePublicId: imageInfo.imagePublicId,
        };
      }));

      const drinks = await Promise.all((day.drinks || []).map(async (dish, index) => {
        const imageInfo = await getImage(`drink_${dayIndex}_${index}_image`, dish);

        return {
          name: dish.name,

          nameEn: dish.nameEn || "",

          subtitle: dish.subtitle || "",

          subtitleEn: dish.subtitleEn || "",

          type: "drink",

          image: imageInfo.image,

          imagePublicId: imageInfo.imagePublicId,
        };
      }));

      const soups = await Promise.all((day.soups || []).map(async (dish, index) => {
        const imageInfo = await getImage(`soup_${dayIndex}_${index}_image`, dish);

        return {
          name: dish.name,

          nameEn: dish.nameEn || "",

          subtitle: dish.subtitle || "",

          subtitleEn: dish.subtitleEn || "",

          type: "soup",

          image: imageInfo.image,

          imagePublicId: imageInfo.imagePublicId,
        };
      }));

      const desserts = await Promise.all((day.desserts || []).map(async (dish, index) => {
        const imageInfo = await getImage(`dessert_${dayIndex}_${index}_image`, dish);

        return {
          name: dish.name,

          nameEn: dish.nameEn || "",

          subtitle: dish.subtitle || "",

          subtitleEn: dish.subtitleEn || "",

          type: "dessert",

          image: imageInfo.image,

          imagePublicId: imageInfo.imagePublicId,
        };
      }));

      return {
        date: day.date,

        orderingClosed: Boolean(day.orderingClosed),

        mains,

        drinks,

        soups,

        desserts,

        meals: await normalizeMeals(day.meals, (period, category, index, item) => getImage(`meal_${dayIndex}_${period}_${category}_${index}_image`, item)),
      };
    }));

    const menu = await Menu.create({
      week,

      year,

      status: "draft",

      openTime,

      deadline,

      days: resultDays,
    });

    return res.status(201).json({
      success: true,

      message: "Tạo Menu tuần thành công.",

      data: menu,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

/**
 * Danh sách Menu tuần
 */
exports.getMenus = async (req, res) => {
  try {
    const menus = await Menu.find()

      .sort({
        year: -1,

        week: -1,
      });

    return res.json({
      success: true,

      data: menus,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

/**
 * Lấy Menu tuần
 */
exports.getWeekMenu = async (req, res) => {
  try {
    const filter = { status: "published" };
    if (req.query.week) filter.week = req.query.week;

    const menu = await Menu.findOne(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: menu,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Cập nhật Menu tuần
 */
exports.updateMenu = async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy Menu.",
      });
    }

    if (menu.status === "published") {
      return res.status(400).json({
        success: false,

        message: "Không thể chỉnh sửa Menu đã Publish.",
      });
    }

    const { week, year, status } = req.body;

    let days = [];

    try {
      days = JSON.parse(req.body.days || "[]");
    } catch {
      return res.status(400).json({
        success: false,

        message: "Dữ liệu days không hợp lệ.",
      });
    }

    if (![5, 6].includes(days.length)) {
      return res.status(400).json({
        success: false,

        message: "Menu phải có 5 hoặc 6 ngày.",
      });
    }
    const findFile = (fieldName) => {
      return req.files.find((file) => file.fieldname === fieldName);
    };

    const destroyImage = async (publicId) => {
      if (!publicId) return;

      try {
        await deleteMenuImage(publicId);
      } catch (err) {
        console.log(err.message);
      }
    };

    const getImage = async (
      fieldName,

      oldImage = "",

      oldPublicId = "",
    ) => {
      const file = findFile(fieldName);

      if (!file) {
        return {
          image: oldImage,

          imagePublicId: oldPublicId,
        };
      }

      // Có upload ảnh mới

      if (oldPublicId) {
        await destroyImage(oldPublicId);
      }

      return {
        image: file.path,

        imagePublicId: file.filename,
      };
    };

    const resultDays = await Promise.all(
      days.map(async (day, dayIndex) => {
        const oldDay = menu.days[dayIndex] || {};
        const mains = await Promise.all(
          (day.mains || []).map(async (dish, index) => {
            const oldDish = oldDay?.mains?.[index] || {};

            const imageInfo = await getImage(
              `main_${dayIndex}_${index}_image`,

              dish.image || oldDish.image || "",

              dish.imagePublicId || oldDish.imagePublicId || "",
            );

            return {
              name: dish.name,

              nameEn: dish.nameEn || "",

              subtitle: dish.subtitle || "",

              subtitleEn: dish.subtitleEn || "",

              vegetarian: dish.vegetarian || false,

              type: dish.type,

              image: imageInfo.image,

              imagePublicId: imageInfo.imagePublicId,
            };
          }),
        );
        const drinks = await Promise.all(
          (day.drinks || []).map(async (dish, index) => {
            const oldDish = oldDay?.drinks?.[index] || {};

            const imageInfo = await getImage(
              `drink_${dayIndex}_${index}_image`,

              dish.image || oldDish.image || "",

              dish.imagePublicId || oldDish.imagePublicId || "",
            );

            return {
              name: dish.name,

              nameEn: dish.nameEn || "",

              subtitle: dish.subtitle || "",

              subtitleEn: dish.subtitleEn || "",

              type: "drink",

              image: imageInfo.image || oldDish.image || "",

              imagePublicId: imageInfo.imagePublicId,
            };
          }),
        );

        const soups = await Promise.all(
          (day.soups || []).map(async (dish, index) => {
            const oldDish = oldDay?.soups?.[index] || {};

            const imageInfo = await getImage(
              `soup_${dayIndex}_${index}_image`,

              dish.image || oldDish.image || "",

              dish.imagePublicId || oldDish.imagePublicId || "",
            );

            return {
              name: dish.name,

              nameEn: dish.nameEn || "",

              subtitle: dish.subtitle || "",

              subtitleEn: dish.subtitleEn || "",

              type: "soup",

              image: imageInfo.image || oldDish.image || "",

              imagePublicId: imageInfo.imagePublicId,
            };
          }),
        );

        const desserts = await Promise.all(
          (day.desserts || []).map(async (dish, index) => {
            const oldDish = oldDay?.desserts?.[index] || {};

            const imageInfo = await getImage(
              `dessert_${dayIndex}_${index}_image`,

              dish.image || oldDish.image || "",

              dish.imagePublicId || oldDish.imagePublicId || "",
            );

            return {
              name: dish.name,

              nameEn: dish.nameEn || "",

              subtitle: dish.subtitle || "",

              subtitleEn: dish.subtitleEn || "",

              type: "dessert",

              image: imageInfo.image || oldDish.image || "",

              imagePublicId: imageInfo.imagePublicId,
            };
          }),
        );

        return {
          date: day.date,

          orderingClosed: Boolean(day.orderingClosed ?? oldDay.orderingClosed),

          mains,

          drinks,

          soups,

          desserts,

          meals: await normalizeMeals(day.meals, (period, category, index, item) => getImage(
            `meal_${dayIndex}_${period}_${category}_${index}_image`,
            item?.image || "",
            item?.imagePublicId || "",
          )),
        };
      }),
    );

    for (const [dayIndex, oldDay] of menu.days.entries()) {
      for (const period of ["lunch", "dinner"]) {
        for (const category of ["rice", "vegetarian", "noodles", "soup"]) {
          const keptIds = new Set((resultDays[dayIndex]?.meals?.[period]?.[category] || []).map((dish) => dish.imagePublicId).filter(Boolean));
          for (const oldDish of oldDay.meals?.[period]?.[category] || []) {
            if (oldDish.imagePublicId && !keptIds.has(oldDish.imagePublicId)) {
              await destroyImage(oldDish.imagePublicId);
            }
          }
        }
      }
    }

    menu.week = week || menu.week;

    menu.year = year || menu.year;

    menu.status = status || menu.status;

    menu.days = resultDays;
    menu.openTime = req.body.openTime || menu.openTime;

    menu.deadline = req.body.deadline || menu.deadline;

    await menu.save();

    return res.json({
      success: true,

      message: "Cập nhật Menu thành công.",

      data: menu,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

/**
 * Xóa Menu tuần
 */
exports.deleteMenu = async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy Menu.",
      });
    }

    // Xóa toàn bộ ảnh trên Cloudflare R2

    for (const day of menu.days) {
      const dishes = [
        ...(day.mains || []),
        ...(day.drinks || []),
        ...(day.soups || []),
        ...(day.desserts || []),
      ];

      for (const dish of dishes) {
        if (!dish.imagePublicId) continue;

        try {
          await deleteMenuImage(dish.imagePublicId);
        } catch (err) {
          console.log("Delete R2:", err.message);
        }
      }
    }

    // Xóa toàn bộ đơn đặt món của tuần này
    await Order.deleteMany({
      week: menu.week,
    });

    // Xóa Menu
    await menu.deleteOne();

    return res.json({
      success: true,
      message: "Xóa Menu và toàn bộ đơn đặt món thành công.",
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Publish Menu tuần
 */
exports.publishMenu = async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,

        message: "Menu not found.",
      });
    }

    if (menu.status === "published") {
      return res.status(400).json({
        success: false,

        message: "Menu đã được Publish.",
      });
    }

    // Publish Menu
    menu.status = "published";
    // Thời gian mở đặt món là thời điểm admin gửi/publish menu.
    menu.openTime = new Date();

    await menu.save();

    // Lấy toàn bộ User đặt cơm
    const users = await User.find({
      role: "guest",
    });

    let sent = 0;

    for (const user of users) {
      try {
        const language = (user.language || "vi").toLowerCase();

        await sendMail({
          to: user.email,
          subject:
            language === "en"
              ? `Weekly menu for ${menu.week}`
              : `Thực đơn tuần ${menu.week}`,
          html: orderMailTemplate(
            user,
            menu,
            getFrontendUrl(),
            language,
          ),
        });

        sent++;
      } catch (mailError) {
        console.log(`Send mail failed: ${user.email}`);

        console.log(mailError.message);
      }
    }

    res.json({
      success: true,

      message: `Menu tuần ${menu.week} đã được Publish.`,

      sent,

      total: users.length,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

exports.setDayOrderingClosed = async (req, res) => {
  try {
    const { closed } = req.body;
    if (typeof closed !== "boolean") {
      return res.status(400).json({ success: false, message: "Trạng thái khóa không hợp lệ." });
    }

    const menu = await Menu.findById(req.params.id);
    if (!menu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy Menu." });
    }

    const day = menu.days.id(req.params.dayId);
    if (!day) {
      return res.status(404).json({ success: false, message: "Không tìm thấy ngày trong menu." });
    }

    day.orderingClosed = closed;
    await menu.save();
    return res.json({ success: true, data: menu });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMenuById = async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy Menu.",
      });
    }

    return res.json({
      success: true,

      data: menu,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};
