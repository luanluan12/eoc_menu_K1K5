const ExcelJS = require("exceljs");
const moment = require("moment-timezone");

const Menu = require("../models/Menu");
const Order = require("../models/Order");
const User = require("../models/User");

// ======================================================
// Helpers
// ======================================================

function getCompany(email = "") {
  const e = email.toLowerCase();

  if (e.endsWith("@nexonnetworks.com")) {
    return "NEXON Networks VINA";
  }

  if (e.endsWith("@nexondv.com")) {
    return "NEXON Dev VINA";
  }

  if (e.endsWith("@nexonsv.com")) {
    return "NEXON Creative Studio VINA";
  }

  return "Khác";
}

function sortKitchenValues(a, b) {
  const order = { guest: 0, K1: 1, K5: 2 };
  const aOrder = order[a] ?? 3;
  const bOrder = order[b] ?? 3;

  return aOrder - bOrder || a.localeCompare(b);
}

const supportedKitchens = ["K1", "K5"];

async function getKitchenUserIds(req) {
  const kitchenFilter = {
    role: "guest",
    kitchen: { $in: supportedKitchens },
  };

  if (req.user.role === "admin_kitchen") {
    kitchenFilter.kitchen = supportedKitchens.includes(req.user.kitchen)
      ? req.user.kitchen
      : { $in: [] };
  }

  const users = await User.find(kitchenFilter).select("_id");
  return users.map((user) => user._id);
}

function getFoodName(day) {
  if (!day) return "";

  const foods = [];

  (day.mains || []).forEach((item) => {
    if (item.quantity > 0) {
      const meal = item.mealPeriod === "lunch" ? "Trưa" : item.mealPeriod === "dinner" ? "Chiều" : "";
      foods.push(`${meal ? `[${meal}] ` : ""}${item.name} x${item.quantity}`);
    }
  });

  if (day.drink?.name) {
    foods.push(day.drink.name);
  }

  if (day.soup?.name) {
    foods.push(day.soup.name);
  }

  return foods.join(", ");
}

function getMenuMainDishes(day) {
  const flexible = [];
  for (const period of ["lunch", "dinner"]) {
    for (const category of ["rice", "vegetarian", "noodles", "soup"]) {
      const periodLabel = period === "lunch" ? "Trưa" : "Chiều";
      const categoryLabels = { rice: "Món cơm", vegetarian: "Món chay", noodles: "Món nước", soup: "Món soup" };
      for (const dish of day?.meals?.[period]?.[category] || []) {
        flexible.push({ ...dish.toObject?.() || dish, name: `[${periodLabel} · ${categoryLabels[category]}] ${dish.name || ""}` });
      }
    }
  }
  return [...(day?.mains || []), ...flexible];
}

// ======================================================
// Export Daily Excel
// ======================================================

