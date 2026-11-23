const ExcelJS = require("exceljs");
const moment = require("moment-timezone");

const Menu = require("../models/Menu");
const Order = require("../models/Order");
const User = require("../models/User");
const { getUnreceivedMeals } = require("../utils/mealCheckin");

// ======================================================
// Helpers
// ======================================================

function getCompany(email = "", company = "") {
  if (company === "BVN" || company === "BMS") return company;
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

function normalizeGuestType(value) {
  return value === "expert" ? "expert" : "employee";
}

function getGuestTypeLabel(value) {
  return normalizeGuestType(value) === "expert" ? "Chuyên gia" : "Nhân viên";
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
      const meal = item.mealPeriod === "dinner" ? "Chiều" : "Trưa";
      foods.push(`[${meal}] ${item.name} x${item.quantity}`);
    }
  });

  if (day.drink?.name) {
    foods.push(`[Trưa] ${day.drink.name}`);
  }

  if (day.soup?.name) {
    foods.push(`[Trưa] ${day.soup.name}`);
  }

  return foods.join(", ");
}

function getMenuReportHeaders(day) {
  const flexible = [];
  for (const period of ["lunch", "dinner"]) {
    for (const category of ["rice", "vegetarian", "noodles", "soup"]) {
      for (const dish of day?.meals?.[period]?.[category] || []) {
        flexible.push({
          type: "main",
          id: String(dish._id),
          name: dish.name || "",
          mealPeriod: period,
          category,
        });
      }
    }
  }
  if (flexible.length > 0) return flexible;

  return [
    ...(day?.mains || []).map((dish) => ({
      type: "main",
      id: String(dish._id),
      name: dish.name,
      mealPeriod: dish.mealPeriod === "dinner" ? "dinner" : "lunch",
      category: dish.vegetarian ? "vegetarian" : "rice",
    })),
    ...(day?.drinks || []).map((dish) => ({
      type: "drink", id: String(dish._id), name: dish.name, mealPeriod: "lunch", category: "noodles",
    })),
    ...(day?.soups || []).map((dish) => ({
      type: "soup", id: String(dish._id), name: dish.name, mealPeriod: "lunch", category: "soup",
    })),
  ];
}

