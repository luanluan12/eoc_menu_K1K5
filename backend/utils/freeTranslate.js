const DISH_ARRAYS = ["mains", "drinks", "soups", "desserts"];
const PERIODS = ["lunch", "dinner"];
const CATEGORIES = ["rice", "vegetarian", "noodles", "soup"];
const translationCache = new Map();

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateText(text) {
  if (translationCache.has(text)) return translationCache.get(text);

  const bytes = new TextEncoder().encode(text).length;
  if (bytes > 500) {
    const error = new Error("Tên món quá dài để dịch miễn phí (giới hạn 500 byte mỗi tên).");
    error.statusCode = 400;
    throw error;
  }

  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", "vi|en");
  url.searchParams.set("mt", "1");

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const result = await response.json();
  const translatedText = result.responseData?.translatedText?.trim();
  if (!response.ok || result.responseStatus !== 200 || !translatedText) {
    const error = new Error(result.responseDetails || "Dịch vụ dịch miễn phí đang bận hoặc đã hết hạn mức 5.000 ký tự/ngày.");
    error.statusCode = 503;
    throw error;
  }

  translationCache.set(text, translatedText);
  return translatedText;
}

async function translateMenuDays(days, previousDays = []) {
  const targets = [];
  const collect = (dish, oldDish) => {
    if (!dish || typeof dish.name !== "string" || !dish.name.trim()) return;
    const nameChanged = oldDish && oldDish.name !== dish.name;
    const translationIsStale = nameChanged && dish.nameEn === oldDish.nameEn;
    if (!dish.nameEn?.trim() || translationIsStale) targets.push(dish);
  };

  days.forEach((day, dayIndex) => {
    const oldDay = previousDays[dayIndex] || {};
    for (const key of DISH_ARRAYS) {
      (day[key] || []).forEach((dish, index) => collect(dish, oldDay[key]?.[index]));
    }
    for (const period of PERIODS) {
      for (const category of CATEGORIES) {
        const dishes = day.meals?.[period]?.[category] || [];
        const oldDishes = oldDay.meals?.[period]?.[category] || [];
        dishes.forEach((dish, index) => {
          const oldDish = oldDishes.find((item) => String(item._id) === String(dish._id)) || oldDishes[index];
          collect(dish, oldDish);
        });
      }
    }
  });

  const uniqueNames = [...new Set(targets.map((dish) => dish.name.trim()))];
  const translatedNames = new Map();
  for (const [index, name] of uniqueNames.entries()) {
    if (index > 0) await pause(350);
    translatedNames.set(name, await translateText(name));
  }

  targets.forEach((dish) => {
    dish.nameEn = translatedNames.get(dish.name.trim()) || dish.name;
  });
  return days;
}

module.exports = { translateMenuDays };