exports.exportDailyExcel = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: "Vui lòng chọn ngày.",
      });
    }

    const targetDate = moment(date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");

    // ==================================================
    // Tìm menu chứa ngày này
    // ==================================================

    const menus = await Menu.find();

    let selectedMenu = null;

    let selectedDay = null;

    for (const menu of menus) {
      const day = menu.days.find(
        (item) =>
          moment(item.date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD") ===
          targetDate,
      );

      if (day) {
        selectedMenu = menu;

        selectedDay = day;

        break;
      }
    }

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu của ngày này.",
      });
    }

    // ==================================================
    // Danh sách món của đúng ngày
    // ==================================================

    const headers = [];

    getMenuMainDishes(selectedDay).forEach((item) => {
      headers.push({
        type: "main",

        id: String(item._id),

        name: item.name,
      });
    });

    (selectedDay.drinks || []).forEach((item) => {
      headers.push({
        type: "drink",

        id: String(item._id),

        name: item.name,
      });
    });

    (selectedDay.soups || []).forEach((item) => {
      headers.push({
        type: "soup",

        id: String(item._id),

        name: item.name,
      });
    });

    // ==================================================
    // Lấy Order
    // ==================================================

    let orderFilter = {
      week: selectedMenu.week,
      status: "ordered",
    };

    orderFilter.user = { $in: await getKitchenUserIds(req) };

    const orders = await Order.find(orderFilter)
      .populate({
        path: "user",
        select: "employeeId name email kitchen",
      })
      .sort({
        "user.employeeId": 1,
      });

    // ==================================================
    // Workbook
    // ==================================================

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Food Ordering";

    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Food Report");

    sheet.properties.defaultRowHeight = 24;

    // ==================================================
    // Thống kê
    // ==================================================

    const totalSummary = {};

    const kitchenSummary = {};

    headers.forEach((item) => {
      totalSummary[item.name] = 0;
    });

    // current row

    let rowIndex = 1;

    // ==================================================
    // TITLE
    // ==================================================

    const lastColumn = headers.length + 3;

    sheet.mergeCells(1, 1, 1, lastColumn);

    sheet.getCell("A1").value =
      `BÁO CÁO THỐNG KÊ MÓN ĂN NGÀY ${moment(targetDate).format("DD/MM/YYYY")}`;

    sheet.getCell("A1").font = {
      name: "Times New Roman",

      size: 18,

      bold: true,
    };

    sheet.getCell("A1").alignment = {
      horizontal: "center",

      vertical: "middle",
    };

    sheet.getRow(1).height = 30;

    // ==================================================
    // HEADER
    // ==================================================

    rowIndex = 3;

    sheet.getCell(rowIndex, 1).value = "Employee ID";

    sheet.getCell(rowIndex, 2).value = "Email";

    sheet.getCell(rowIndex, 3).value = "Kitchen";

    let column = 4;

    headers.forEach((item) => {
      sheet.getCell(rowIndex, column).value = item.name;

      column++;
    });

    sheet.getRow(rowIndex).height = 45;

    sheet.getRow(rowIndex).eachCell((cell) => {
      cell.font = {
        bold: true,

        name: "Times New Roman",

        size: 13,
      };

      cell.alignment = {
        horizontal: "center",

        vertical: "middle",

        wrapText: true,
      };

      cell.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: "FFD9EAD3",
        },
      };

      cell.border = {
        top: {
          style: "thin",
        },

        left: {
          style: "thin",
        },

        bottom: {
          style: "thin",
        },

        right: {
          style: "thin",
        },
      };
    });

    // ==================================================
    // Column Width
    // ==================================================

    sheet.getColumn(1).width = 18;

    sheet.getColumn(2).width = 36;

    sheet.getColumn(3).width = 10;

    for (let i = 4; i <= lastColumn; i++) {
      sheet.getColumn(i).width = 18;
    }

    // ==================================================
    // DATA
    // ==================================================

    rowIndex++;

    for (const order of orders) {
      if (!order.user) continue;

      const day = order.days.find(
        (d) =>
          moment(d.date)
            .tz("Asia/Ho_Chi_Minh")

            .format("YYYY-MM-DD") === targetDate,
      );

      if (!day) continue;

      sheet.getCell(rowIndex, 1).value = order.user.employeeId;

      sheet.getCell(rowIndex, 2).value = order.user.email;

      sheet.getCell(rowIndex, 3).value = order.user.kitchen;

      const kitchen = String(order.user.kitchen);

      if (!kitchenSummary[kitchen]) {
        kitchenSummary[kitchen] = {};

        headers.forEach((item) => {
          kitchenSummary[kitchen][item.name] = 0;
        });
      }

      column = 4;

      headers.forEach((item) => {
        let value = "";

        // =====================
        // MAIN
        // =====================

        if (item.type === "main") {
          const found = day.mains.find((m) => String(m.dishId) === item.id);

          if (found) {
            value = found.quantity;

            totalSummary[item.name] += found.quantity;

            kitchenSummary[kitchen][item.name] += found.quantity;
          }
        }

        // =====================
        // DRINK
        // =====================
        else if (item.type === "drink") {
          if (day.drink && String(day.drink.dishId) === item.id) {
            value = 1;

            totalSummary[item.name]++;

            kitchenSummary[kitchen][item.name]++;
          }
        }

        // =====================
        // SOUP
        // =====================
        else {
          if (day.soup && String(day.soup.dishId) === item.id) {
            value = 1;

            totalSummary[item.name]++;

            kitchenSummary[kitchen][item.name]++;
          }
        }

        sheet.getCell(
          rowIndex,

          column,
        ).value = value;

        column++;
      });

      sheet
        .getRow(rowIndex)

        .eachCell((cell) => {
          cell.border = {
            top: {
              style: "thin",
            },

            left: {
              style: "thin",
            },

            bottom: {
              style: "thin",
            },

            right: {
              style: "thin",
            },
          };

          cell.alignment = {
            horizontal: "center",

            vertical: "middle",
          };
        });

      rowIndex++;
    }

    // ==========================================
    // TỔNG SỐ LƯỢNG
    // ==========================================

    rowIndex++;

    sheet.getCell(rowIndex, 1).value = "TỔNG";

    sheet.getCell(rowIndex, 1).font = {
      bold: true,
      size: 13,
    };

    let col = 4;

    headers.forEach((item) => {
      sheet.getCell(rowIndex, col).value = totalSummary[item.name];

      sheet.getCell(rowIndex, col).font = {
        bold: true,
      };

      sheet.getCell(rowIndex, col).alignment = {
        horizontal: "center",
      };

      col++;
    });

    // ==========================================
    // THỐNG KÊ THEO BẾP
    // ==========================================

    rowIndex += 2;

    sheet.getCell(rowIndex, 1).value = "THỐNG KÊ THEO BẾP";

    sheet.getCell(rowIndex, 1).font = {
      bold: true,

      size: 14,
    };

    rowIndex++;

    Object.keys(kitchenSummary)
      .sort(sortKitchenValues)
      .forEach((kitchen) => {
        sheet.getCell(rowIndex, 1).value = `Bếp ${kitchen}`;

        col = 4;

        headers.forEach((item) => {
          sheet.getCell(rowIndex, col).value = kitchenSummary[kitchen][item.name];

          col++;
        });

        rowIndex++;
      });

    // ==========================================
    // Download
    // ==========================================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Food_Report_${targetDate}.xlsx`,
    );

    await workbook.xlsx.write(res);

    res.end();
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ======================================================
// Daily Report (JSON)
// ======================================================