function getMenuDaysForDate(menus, targetDate) {
  return menus.flatMap((menu) => {
    const day = menu.days.find(
      (item) => moment(item.date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD") === targetDate,
    );
    return day ? [{ menu, day }] : [];
  });
}

function getMenuReportHeadersForDays(menuDays) {
  const headers = [];
  const seen = new Set();

  for (const { day } of menuDays) {
    for (const header of getMenuReportHeaders(day)) {
      const id = `${header.type}:${header.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      headers.push(header);
    }
  }

  return headers;
}

function addReportHeaderKeys(headers) {
  const counts = headers.reduce((result, header) => {
    result.set(header.name, (result.get(header.name) || 0) + 1);
    return result;
  }, new Map());

  const seenLabels = new Map();
  const categoryLabels = { rice: "Món cơm", vegetarian: "Món chay", noodles: "Món nước", soup: "Món soup" };

  headers.forEach((header) => {
    header.key = `${header.type}:${header.id}`;
    const periodLabel = header.mealPeriod === "dinner" ? "Chiều" : "Trưa";
    const baseLabel = header.type === "main" && header.category
      ? `[${periodLabel} · ${categoryLabels[header.category] || header.category}] ${header.name}`
      : counts.get(header.name) > 1
        ? `[${periodLabel}] ${header.name}`
        : header.name;
    const occurrence = (seenLabels.get(baseLabel) || 0) + 1;
    seenLabels.set(baseLabel, occurrence);
    header.label = occurrence > 1 ? `${baseLabel} (${occurrence})` : baseLabel;
  });
}

function getExcelReportHeaderLabel(header) {
  const label = header.label || header.name;
  if (/^\[(Trưa|Chiều)/.test(label)) return label;
  return `[${header.mealPeriod === "dinner" ? "Buổi chiều" : "Buổi trưa"}] ${label}`;
}

function reconcileReportHeaders(headers, orders, targetDate) {
  const addSnapshot = (type, item, mealPeriod = "lunch") => {
    if (!item?.dishId) return;
    const id = String(item.dishId);
    const existing = headers.find((header) => header.type === type && header.id === id);

    if (existing) {
      if (item.name) existing.name = item.name;
      if (type === "main" && item.mealPeriod) existing.mealPeriod = item.mealPeriod;
      if (type === "main" && item.category) existing.category = item.category;
      return;
    }

    headers.push({
      type,
      id,
      name: item.name || "(Món đã đặt)",
      mealPeriod: type === "main" && item.mealPeriod === "dinner" ? "dinner" : mealPeriod,
      category: type === "main" ? item.category || "" : "",
    });
  };

  for (const order of orders) {
    const day = order.days.find((item) =>
      moment(item.date).tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD") === targetDate,
    );
    if (!day) continue;

    for (const main of day.mains || []) addSnapshot("main", main);
    addSnapshot("drink", day.drink);
    addSnapshot("soup", day.soup);
  }

  const unifiedDishIds = new Set(
    headers.filter((header) => header.type === "main").map((header) => header.id),
  );
  for (let index = headers.length - 1; index >= 0; index -= 1) {
    if (["drink", "soup"].includes(headers[index].type) && unifiedDishIds.has(headers[index].id)) {
      headers.splice(index, 1);
    }
  }

  addReportHeaderKeys(headers);
}

function hasOrderedMealForPeriod(day, period) {
  const hasMain = (day.mains || []).some((item) =>
    item.quantity > 0 && (item.mealPeriod === "dinner" ? "dinner" : "lunch") === period,
  );

  return hasMain || (period === "lunch" && Boolean(day.drink || day.soup));
}

function hasUnreceivedMealForPeriod(unreceivedMeals, period) {
  const hasMain = unreceivedMeals.mains.some((item) =>
    item.quantity > 0 && (item.mealPeriod === "dinner" ? "dinner" : "lunch") === period,
  );

  return hasMain || (period === "lunch" && Boolean(unreceivedMeals.drink || unreceivedMeals.soup));
}

function getSelectedOptionForPeriod(day, period) {
  const validOptions = ["rice", "vegetarian", "noodles", "soup"];
  if (validOptions.includes(day.selections?.[period])) return day.selections[period];

  const selectedDish = (day.mains || []).find((item) =>
    (item.mealPeriod === "dinner" ? "dinner" : "lunch") === period && item.quantity > 0,
  );
  if (!selectedDish) return "";
  if (validOptions.includes(selectedDish.category)) return selectedDish.category;
  return selectedDish.vegetarian ? "vegetarian" : "rice";
}

function getMealOptionLabel(day, period) {
  const labels = {
    rice: "Món cơm",
    vegetarian: "Món chay",
    noodles: "Món nước",
    soup: "Món soup",
  };
  return labels[getSelectedOptionForPeriod(day, period)] || "";
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

    const menuDays = getMenuDaysForDate(menus, targetDate);
    const selectedMenu = menuDays[0]?.menu;

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu của ngày này.",
      });
    }

    // ==================================================
    // Danh sách món của đúng ngày
    // ==================================================

    const headers = getMenuReportHeadersForDays(menuDays);
    addReportHeaderKeys(headers);

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
        select: "employeeId name email kitchen guestType company",
      })
      .sort({
        "user.employeeId": 1,
      });

    reconcileReportHeaders(headers, orders, targetDate);

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

    const optionCategories = ["rice", "vegetarian", "noodles", "soup"];
    const optionTotals = {
      lunch: Object.fromEntries(optionCategories.map((category) => [category, 0])),
      dinner: Object.fromEntries(optionCategories.map((category) => [category, 0])),
    };
    const optionTotalsByGuestType = Object.fromEntries(
      ["employee", "expert"].map((guestType) => [guestType, {
        lunch: Object.fromEntries(optionCategories.map((category) => [category, 0])),
        dinner: Object.fromEntries(optionCategories.map((category) => [category, 0])),
      }]),
    );

    headers.forEach((item) => {
      totalSummary[item.key] = 0;
    });

    // current row

    let rowIndex = 1;

    // ==================================================
    // TITLE
    // ==================================================

    const lastColumn = headers.length + 8;

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

    sheet.getCell(rowIndex, 2).value = "Tên nhân viên";

    sheet.getCell(rowIndex, 3).value = "Email";

    sheet.getCell(rowIndex, 4).value = "Bếp";

    sheet.getCell(rowIndex, 5).value = "Loại Guest";

    sheet.getCell(rowIndex, 6).value = "Công ty";

    sheet.getCell(rowIndex, 7).value = "Nhóm món trưa";

    sheet.getCell(rowIndex, 8).value = "Nhóm món chiều";

    let column = 9;

    headers.forEach((item) => {
      sheet.getCell(rowIndex, column).value = getExcelReportHeaderLabel(item);

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

    sheet.getColumn(2).width = 26;

    sheet.getColumn(3).width = 36;

    sheet.getColumn(4).width = 10;

    sheet.getColumn(5).width = 18;

    sheet.getColumn(6).width = 14;

    sheet.getColumn(7).width = 18;

    sheet.getColumn(8).width = 18;

    for (let i = 9; i <= lastColumn; i++) {
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
      const hasFood =
        (day.mains || []).some((item) => item.quantity > 0) || day.drink || day.soup;
      if (!hasFood) continue;

      for (const period of ["lunch", "dinner"]) {
        if (!hasOrderedMealForPeriod(day, period)) continue;
        const category = getSelectedOptionForPeriod(day, period);
        if (category && Object.hasOwn(optionTotals[period], category)) {
          optionTotals[period][category] += 1;
          optionTotalsByGuestType[normalizeGuestType(order.user.guestType)][period][category] += 1;
        }
      }

      sheet.getCell(rowIndex, 1).value = order.user.employeeId;

      sheet.getCell(rowIndex, 2).value = order.user.name;

      sheet.getCell(rowIndex, 3).value = order.user.email;

      sheet.getCell(rowIndex, 4).value = order.user.kitchen;

      sheet.getCell(rowIndex, 5).value = order.user.guestType === "employee"
        ? "Nhân viên"
        : order.user.guestType === "expert" ? "Chuyên gia" : "Chưa cập nhật";

      sheet.getCell(rowIndex, 6).value = order.user.company || "Chưa cập nhật";

      sheet.getCell(rowIndex, 7).value = getMealOptionLabel(day, "lunch");

      sheet.getCell(rowIndex, 8).value = getMealOptionLabel(day, "dinner");

      const kitchen = String(order.user.kitchen);

      if (!kitchenSummary[kitchen]) {
        kitchenSummary[kitchen] = {};

        headers.forEach((item) => {
          kitchenSummary[kitchen][item.key] = 0;
        });
      }

      column = 9;

      headers.forEach((item) => {
        let value = "";

        // =====================
        // MAIN
        // =====================

        if (item.type === "main") {
          const found = day.mains.find((m) => String(m.dishId) === item.id);

          if (found) {
            value = found.quantity;

            totalSummary[item.key] += found.quantity;

            kitchenSummary[kitchen][item.key] += found.quantity;
          }
        }

        // =====================
        // DRINK
        // =====================
        else if (item.type === "drink") {
          if (day.drink && String(day.drink.dishId) === item.id) {
            value = 1;

            totalSummary[item.key]++;

            kitchenSummary[kitchen][item.key]++;
          }
        }

        // =====================
        // SOUP
        // =====================
        else {
          if (day.soup && String(day.soup.dishId) === item.id) {
            value = 1;

            totalSummary[item.key]++;

            kitchenSummary[kitchen][item.key]++;
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

    let col = 9;

    headers.forEach((item) => {
      sheet.getCell(rowIndex, col).value = totalSummary[item.key];

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

        col = 9;

        headers.forEach((item) => {
          sheet.getCell(rowIndex, col).value = kitchenSummary[kitchen][item.key];

          col++;
        });

        rowIndex++;
      });

    rowIndex += 2;
    sheet.getCell(rowIndex, 1).value = "SỐ PHẦN THEO NHÓM MÓN";
    sheet.getCell(rowIndex, 1).font = { bold: true, size: 14 };
    rowIndex++;

    const optionLabels = {
      rice: "Món cơm",
      vegetarian: "Món chay",
      noodles: "Món nước",
      soup: "Món soup",
    };
    ["Nhóm món", ...optionCategories.map((category) => optionLabels[category]), "Tổng"].forEach((label, index) => {
      const cell = sheet.getCell(rowIndex, index + 1);
      cell.value = label;
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE8CC" } };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });
    rowIndex++;

    const optionGrandTotals = Object.fromEntries(optionCategories.map((category) => [category, 0]));
    for (const [period, label] of [["lunch", "Buổi trưa"], ["dinner", "Buổi chiều"]]) {
      const values = optionCategories.map((category) => optionTotals[period][category]);
      values.forEach((value, index) => {
        optionGrandTotals[optionCategories[index]] += value;
      });
      const cells = [label, ...values, values.reduce((sum, value) => sum + value, 0)];
      cells.forEach((value, index) => {
        const cell = sheet.getCell(rowIndex, index + 1);
        cell.value = value;
        cell.alignment = { horizontal: index === 0 ? "left" : "center", vertical: "middle" };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
      rowIndex++;
    }
    ["Tổng", ...optionCategories.map((category) => optionGrandTotals[category]), Object.values(optionGrandTotals).reduce((sum, value) => sum + value, 0)].forEach((value, index) => {
      const cell = sheet.getCell(rowIndex, index + 1);
      cell.value = value;
      cell.font = { bold: true };
      cell.alignment = { horizontal: index === 0 ? "left" : "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    rowIndex += 2;
    sheet.getCell(rowIndex, 1).value = "SỐ PHẦN THEO NHÓM USER";
    sheet.getCell(rowIndex, 1).font = { bold: true, size: 14 };
    rowIndex++;
    ["Loại user", "Buổi", ...optionCategories.map((category) => optionLabels[category]), "Tổng"].forEach((value, index) => {
      const cell = sheet.getCell(rowIndex, index + 1);
      cell.value = value;
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE8CC" } };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });
    rowIndex++;
    for (const [guestType, label] of [["employee", "Nhân viên"], ["expert", "Chuyên gia"]]) {
      for (const [period, periodLabel] of [["lunch", "Buổi trưa"], ["dinner", "Buổi chiều"]]) {
        const values = optionCategories.map((category) => optionTotalsByGuestType[guestType][period][category]);
        [label, periodLabel, ...values, values.reduce((sum, value) => sum + value, 0)].forEach((value, index) => {
          const cell = sheet.getCell(rowIndex, index + 1);
          cell.value = value;
          cell.alignment = { horizontal: index < 2 ? "left" : "center", vertical: "middle" };
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });
        rowIndex++;
      }
    }

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

    const menuDays = getMenuDaysForDate(menus, targetDate);
    const selectedMenu = menuDays[0]?.menu;

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu.",
      });
    }

    // =====================================
    // Header
    // =====================================

    const headers = getMenuReportHeadersForDays(menuDays);
    addReportHeaderKeys(headers);

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
      select: "employeeId name email kitchen guestType company",
    });
    reconcileReportHeaders(headers, orders, targetDate);
    const totals = {};

    const kitchens = {};
    const kitchenMealCounts = {};
    const optionCategories = ["rice", "vegetarian", "noodles", "soup"];
    const optionTotals = {
      lunch: Object.fromEntries(optionCategories.map((category) => [category, 0])),
      dinner: Object.fromEntries(optionCategories.map((category) => [category, 0])),
    };
    const optionTotalsByGuestType = Object.fromEntries(
      ["employee", "expert"].map((guestType) => [guestType, {
        lunch: Object.fromEntries(optionCategories.map((category) => [category, 0])),
        dinner: Object.fromEntries(optionCategories.map((category) => [category, 0])),
      }]),
    );
    const kitchenOptionTotals = {};

    headers.forEach((h) => {
      totals[h.key] = 0;
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
        (day.mains || []).some((item) => item.quantity > 0) || day.drink || day.soup;

      if (!hasFood) continue;

      const kitchen = String(order.user?.kitchen ?? "K1");

      if (!kitchens[kitchen]) {
        kitchens[kitchen] = {};
        kitchenMealCounts[kitchen] = { lunch: 0, dinner: 0 };
        kitchenOptionTotals[kitchen] = {
          lunch: Object.fromEntries(optionCategories.map((category) => [category, 0])),
          dinner: Object.fromEntries(optionCategories.map((category) => [category, 0])),
        };

        headers.forEach((h) => {
          kitchens[kitchen][h.key] = 0;
        });
      }

      for (const period of ["lunch", "dinner"]) {
        if (hasOrderedMealForPeriod(day, period)) {
          kitchenMealCounts[kitchen][period] += 1;
          const category = getSelectedOptionForPeriod(day, period);
          if (category) {
            optionTotals[period][category] += 1;
            kitchenOptionTotals[kitchen][period][category] += 1;
            optionTotalsByGuestType[normalizeGuestType(order.user.guestType)][period][category] += 1;
          }
        }
      }

      const items = {};

      headers.forEach((h) => {
        items[h.key] = "";
      });

      // Main

      day.mains.forEach((main) => {
        const head = headers.find(
          (h) => h.type === "main" && h.id === String(main.dishId),
        );

        if (head) {
          items[head.key] = main.quantity;

          totals[head.key] += main.quantity;

          kitchens[kitchen][head.key] += main.quantity;
        }
      });

      // Drink

      if (day.drink) {
        const head = headers.find(
          (h) => h.type === "drink" && h.id === String(day.drink.dishId),
        );

        if (head) {
          items[head.key] = 1;

          totals[head.key]++;

          kitchens[kitchen][head.key]++;
        }
      }

      // Soup

      if (day.soup) {
        const head = headers.find(
          (h) => h.type === "soup" && h.id === String(day.soup.dishId),
        );

        if (head) {
          items[head.key] = 1;

          totals[head.key]++;

          kitchens[kitchen][head.key]++;
        }
      }

      rows.push({
        employeeId: order.user.employeeId,

        name: order.user.name,

        email: order.user.email,

        kitchen,

        guestType: order.user.guestType || "",

        company: order.user.company || "",

        received: day.received,

        selections: {
          lunch: getSelectedOptionForPeriod(day, "lunch"),
          dinner: getSelectedOptionForPeriod(day, "dinner"),
        },

        items,
      });
    }

    const kitchenRows = Object.keys(kitchens)
      .sort(sortKitchenValues)
      .map((kitchen) => {
        const items = kitchens[kitchen];

        return {
          kitchen,
          items,
          total: kitchenMealCounts[kitchen].lunch + kitchenMealCounts[kitchen].dinner,
          periodTotals: {
            ...kitchenMealCounts[kitchen],
          },
          optionTotals: kitchenOptionTotals[kitchen],
        };
      });

    res.json({
      success: true,

      data: {
        date: targetDate,

        headers,

        rows,

        totals,

        optionTotals,

        optionTotalsByGuestType,

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

    const menuDays = getMenuDaysForDate(menus, targetDate);
    const selectedMenu = menuDays[0]?.menu;

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu.",
      });
    }

    // =====================================
    // Header
    // =====================================

    const headers = getMenuReportHeadersForDays(menuDays);
    addReportHeaderKeys(headers);

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
      select: "employeeId name email kitchen guestType company",
    });
    reconcileReportHeaders(headers, orders, targetDate);

    // =====================================
    // Init
    // =====================================

    const leftovers = {};
    const kitchens = {};
    const kitchenMealCounts = {};
    const users = [];

    headers.forEach((h) => {
      leftovers[h.key] = {
        key: h.key,
        name: h.label,
        type: h.type,
        category: h.category || "",
        mealPeriod: h.mealPeriod || "lunch",
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

      const unreceivedMeals = getUnreceivedMeals(day);

      const hasFood =
        unreceivedMeals.mains.some((item) => item.quantity > 0) ||
        unreceivedMeals.drink ||
        unreceivedMeals.soup;

      if (!hasFood) continue;

      const foods = [];
      const foodsByPeriod = { lunch: [], dinner: [] };

      // Main
      unreceivedMeals.mains.forEach((item) => {
        const mealPeriod = item.mealPeriod === "dinner" ? "dinner" : "lunch";
        const mealLabel = mealPeriod === "lunch" ? "Trưa" : "Chiều";
        const foodName = `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`;
        foods.push(`[${mealLabel}] ${foodName}`);
        foodsByPeriod[mealPeriod].push(foodName);
      });

      // Drink
      if (unreceivedMeals.drink) {
        foods.push(`[Trưa] ${unreceivedMeals.drink.name}`);
        foodsByPeriod.lunch.push(unreceivedMeals.drink.name);
      }

      // Soup
      if (unreceivedMeals.soup) {
        foods.push(`[Trưa] ${unreceivedMeals.soup.name}`);
        foodsByPeriod.lunch.push(unreceivedMeals.soup.name);
      }

      users.push({
        employeeId: order.user.employeeId,
        name: order.user.name,
        email: order.user.email,
        kitchen: order.user.kitchen,
        guestType: normalizeGuestType(order.user.guestType),
        company: getCompany(order.user.email, order.user.company),
        foods,
        foodsByPeriod,
      });

      const kitchen = String(order.user.kitchen ?? "K1");

      if (!kitchens[kitchen]) {
        kitchens[kitchen] = {};
        kitchenMealCounts[kitchen] = { lunch: 0, dinner: 0 };

        headers.forEach((h) => {
          kitchens[kitchen][h.key] = 0;
        });
      }

      for (const period of ["lunch", "dinner"]) {
        if (hasUnreceivedMealForPeriod(unreceivedMeals, period)) {
          kitchenMealCounts[kitchen][period] += 1;
        }
      }

      // ==========================
      // MAIN
      // ==========================

      unreceivedMeals.mains.forEach((main) => {
        const head = headers.find(
          (h) => h.type === "main" && h.id === String(main.dishId),
        );

        if (!head) return;

        leftovers[head.key].quantity += main.quantity;

        leftovers[head.key].users.push({
          employeeId: order.user.employeeId,
          name: order.user.name,
          email: order.user.email,
          kitchen: order.user.kitchen,
          guestType: normalizeGuestType(order.user.guestType),
          company: getCompany(order.user.email, order.user.company),
          quantity: main.quantity,
        });

        kitchens[kitchen][head.key] += main.quantity;
      });

      // ==========================
      // DRINK
      // ==========================

      if (unreceivedMeals.drink) {
        const head = headers.find(
          (h) => h.type === "drink" && h.id === String(unreceivedMeals.drink.dishId),
        );

        if (head) {
          leftovers[head.key].quantity++;

          leftovers[head.key].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
            guestType: normalizeGuestType(order.user.guestType),
            company: getCompany(order.user.email, order.user.company),
          });

          kitchens[kitchen][head.key]++;
        }
      }

      // ==========================
      // SOUP
      // ==========================

      if (unreceivedMeals.soup) {
        const head = headers.find(
          (h) => h.type === "soup" && h.id === String(unreceivedMeals.soup.dishId),
        );

        if (head) {
          leftovers[head.key].quantity++;

          leftovers[head.key].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
            guestType: normalizeGuestType(order.user.guestType),
            company: getCompany(order.user.email, order.user.company),
          });

          kitchens[kitchen][head.key]++;
        }
      }
    }

    // =====================================
    // Kitchen Summary
    // =====================================

    const kitchenRows = Object.keys(kitchens)
      .sort(sortKitchenValues)
      .map((kitchen) => {
        return {
          kitchen,
          items: kitchens[kitchen],
          total: kitchenMealCounts[kitchen].lunch + kitchenMealCounts[kitchen].dinner,
          periodTotals: {
            ...kitchenMealCounts[kitchen],
          },
        };
      });

    const guestTypeSummary = {
      employee: { users: 0, lunchUsers: 0, dinnerUsers: 0 },
      expert: { users: 0, lunchUsers: 0, dinnerUsers: 0 },
    };
    for (const user of users) {
      const group = guestTypeSummary[normalizeGuestType(user.guestType)];
      group.users += 1;
      if (user.foodsByPeriod.lunch.length > 0) group.lunchUsers += 1;
      if (user.foodsByPeriod.dinner.length > 0) group.dinnerUsers += 1;
    }

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

        guestTypeSummary,
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
        select: "employeeId name email kitchen guestType company",
      })
      .sort({
        "user.employeeId": 1,
      });

    const rows = [];

    const companySummary = {};
    const guestTypeSummary = { employee: 0, expert: 0 };

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

        const company = getCompany(order.user.email, order.user.company);
        const guestType = normalizeGuestType(order.user.guestType);
        const mealCount = ["lunch", "dinner"].filter((period) => hasOrderedMealForPeriod(day, period)).length;

        companySummary[company] = (companySummary[company] || 0) + mealCount;
        guestTypeSummary[guestType] += mealCount;

        rows.push({
          date: current.format("DD/MM/YYYY"),

          employeeId: order.user.employeeId,

          name: order.user.name,

          email: order.user.email,

          company,

          guestType,

          mealCount,

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

        summaryByGuestType: guestTypeSummary,
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
        select: "employeeId name email kitchen guestType company",
      })
      .sort({
        "user.employeeId": 1,
      });

    // ==========================================
    // Chuẩn bị dữ liệu
    // ==========================================

    const rows = [];

    const companySummary = {};
    const guestTypeSummary = { employee: 0, expert: 0 };

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

        const company = getCompany(order.user.email, order.user.company);
        const guestType = normalizeGuestType(order.user.guestType);
        const mealCount = ["lunch", "dinner"].filter((period) => hasOrderedMealForPeriod(day, period)).length;

        companySummary[company] = (companySummary[company] || 0) + mealCount;
        guestTypeSummary[guestType] += mealCount;

        rows.push({
          date: current.format("DD/MM/YYYY"),

          employeeId: order.user.employeeId,

          name: order.user.name,

          email: order.user.email,

          kitchen: order.user.kitchen,

          company,

          guestType,

          mealCount,

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

      { width: 18 },

      { width: 22 },

      { width: 10 },

      { width: 45 },
    ];

    // ==========================================
    // Title
    // ==========================================

    sheet.mergeCells("A1:I1");

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

      "Loại Guest",

      "Tên công ty",

      "Số bữa",

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
      sheet.getCell(rowIndex, 6).value = getGuestTypeLabel(item.guestType);
      sheet.getCell(rowIndex, 7).value = item.company;
      sheet.getCell(rowIndex, 8).value = item.mealCount;
      sheet.getCell(rowIndex, 9).value = item.food;

      for (let i = 1; i <= 9; i++) {
        const cell = sheet.getCell(rowIndex, i);

        cell.font = {
          name: "Times New Roman",

          size: 11,
        };

        cell.alignment = {
          vertical: "middle",

          horizontal: i === 9 ? "left" : "center",

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

    rowIndex += 2;
    sheet.getCell(rowIndex, 1).value = "THỐNG KÊ THEO LOẠI GUEST";
    sheet.getCell(rowIndex, 1).font = { bold: true, size: 14, name: "Times New Roman" };
    rowIndex++;
    [["Loại Guest", "Số suất"], ["Nhân viên", guestTypeSummary.employee], ["Chuyên gia", guestTypeSummary.expert]].forEach((values) => {
      values.forEach((value, index) => {
        const cell = sheet.getCell(rowIndex, index + 1);
        cell.value = value;
        cell.alignment = { horizontal: index === 0 ? "left" : "center" };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
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

    const menuDays = getMenuDaysForDate(menus, targetDate);
    const selectedMenu = menuDays[0]?.menu;

    if (!selectedMenu) {
      return res.status(404).json({
        message: "Không tìm thấy menu.",
      });
    }

    // =====================================
    // Header
    // =====================================

    const headers = getMenuReportHeadersForDays(menuDays);
    addReportHeaderKeys(headers);

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
      select: "employeeId name email kitchen guestType company",
    });
    reconcileReportHeaders(headers, orders, targetDate);

    // =====================================
    // Statistics
    // =====================================

    const leftovers = {};
    const kitchens = {};
    const kitchenMealCounts = {};
    const users = [];

    headers.forEach((h) => {
      leftovers[h.key] = {
        key: h.key,
        name: h.label,
        type: h.type,
        category: h.category || "",
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

      const unreceivedMeals = getUnreceivedMeals(day);

      const hasFood =
        unreceivedMeals.mains.some((item) => item.quantity > 0) ||
        unreceivedMeals.drink ||
        unreceivedMeals.soup;

      if (!hasFood) continue;
      const foods = [];

      unreceivedMeals.mains.forEach((item) => {
        foods.push(
          `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`,
        );
      });

      if (unreceivedMeals.drink) {
        foods.push(unreceivedMeals.drink.name);
      }

      if (unreceivedMeals.soup) {
        foods.push(unreceivedMeals.soup.name);
      }

      users.push({
        employeeId: order.user.employeeId,
        name: order.user.name,
        email: order.user.email,
        kitchen: order.user.kitchen,
        guestType: normalizeGuestType(order.user.guestType),
        company: getCompany(order.user.email, order.user.company),
        foods,
      });

      const kitchen = String(order.user.kitchen ?? "K1");

      if (!kitchens[kitchen]) {
        kitchens[kitchen] = {};
        kitchenMealCounts[kitchen] = { lunch: 0, dinner: 0 };

        headers.forEach((h) => {
          kitchens[kitchen][h.key] = 0;
        });
      }

      for (const period of ["lunch", "dinner"]) {
        if (hasUnreceivedMealForPeriod(unreceivedMeals, period)) {
          kitchenMealCounts[kitchen][period] += 1;
        }
      }

      // MAIN

      unreceivedMeals.mains.forEach((main) => {
        const head = headers.find(
          (h) => h.type === "main" && h.id === String(main.dishId),
        );

        if (!head) return;

        leftovers[head.key].quantity += main.quantity;

        leftovers[head.key].users.push({
          employeeId: order.user.employeeId,
          name: order.user.name,
          email: order.user.email,
          kitchen: order.user.kitchen,
          guestType: normalizeGuestType(order.user.guestType),
          company: getCompany(order.user.email, order.user.company),
          quantity: main.quantity,
        });

        kitchens[kitchen][head.key] += main.quantity;
      });

      // DRINK

      if (unreceivedMeals.drink) {
        const head = headers.find(
          (h) => h.type === "drink" && h.id === String(unreceivedMeals.drink.dishId),
        );

        if (head) {
          leftovers[head.key].quantity++;

          leftovers[head.key].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
            guestType: normalizeGuestType(order.user.guestType),
            company: getCompany(order.user.email, order.user.company),
            quantity: 1,
          });

          kitchens[kitchen][head.key]++;
        }
      }

      // SOUP

      if (unreceivedMeals.soup) {
        const head = headers.find(
          (h) => h.type === "soup" && h.id === String(unreceivedMeals.soup.dishId),
        );

        if (head) {
          leftovers[head.key].quantity++;

          leftovers[head.key].users.push({
            employeeId: order.user.employeeId,
            name: order.user.name,
            email: order.user.email,
            kitchen: order.user.kitchen,
            guestType: normalizeGuestType(order.user.guestType),
            company: getCompany(order.user.email, order.user.company),
            quantity: 1,
          });

          kitchens[kitchen][head.key]++;
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
            .map((u) => `${u.employeeId} - ${u.name} (${getGuestTypeLabel(u.guestType)} · ${u.company || "Chưa cập nhật"} · Bếp ${u.kitchen})`)
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
        header: getExcelReportHeaderLabel(h),
        key: h.key,
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

        headers.forEach((h) => {
          const value = kitchens[kitchen][h.key] || 0;

          row[h.key] = value;
        });

        row.total = kitchenMealCounts[kitchen].lunch + kitchenMealCounts[kitchen].dinner;

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
      { header: "Loại Guest", key: "guestType", width: 18 },
      { header: "Công ty", key: "company", width: 22 },
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
        guestType: getGuestTypeLabel(user.guestType),
        company: user.company,
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
