const moment = require("moment-timezone");

const TIME_ZONE = "Asia/Ho_Chi_Minh";

function getMealPeriodAt(date = new Date()) {
  const localTime = moment(date).tz(TIME_ZONE);
  const minutes = localTime.hours() * 60 + localTime.minutes();

  if (minutes >= 6 * 60 && minutes < 15 * 60) return "lunch";
  if (minutes >= 15 * 60 && minutes < 21 * 60) return "dinner";
  return null;
}

function getMealsForPeriod(day, period) {
  const legacyPeriod = getLegacyReceivedPeriod(day);
  const unassignedPeriod =
    legacyPeriod === "lunch" || legacyPeriod === "dinner"
      ? legacyPeriod
      : "lunch";
  const mains = (day.mains || []).filter(
    (item) =>
      item.mealPeriod === period ||
      (!item.mealPeriod && unassignedPeriod === period),
  );

  return {
    mains,
    drink: unassignedPeriod === period ? day.drink || null : null,
    soup: unassignedPeriod === period ? day.soup || null : null,
  };
}

function getOrderedMealPeriods(day) {
  const periods = new Set();
  const legacyPeriod = getLegacyReceivedPeriod(day);
  const unassignedPeriod =
    legacyPeriod === "lunch" || legacyPeriod === "dinner"
      ? legacyPeriod
      : "lunch";

  for (const item of day.mains || []) {
    periods.add(item.mealPeriod || unassignedPeriod);
  }

  if (day.drink || day.soup) periods.add(unassignedPeriod);

  return [...periods];
}

function getLegacyReceivedPeriod(day) {
  if (!day.received || day.receivedLunch || day.receivedDinner) return null;
  if (!day.receivedAt) return "all";

  return getMealPeriodAt(day.receivedAt) || "all";
}

function isPeriodReceived(day, period) {
  if (period === "lunch" && day.receivedLunch) return true;
  if (period === "dinner" && day.receivedDinner) return true;

  const legacyPeriod = getLegacyReceivedPeriod(day);
  return legacyPeriod === "all" || legacyPeriod === period;
}

function getReceivedPeriods(day) {
  const periods = [];

  for (const period of ["lunch", "dinner"]) {
    const isReceived = period === "lunch" ? day.receivedLunch : day.receivedDinner;
    if (isReceived) periods.push(period);
  }

  if (periods.length > 0) return periods;

  const legacyPeriod = getLegacyReceivedPeriod(day);
  if (legacyPeriod === "all") return ["lunch"];
  return legacyPeriod ? [legacyPeriod] : [];
}

function getUnreceivedMeals(day) {
  const legacyPeriod = getLegacyReceivedPeriod(day);
  const unassignedPeriod =
    legacyPeriod === "lunch" || legacyPeriod === "dinner"
      ? legacyPeriod
      : "lunch";
  const mains = (day.mains || []).filter((item) => {
    const period = item.mealPeriod || unassignedPeriod;
    return !isPeriodReceived(day, period);
  });

  return {
    mains,
    drink:
      unassignedPeriod === "lunch" && !isPeriodReceived(day, "lunch")
        ? day.drink || null
        : null,
    soup:
      unassignedPeriod === "lunch" && !isPeriodReceived(day, "lunch")
        ? day.soup || null
        : null,
  };
}

function hasAnyReceivedPeriod(day) {
  return day.received || day.receivedLunch || day.receivedDinner;
}

function markPeriodReceived(day, period, receivedAt = new Date()) {
  const legacyPeriod = getLegacyReceivedPeriod(day);

  if (legacyPeriod === "all" || legacyPeriod === "lunch") {
    day.receivedLunch = true;
    day.receivedLunchAt = day.receivedAt || receivedAt;
  }
  if (legacyPeriod === "all" || legacyPeriod === "dinner") {
    day.receivedDinner = true;
    day.receivedDinnerAt = day.receivedAt || receivedAt;
  }

  if (period === "lunch") {
    day.receivedLunch = true;
    day.receivedLunchAt = receivedAt;
  } else {
    day.receivedDinner = true;
    day.receivedDinnerAt = receivedAt;
  }

  const orderedPeriods = getOrderedMealPeriods(day);
  day.received =
    orderedPeriods.length > 0 &&
    orderedPeriods.every((orderedPeriod) => isPeriodReceived(day, orderedPeriod));

  if (day.received) {
    const receivedTimes = [day.receivedLunchAt, day.receivedDinnerAt]
      .filter(Boolean)
      .map((value) => new Date(value).getTime());
    day.receivedAt = receivedTimes.length
      ? new Date(Math.max(...receivedTimes))
      : receivedAt;
  } else {
    day.receivedAt = null;
  }
}

module.exports = {
  getMealPeriodAt,
  getMealsForPeriod,
  getOrderedMealPeriods,
  getReceivedPeriods,
  getUnreceivedMeals,
  hasAnyReceivedPeriod,
  isPeriodReceived,
  markPeriodReceived,
};