exports.getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: "Vui lòng chọn ngày.",
      });
    }

    const targetDate = moment(date)
      .tz("Asia/Ho_Chi_Minh")

      .format("YYYY-MM-DD");

    // =====================================
    // Tìm menu
    // =====================================

    const menus = await Menu.find();

    let selectedMenu = null;

    let selectedDay = null;

    for (const menu of menus) {
      const day = menu.days.find(
        (item) =>
          moment(item.date)
            .tz("Asia/Ho_Chi_Minh")

            .format("YYYY-MM-DD") === targetDate,
      );

      if (day) {
        selectedMenu = menu;

        selectedDay = day;

        break;
      }
    }

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu.",
      });
    }

    // =====================================
    // Header
    // =====================================

    const headers = [];

    getMenuMainDishes(selectedDay).forEach((item) => {
      headers.push({
        type: "main",

        id: String(item._id),

        name: item.name,
      });
    });

    (selectedDay.drinks || []).forEach((item) => {
      headers.push({
        type: "drink",

        id: String(item._id),

        name: item.name,
      });
    });

    (selectedDay.soups || []).forEach((item) => {
      headers.push({
        type: "soup",

        id: String(item._id),

        name: item.name,
      });
    });

    // =====================================
    // Orders
    // =====================================

    let orderFilter = {
      week: selectedMenu.week,
      status: "ordered",
    };
    orderFilter.user = { $in: await getKitchenUserIds(req) };

    const orders = await Order.find(orderFilter).populate({
      path: "user",
      select: "employeeId name email kitchen",
    });
    const totals = {};

    const kitchens = {};

    headers.forEach((h) => {
      totals[h.name] = 0;
    });

    const rows = [];

    for (const order of orders) {
      if (!order.user) continue;

      const day = order.days.find(
        (d) =>
          moment(d.date)
            .tz("Asia/Ho_Chi_Minh")

            .format("YYYY-MM-DD") === targetDate,
      );

      if (!day) continue;
      const hasFood =
        day.mains.some((item) => item.quantity > 0) || day.drink || day.soup;

      if (!hasFood) continue;

      const kitchen = String(order.user?.kitchen ?? "K1");

      if (!kitchens[kitchen]) {
        kitchens[kitchen] = {};

        headers.forEach((h) => {
          kitchens[kitchen][h.name] = 0;
        });
      }

      const items = {};

      headers.forEach((h) => {
        items[h.name] = "";
      });

      // Main

      day.mains.forEach((main) => {
        const head = headers.find(
          (h) => h.type === "main" && h.id === String(main.dishId),
        );

        if (head) {
          items[head.name] = main.quantity;

          totals[head.name] += main.quantity;

          kitchens[kitchen][head.name] += main.quantity;
        }
      });

      // Drink

      if (day.drink) {
        const head = headers.find(
          (h) => h.type === "drink" && h.id === String(day.drink.dishId),
        );

        if (head) {
          items[head.name] = 1;

          totals[head.name]++;

          kitchens[kitchen][head.name]++;
        }
      }

      // Soup

      if (day.soup) {
        const head = headers.find(
          (h) => h.type === "soup" && h.id === String(day.soup.dishId),
        );

        if (head) {
          items[head.name] = 1;

          totals[head.name]++;

          kitchens[kitchen][head.name]++;
        }
      }

      rows.push({
        employeeId: order.user.employeeId,

        name: order.user.name,

        email: order.user.email,

        kitchen,

        received: day.received,

        items,
      });
    }

    const kitchenRows = Object.keys(kitchens)
      .sort(sortKitchenValues)
      .map((kitchen) => {
        const items = kitchens[kitchen];

        let mainTotal = 0;
        let drinkTotal = 0;
        let soupTotal = 0;

        headers.forEach((header) => {
          const qty = items[header.name] || 0;

          if (header.type === "main") {
            mainTotal += qty;
          } else if (header.type === "drink") {
            drinkTotal += qty;
          } else if (header.type === "soup") {
            soupTotal += qty;
          }
        });

        return {
          kitchen,
          items,
          total: mainTotal / 2 + drinkTotal + soupTotal,
        };
      });

    res.json({
      success: true,

      data: {
        date: targetDate,

        headers,

        rows,

        totals,

        kitchens: kitchenRows,
      },
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getLeftoverReport = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: "Vui lòng chọn ngày.",
      });
    }

    const targetDate = moment(date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");

    // =====================================
    // Tìm menu
    // =====================================

    const menus = await Menu.find();

    let selectedMenu = null;
    let selectedDay = null;

    for (const menu of menus) {
      const day = menu.days.find(
        (item) =>
          moment(item.date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD") ===
          targetDate,
      );

      if (day) {
        selectedMenu = menu;
        selectedDay = day;
        break;
      }
    }

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu.",
      });
    }

    // =====================================
    // Header
    // =====================================

    const headers = [];

    getMenuMainDishes(selectedDay).forEach((item) => {
      headers.push({
        type: "main",
        id: String(item._id),
        name: item.name,
      });
    });

    (selectedDay.drinks || []).forEach((item) => {
      headers.push({
        type: "drink",
        id: String(item._id),
        name: item.name,
      });
    });

    (selectedDay.soups || []).forEach((item) => {
      headers.push({
        type: "soup",
        id: String(item._id),
        name: item.name,
      });
    });

    // =====================================
    // Orders
    // =====================================

    const orderFilter = {
      week: selectedMenu.week,
      status: "ordered",
    };

    orderFilter.user = { $in: await getKitchenUserIds(req) };

    const orders = await Order.find(orderFilter).populate({
      path: "user",
      select: "employeeId name email kitchen",
    });

    // =====================================
    // Init
    // =====================================

    const leftovers = {};
    const kitchens = {};
    const users = [];

    headers.forEach((h) => {
      leftovers[h.name] = {
        name: h.name,
        type: h.type,
        quantity: 0,
        users: [],
      };
    });

    // =====================================
    // Statistics
    // =====================================

    for (const order of orders) {
      if (!order.user) continue;

      const day = order.days.find(
        (d) =>
          moment(d.date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD") ===
          targetDate,
      );

      if (!day) continue;

      // Chỉ thống kê người chưa nhận
      if (day.received) continue;

      const hasFood =
        day.mains.some((item) => item.quantity > 0) || day.drink || day.soup;

      if (!hasFood) continue;

      const foods = [];

      // Main
      day.mains.forEach((item) => {
        foods.push(
          `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`,
        );
      });

      // Drink
      if (day.drink) {
        foods.push(day.drink.name);
      }

      // Soup
      if (day.soup) {
        foods.push(day.soup.name);
      }

      users.push({
        employeeId: order.user.employeeId,
        name: order.user.name,
        email: order.user.email,
        kitchen: order.user.kitchen,
        foods,
      });

      const kitchen = String(order.user.kitchen ?? "K1");

      if (!kitchens[kitchen]) {
        kitchens[kitchen] = {};

        headers.forEach((h) => {
          kitchens[kitchen][h.name] = 0;
        });
      }

      // ==========================
      // MAIN
      // ==========================

      day.mains.forEach((main) => {
        const head = headers.find(
          (h) => h.type === "main" && h.id === String(main.dishId),
        );

        if (!head) return;

        leftovers[head.name].quantity += main.quantity;

        leftovers[head.name].users.push({
          employeeId: order.user.employeeId,
          name: order.user.name,
          email: order.user.email,
          kitchen: order.user.kitchen,
          quantity: main.quantity,
        });

        kitchens[kitchen][head.name] += main.quantity;
      });

      // ==========================
      // DRINK
      // ==========================

      if (day.drink) {
        const head = headers.find(
          (h) => h.type === "drink" && h.id === String(day.drink.dishId),
        );

        if (head) {
          leftovers[head.name].quantity++;

          leftovers[head.name].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
          });

          kitchens[kitchen][head.name]++;
        }
      }

      // ==========================
      // SOUP
      // ==========================

      if (day.soup) {
        const head = headers.find(
          (h) => h.type === "soup" && h.id === String(day.soup.dishId),
        );

        if (head) {
          leftovers[head.name].quantity++;

          leftovers[head.name].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
          });

          kitchens[kitchen][head.name]++;
        }
      }
    }

    // =====================================
    // Kitchen Summary
    // =====================================

    const kitchenRows = Object.keys(kitchens)
      .sort(sortKitchenValues)
      .map((kitchen) => {
        let mainTotal = 0;
        let drinkTotal = 0;
        let soupTotal = 0;

        headers.forEach((header) => {
          const value = kitchens[kitchen][header.name] || 0;

          switch (header.type) {
            case "main":
              mainTotal += value;
              break;

            case "drink":
              drinkTotal += value;
              break;

            case "soup":
              soupTotal += value;
              break;

            default:
              break;
          }
        });

        return {
          kitchen,
          items: kitchens[kitchen],
          total: Math.ceil(mainTotal / 2) + drinkTotal + soupTotal,
        };
      });

    // =====================================
    // Response
    // =====================================

    return res.json({
      success: true,
      data: {
        date: targetDate,
        leftovers: Object.values(leftovers)
          .filter((item) => item.quantity > 0)
          .sort((a, b) => b.quantity - a.quantity),

        kitchens: kitchenRows,

        users,
      },
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

// ======================================================
// Invoice Report (JSON)
// ======================================================

exports.getInvoiceReport = async (req, res) => {
  try {
    const {
      from,

      to,
    } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,

        message: "Thiếu khoảng thời gian.",
      });
    }

    const fromDate = moment(from)
      .tz("Asia/Ho_Chi_Minh")

      .startOf("day");

    const toDate = moment(to)
      .tz("Asia/Ho_Chi_Minh")

      .endOf("day");

    let orderFilter = {
      status: "ordered",
    };

    orderFilter.user = { $in: await getKitchenUserIds(req) };

    const orders = await Order.find(orderFilter)
      .populate({
        path: "user",
        select: "employeeId name email kitchen",
      })
      .sort({
        "user.employeeId": 1,
      });

    const rows = [];

    const companySummary = {};

    for (const order of orders) {
      if (!order.user) continue;

      for (const day of order.days) {
        const current = moment(day.date).tz("Asia/Ho_Chi_Minh");

        if (current.isBefore(fromDate) || current.isAfter(toDate)) {
          continue;
        }
        const food = getFoodName(day);

        if (!food) {
          continue;
        }

        const company = getCompany(order.user.email);

        companySummary[company] = (companySummary[company] || 0) + 1;

        rows.push({
          date: current.format("DD/MM/YYYY"),

          employeeId: order.user.employeeId,

          name: order.user.name,

          email: order.user.email,

          company,

          food,

          kitchen: order.user.kitchen,

          received: day.received,
        });
      }
    }

    rows.sort((a, b) => {
      if (a.date === b.date) {
        return a.employeeId.localeCompare(b.employeeId);
      }

      return (
        moment(
          a.date,

          "DD/MM/YYYY",
        ) -
        moment(
          b.date,

          "DD/MM/YYYY",
        )
      );
    });

    return res.json({
      success: true,

      data: {
        from,

        to,

        rows,

        summary: companySummary,
      },
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

// ======================================================
// Export Invoice Excel
// ======================================================

exports.exportInvoiceExcel = async (req, res) => {
  try {
    const {
      from,

      to,
    } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,

        message: "Thiếu khoảng thời gian.",
      });
    }

    const fromDate = moment(from)
      .tz("Asia/Ho_Chi_Minh")

      .startOf("day");

    const toDate = moment(to)
      .tz("Asia/Ho_Chi_Minh")

      .endOf("day");

    let orderFilter = {
      status: "ordered",
    };

    orderFilter.user = { $in: await getKitchenUserIds(req) };

    const orders = await Order.find(orderFilter)
      .populate({
        path: "user",
        select: "employeeId name email kitchen",
      })
      .sort({
        "user.employeeId": 1,
      });

    // ==========================================
    // Chuẩn bị dữ liệu
    // ==========================================

    const rows = [];

    const companySummary = {};

    for (const order of orders) {
      if (!order.user) continue;

      for (const day of order.days) {
        const current = moment(day.date).tz("Asia/Ho_Chi_Minh");

        if (current.isBefore(fromDate) || current.isAfter(toDate)) {
          continue;
        }
        const food = getFoodName(day);

        if (!food) {
          continue;
        }

        const company = getCompany(order.user.email);

        companySummary[company] = (companySummary[company] || 0) + 1;

        rows.push({
          date: current.format("DD/MM/YYYY"),

          employeeId: order.user.employeeId,

          name: order.user.name,

          email: order.user.email,

          kitchen: order.user.kitchen,

          company,

          food,
        });
      }
    }

    rows.sort((a, b) => {
      if (a.date === b.date) {
        return a.employeeId.localeCompare(b.employeeId);
      }

      return (
        moment(
          a.date,

          "DD/MM/YYYY",
        ) -
        moment(
          b.date,

          "DD/MM/YYYY",
        )
      );
    });

    // ==========================================
    // Workbook
    // ==========================================

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Food Ordering";

    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Invoice Report");

    sheet.properties.defaultRowHeight = 24;

    // ==========================================
    // Width
    // ==========================================

    sheet.columns = [
      {
        width: 15,
      },

      {
        width: 18,
      },

      {
        width: 28,
      },

      {
        width: 38,
      },

      { width: 10 },

      {
        width: 30,
      },

      {
        width: 45,
      },
    ];

    // ==========================================
    // Title
    // ==========================================

    sheet.mergeCells("A1:G1");

    sheet.getCell("A1").value =
      `BÁO CÁO SUẤT ĂN (${moment(from).format("DD/MM/YYYY")} - ${moment(to).format("DD/MM/YYYY")})`;

    sheet.getCell("A1").font = {
      bold: true,

      size: 18,

      name: "Times New Roman",
    };

    sheet.getCell("A1").alignment = {
      horizontal: "center",

      vertical: "middle",
    };

    sheet.getRow(1).height = 30;

    // ==========================================
    // Header
    // ==========================================

    const headers = [
      "Ngày",

      "Mã nhân viên",

      "Tên nhân viên",

      "Email",

      "Bếp",

      "Tên công ty",

      "Món ăn",
    ];

    headers.forEach((item, index) => {
      const cell = sheet.getCell(
        3,

        index + 1,
      );

      cell.value = item;

      cell.font = {
        bold: true,

        size: 12,

        name: "Times New Roman",
      };

      cell.alignment = {
        horizontal: "center",

        vertical: "middle",

        wrapText: true,
      };

      cell.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: "FFD9EAD3",
        },
      };

      cell.border = {
        top: {
          style: "thin",
        },

        left: {
          style: "thin",
        },

        bottom: {
          style: "thin",
        },

        right: {
          style: "thin",
        },
      };
    });

    let rowIndex = 4;
    // ==========================================
    // DATA
    // ==========================================

    rows.forEach((item) => {
      sheet.getCell(rowIndex, 1).value = item.date;
      sheet.getCell(rowIndex, 2).value = item.employeeId;
      sheet.getCell(rowIndex, 3).value = item.name;
      sheet.getCell(rowIndex, 4).value = item.email;
      sheet.getCell(rowIndex, 5).value = item.kitchen;
      sheet.getCell(rowIndex, 6).value = item.company;
      sheet.getCell(rowIndex, 7).value = item.food;

      for (let i = 1; i <= 7; i++) {
        const cell = sheet.getCell(rowIndex, i);

        cell.font = {
          name: "Times New Roman",

          size: 11,
        };

        cell.alignment = {
          vertical: "middle",

          horizontal: i === 7 ? "left" : "center",

          wrapText: true,
        };

        cell.border = {
          top: {
            style: "thin",
          },

          left: {
            style: "thin",
          },

          bottom: {
            style: "thin",
          },

          right: {
            style: "thin",
          },
        };
      }

      rowIndex++;
    });

    // ==========================================
    // SUMMARY
    // ==========================================

    rowIndex += 2;

    sheet.mergeCells(`A${rowIndex}:G${rowIndex}`);

    sheet.getCell(`A${rowIndex}`).value = "THỐNG KÊ THEO CÔNG TY";

    sheet.getCell(`A${rowIndex}`).font = {
      bold: true,

      size: 14,

      name: "Times New Roman",
    };

    sheet.getCell(`A${rowIndex}`).alignment = {
      horizontal: "center",
    };

    rowIndex++;

    sheet.getCell(rowIndex, 1).value = "Tên công ty";

    sheet.getCell(rowIndex, 2).value = "Số suất";

    ["A", "B"].forEach((col) => {
      const cell = sheet.getCell(`${col}${rowIndex}`);

      cell.font = {
        bold: true,

        name: "Times New Roman",
      };

      cell.alignment = {
        horizontal: "center",
      };

      cell.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: "FFD9EAD3",
        },
      };

      cell.border = {
        top: {
          style: "thin",
        },

        left: {
          style: "thin",
        },

        bottom: {
          style: "thin",
        },

        right: {
          style: "thin",
        },
      };
    });

    rowIndex++;

    Object.keys(companySummary)

      .sort()

      .forEach((company) => {
        sheet.getCell(rowIndex, 1).value = company;

        sheet.getCell(rowIndex, 2).value = companySummary[company];

        for (let i = 1; i <= 2; i++) {
          const cell = sheet.getCell(
            rowIndex,

            i,
          );

          cell.border = {
            top: {
              style: "thin",
            },

            left: {
              style: "thin",
            },

            bottom: {
              style: "thin",
            },

            right: {
              style: "thin",
            },
          };

          cell.alignment = {
            horizontal: i === 1 ? "left" : "center",
          };
        }

        rowIndex++;
      });

    // ==========================================
    // Download
    // ==========================================

    res.setHeader(
      "Content-Type",

      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",

      `attachment; filename=Invoice_Report_${from}_${to}.xlsx`,
    );

    await workbook.xlsx.write(res);

    res.end();
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

