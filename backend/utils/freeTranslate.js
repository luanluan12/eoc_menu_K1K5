const DISH_ARRAYS = ["mains", "drinks", "soups", "desserts"];
const PERIODS = ["lunch", "dinner"];
const CATEGORIES = ["rice", "vegetarian", "noodles", "soup"];
const translationCache = new Map();

async function translateText(text) {
  const normalizedText = text.trim();
  if (translationCache.has(normalizedText)) return translationCache.get(normalizedText);

  if (Buffer.byteLength(normalizedText, "utf8") > 500) {
    const error = new Error("Tên món quá dài để dịch bằng MyMemory (tối đa 500 byte mỗi yêu cầu).");
    error.statusCode = 400;
    throw error;
  }

  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", normalizedText);
  url.searchParams.set("langpair", "vi|en");
  url.searchParams.set("mt", "1");

  const contactEmail = process.env.MYMEMORY_EMAIL?.trim();
  if (contactEmail) url.searchParams.set("de", contactEmail);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const result = await response.json().catch(() => ({}));
  const translatedText = result.responseData?.translatedText?.trim();
  if (!response.ok || result.responseStatus !== 200 || !translatedText) {
    const error = new Error(result.responseDetails || "MyMemory đang bận hoặc đã hết hạn mức dịch miễn phí.");
    error.statusCode = response.status === 429 ? 429 : 503;
    throw error;
  }

  translationCache.set(normalizedText, translatedText);
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

  const translatedNames = new Map();
  for (const dish of targets) {
    const name = dish.name.trim();
    if (!translatedNames.has(name)) translatedNames.set(name, await translateText(name));
  }

  targets.forEach((dish) => {
    dish.nameEn = translatedNames.get(dish.name.trim()) || dish.name;
  });
  return days;
}

module.exports = { translateMenuDays };