exports.exportLeftoverExcel = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: "Vui lòng chọn ngày.",
      });
    }

    const targetDate = moment(date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");

    // =====================================
    // Tìm menu
    // =====================================

    const menus = await Menu.find();

    let selectedMenu = null;
    let selectedDay = null;

    for (const menu of menus) {
      const day = menu.days.find(
        (item) =>
          moment(item.date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD") ===
          targetDate,
      );

      if (day) {
        selectedMenu = menu;
        selectedDay = day;
        break;
      }
    }

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu.",
      });
    }

    // =====================================
    // Header
    // =====================================

    const headers = [];

    getMenuMainDishes(selectedDay).forEach((item) => {
      headers.push({
        type: "main",
        id: String(item._id),
        name: item.name,
      });
    });

    (selectedDay.drinks || []).forEach((item) => {
      headers.push({
        type: "drink",
        id: String(item._id),
        name: item.name,
      });
    });

    (selectedDay.soups || []).forEach((item) => {
      headers.push({
        type: "soup",
        id: String(item._id),
        name: item.name,
      });
    });

    // =====================================
    // Orders
    // =====================================

    const orderFilter = {
      week: selectedMenu.week,
      status: "ordered",
    };

    orderFilter.user = { $in: await getKitchenUserIds(req) };

    const orders = await Order.find(orderFilter).populate({
      path: "user",
      select: "employeeId name email kitchen",
    });

    // =====================================
    // Statistics
    // =====================================

    const leftovers = {};
    const kitchens = {};
    const users = [];

    headers.forEach((h) => {
      leftovers[h.name] = {
        name: h.name,
        type: h.type,
        quantity: 0,
        users: [],
      };
    });

    for (const order of orders) {
      if (!order.user) continue;

      const day = order.days.find(
        (d) =>
          moment(d.date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD") ===
          targetDate,
      );

      if (!day) continue;

      if (day.received) continue;

      const hasFood =
        day.mains.some((item) => item.quantity > 0) || day.drink || day.soup;

      if (!hasFood) continue;
      const foods = [];

      day.mains.forEach((item) => {
        foods.push(
          `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`,
        );
      });

      if (day.drink) {
        foods.push(day.drink.name);
      }

      if (day.soup) {
        foods.push(day.soup.name);
      }

      users.push({
        employeeId: order.user.employeeId,
        name: order.user.name,
        email: order.user.email,
        kitchen: order.user.kitchen,
        foods,
      });

      const kitchen = String(order.user.kitchen ?? "K1");

      if (!kitchens[kitchen]) {
        kitchens[kitchen] = {};

        headers.forEach((h) => {
          kitchens[kitchen][h.name] = 0;
        });
      }

      // MAIN

      day.mains.forEach((main) => {
        const head = headers.find(
          (h) => h.type === "main" && h.id === String(main.dishId),
        );

        if (!head) return;

        leftovers[head.name].quantity += main.quantity;

        leftovers[head.name].users.push({
          employeeId: order.user.employeeId,
          name: order.user.name,
          email: order.user.email,
          kitchen: order.user.kitchen,
          quantity: main.quantity,
        });

        kitchens[kitchen][head.name] += main.quantity;
      });

      // DRINK

      if (day.drink) {
        const head = headers.find(
          (h) => h.type === "drink" && h.id === String(day.drink.dishId),
        );

        if (head) {
          leftovers[head.name].quantity++;

          leftovers[head.name].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
            quantity: 1,
          });

          kitchens[kitchen][head.name]++;
        }
      }

      // SOUP

      if (day.soup) {
        const head = headers.find(
          (h) => h.type === "soup" && h.id === String(day.soup.dishId),
        );

        if (head) {
          leftovers[head.name].quantity++;

          leftovers[head.name].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
            quantity: 1,
          });

          kitchens[kitchen][head.name]++;
        }
      }
    }

    // =====================================
    // Workbook
    // =====================================

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Food Ordering";
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet("Summary");
    const kitchenSheet = workbook.addWorksheet("Kitchen");
    const userSheet = workbook.addWorksheet("Users");
    // =====================================
    // SUMMARY SHEET
    // =====================================

    summarySheet.columns = [
      { header: "Món", key: "name", width: 35 },
      { header: "Loại", key: "type", width: 18 },
      { header: "Số lượng", key: "quantity", width: 12 },
      { header: "Nhân viên chưa nhận", key: "users", width: 70 },
    ];

    summarySheet.getRow(1).font = {
      bold: true,
      name: "Times New Roman",
      size: 12,
    };

    Object.values(leftovers)
      .filter((item) => item.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .forEach((item) => {
        summarySheet.addRow({
          name: item.name,

          type:
            item.type === "main"
              ? "Cơm"
              : item.type === "drink"
                ? "Món nước"
                : "Món súp",

          quantity: item.quantity,

          users: item.users
            .map((u) => `${u.employeeId} - ${u.name} (Bếp ${u.kitchen})`)
            .join("\n"),
        });
      });

    summarySheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    // =====================================
    // KITCHEN SHEET
    // =====================================

    const kitchenColumns = [{ header: "Bếp", key: "kitchen", width: 12 }];

    headers.forEach((h) => {
      kitchenColumns.push({
        header: h.name,
        key: h.name,
        width: 18,
      });
    });

    kitchenColumns.push({
      header: "Tổng",
      key: "total",
      width: 12,
    });

    kitchenSheet.columns = kitchenColumns;

    kitchenSheet.getRow(1).font = {
      bold: true,
      name: "Times New Roman",
      size: 12,
    };

    Object.keys(kitchens)
      .sort(sortKitchenValues)
      .forEach((kitchen) => {
        const row = {
          kitchen,
        };

        let mainTotal = 0;
        let drinkTotal = 0;
        let soupTotal = 0;

        headers.forEach((h) => {
          const value = kitchens[kitchen][h.name] || 0;

          row[h.name] = value;

          switch (h.type) {
            case "main":
              mainTotal += value;
              break;

            case "drink":
              drinkTotal += value;
              break;

            case "soup":
              soupTotal += value;
              break;

            default:
              break;
          }
        });

        row.total = Math.ceil(mainTotal / 2) + drinkTotal + soupTotal;

        kitchenSheet.addRow(row);
      });

    kitchenSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      });
    });

    // =====================================
    // USER SHEET
    // =====================================

    userSheet.columns = [
      { header: "Mã NV", key: "employeeId", width: 18 },
      { header: "Họ tên", key: "name", width: 28 },
      { header: "Email", key: "email", width: 35 },
      { header: "Bếp", key: "kitchen", width: 10 },
      { header: "Đã đặt món", key: "foods", width: 70 },
    ];

    userSheet.getRow(1).font = {
      bold: true,
      name: "Times New Roman",
      size: 12,
    };

    users.forEach((user) => {
      userSheet.addRow({
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        kitchen: user.kitchen,
        foods: user.foods.join("\n"),
      });
    });

    userSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    // =====================================
    // DOWNLOAD
    // =====================================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Leftover_Report_${targetDate}.xlsx`,
    );

    await workbook.xlsx.write(res);

    res.end();
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: err.message,
    });
  }
};
