import { useEffect, useState } from "react";

import DayTabs from "./DayTabs";
import OrderNotice from "./OrderNotice";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useTranslation } from "react-i18next";
import { Check, CookingPot, CupSoda, Soup, UtensilsCrossed } from "lucide-react";

const MEAL_CATEGORIES = ["rice", "vegetarian", "noodles", "soup"];
const CATEGORY_ICONS = { rice: CookingPot, vegetarian: UtensilsCrossed, noodles: CupSoda, soup: Soup };

function getMealsForDisplay(day) {
  const flexible = day?.meals || {};
  const hasFlexibleDishes = ["lunch", "dinner"].some((period) =>
    MEAL_CATEGORIES.some((category) => (flexible[period]?.[category] || []).length > 0),
  );
  if (hasFlexibleDishes) return flexible;

  return {
    lunch: {
      rice: day?.mains || [],
      vegetarian: [],
      noodles: day?.drinks || [],
      soup: day?.soups || [],
    },
    dinner: { rice: [], vegetarian: [], noodles: [], soup: [] },
  };
}

function makeOrderDays(menuDays = [], initialOrder = null) {
  return menuDays.map((day, index) => {
    const existing = initialOrder?.days?.find((orderDay) =>
      new Date(orderDay.date).toDateString() === new Date(day.date).toDateString(),
    ) || initialOrder?.days?.[index];
    let savedMains = (existing?.mains || []).map((item) => ({
      ...item,
      mealPeriod: item.mealPeriod === "dinner" ? "dinner" : "lunch",
      category: MEAL_CATEGORIES.includes(item.category) ? item.category : item.vegetarian ? "vegetarian" : "rice",
      quantity: 1,
    }));
    if (savedMains.length === 0 && (existing?.drink || existing?.soup)) {
      const legacyDish = existing.drink || existing.soup;
      savedMains.push({ ...legacyDish, category: existing.drink ? "noodles" : "soup", mealPeriod: "lunch", quantity: 1 });
    }
    const selections = Object.fromEntries(["lunch", "dinner"].map((period) => {
      const selection = existing?.selections?.[period]
        || savedMains.find((item) => item.mealPeriod === period)?.category
        || null;
      return [period, selection];
    }));
    savedMains = ["lunch", "dinner"].flatMap((period) => {
      const category = selections[period];
      return category ? savedMains.filter((item) => item.mealPeriod === period && item.category === category) : [];
    });
    return {
      date: day.date,
      mains: savedMains,
      selections,
      drink: null,
      soup: null,
    };
  });
}

function WeekMenuContent({
  menu,
  initialOrder = null,
  onSubmit,
  submitText = "submit_order",
  editable = true,
  isReadonly = false,
  isManualOrder = false,
  isAdminEdit = false,
}) {
  const [currentDay, setCurrentDay] = useState(0);
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);

  const isDayCompleted = (index) => {
    const order = orders[index];

    if (!order) return false;

    return order.mains.length > 0 || !!order.drink || !!order.soup;
  };

  const isDayClosed = Boolean(menu?.days?.[currentDay]?.orderingClosed);

  // =========================
  // Init Order
  // =========================

  useEffect(() => {
    if (!menu) return;
    setOrders(makeOrderDays(menu.days, initialOrder));
  }, [menu, initialOrder]);

  if (!menu) return null;

  const day = menu.days[currentDay];
  const displayedMeals = getMealsForDisplay(day);

  const selectOption = (period, category) => {
    setOrders((current) => current.map((orderDay, index) => {
      if (index !== currentDay) return orderDay;
      const alreadySelected = orderDay.selections?.[period] === category;
      const nextCategory = alreadySelected ? null : category;
      const otherPeriodSelections = orderDay.mains.filter((item) =>
        (item.mealPeriod === "dinner" ? "dinner" : "lunch") !== period,
      );
      const groupDishes = nextCategory
        ? (displayedMeals[period]?.[nextCategory] || [])
          .filter((dish) => (typeof dish === "string" ? dish.trim() : dish?.name?.trim()))
          .map((dish) => ({
            dishId: dish._id,
            name: dish.name || dish,
            nameEn: dish.nameEn || "",
            image: dish.image || "",
            quantity: 1,
            mealPeriod: period,
            category: nextCategory,
          }))
        : [];
      return {
        ...orderDay,
        mains: [...otherPeriodSelections, ...groupDishes],
        selections: { ...(orderDay.selections || {}), [period]: nextCategory },
      };
    }));
  };

  const formatDateTime = (date) => {
    if (!date) return "";

    const locale = i18n.language === "en" ? "en-US" : "vi-VN";

    return new Date(date).toLocaleString(locale);
  };

  const handleSubmit = async () => {
    if (!editable) return;

    if (!onSubmit) return;

    for (const [index, menuDay] of menu.days.entries()) {
      if (menuDay.orderingClosed) continue;
      const selected = orders[index]?.mains || [];
      const selectedLunchOption = orders[index]?.selections?.lunch
        || selected.find((item) => item.mealPeriod !== "dinner")?.category;
      if (!selectedLunchOption) {
        await Swal.fire({ icon: "warning", title: t("choose_lunch_required"), confirmButtonColor: "#2563eb" });
        setCurrentDay(index);
        return;
      }
      const meals = getMealsForDisplay(menuDay);
      const hasAfternoonMenu = MEAL_CATEGORIES.some((category) => (meals.dinner?.[category] || []).length > 0);
      const selectedDinnerOption = orders[index]?.selections?.dinner
        || selected.find((item) => item.mealPeriod === "dinner")?.category;
      if (!hasAfternoonMenu && selectedDinnerOption) {
        await Swal.fire({ icon: "warning", title: t("afternoon_menu_unavailable"), confirmButtonColor: "#2563eb" });
        setCurrentDay(index);
        return;
      }
    }

    try {
      setLoading(true);

      const success = await onSubmit(orders);

      if (!success) return;

      if (isAdminEdit) {
        return;
      }

      if (isManualOrder) {
        await Swal.fire({
          icon: "success",
          title: "🎉 Đặt hộ thành công",
          text: "Đã tạo đơn đặt món cho nhân viên.",
          confirmButtonText: "Đóng",
          confirmButtonColor: "#3b82f6",
        });

        return;
      }

      await Swal.fire({
        icon: "success",
        title: `🎉 ${t("order_success_title")}`,
        text: t("order_success_message"),
        confirmButtonText: t("view_history"),
        confirmButtonColor: "#3b82f6",
        allowOutsideClick: false,
      });

      navigate("/history");
    } finally {
      setLoading(false);
    }
  };

  if (!menu) {
    return (
      <div className="flex h-screen items-center justify-center">
        {t("no_menu")}
      </div>
    );
  }

  const expired = new Date() > new Date(menu.deadline);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      {loading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-2xl bg-white px-10 py-8 shadow-2xl">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>

            <h3 className="mt-6 text-xl font-bold">{t("submitting_order")}</h3>

            <p className="mt-2 text-gray-500">{t("please_wait")}</p>
          </div>
        </div>
      )}

      {expired && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center sm:p-5">
          <h2 className="text-lg font-bold text-red-600 sm:text-xl">
            ⛔ {t("order_closed")}
          </h2>

          <p className="mt-2 text-gray-600">
            {t("deadline")}: {formatDateTime(menu.deadline)}
          </p>
        </div>
      )}

      {/* Tabs */}

      <div className="mb-10">
        <DayTabs
          days={menu.days}
          currentDay={currentDay}
          onChange={setCurrentDay}
          completed={isDayCompleted}
        />
      </div>
      {isDayClosed && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center font-semibold text-red-700">
          🔒 {t("day_off_message")}
        </div>
      )}
      <div className="space-y-9">
        {[['lunch', t("meal_lunch")], ['dinner', t("meal_dinner")]].map(([period, periodLabel]) => {
          const availableCategories = MEAL_CATEGORIES.filter((category) =>
            (displayedMeals[period]?.[category] || []).some((dish) => typeof dish === "string" ? dish.trim() : dish?.name?.trim()),
          );
          const selectedOption = orders[currentDay]?.selections?.[period]
            || orders[currentDay]?.mains.find((item) => (item.mealPeriod === "dinner" ? "dinner" : "lunch") === period)?.category;
          const selectedCategory = availableCategories.includes(selectedOption) ? selectedOption : null;
          const displayCategory = selectedCategory || availableCategories[0];
          const selectedFoods = displayCategory
            ? (displayedMeals[period]?.[displayCategory] || []).filter((dish) => typeof dish === "string" ? dish.trim() : dish?.name?.trim())
            : [];

          return (
            <section key={period} className="border-t border-orange-200/80 pt-5 first:border-t-0 first:pt-0">
              <div className="mb-4 flex items-center gap-3 text-slate-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
                  {period === "lunch" ? <UtensilsCrossed size={18} /> : <CookingPot size={18} />}
                </span>
                <h2 className="text-lg font-bold sm:text-xl">{periodLabel}</h2>
              </div>

              {availableCategories.length ? (
                <div className="grid gap-3 sm:grid-cols-[230px_minmax(0,1fr)] sm:items-stretch sm:gap-4">
                  <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-hide sm:flex-col sm:justify-start sm:overflow-visible sm:pb-0">
                    {MEAL_CATEGORIES.map((category) => {
                      const Icon = CATEGORY_ICONS[category];
                      const categoryAvailable = availableCategories.includes(category);
                      const selected = selectedCategory === category;
                      const viewing = displayCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          aria-pressed={selected}
                          disabled={isReadonly || !editable || isDayClosed || !categoryAvailable}
                          onClick={() => selectOption(period, category)}
                          className={`flex min-h-12 min-w-[160px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition sm:min-h-12 sm:w-full sm:min-w-0 sm:shrink sm:text-xs ${!categoryAvailable ? "cursor-not-allowed border-slate-100 bg-slate-50/80 text-slate-300" : selected ? "border-orange-500 bg-orange-500 text-white shadow-sm" : viewing ? "border-orange-300 bg-orange-50 text-slate-800" : "border-orange-100 bg-white/85 text-slate-700 hover:border-orange-300 hover:bg-orange-50"}`}
                        >
                          <Icon size={18} className={`shrink-0 ${!categoryAvailable ? "text-slate-300" : selected ? "text-white" : "text-orange-600"}`} />
                          <span className="min-w-0 flex-1 whitespace-nowrap">{t(`meal_${category}`)}</span>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-white bg-white text-orange-600" : categoryAvailable ? "border-slate-300 bg-white text-white" : "border-slate-200 bg-slate-50 text-white"}`} aria-hidden="true">
                            {selected && <Check size={14} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {displayCategory ? (
                    selectedFoods.length === 1 ? (
                      <div className="flex justify-center sm:justify-center">
                        {selectedFoods.map((food, index) => {
                          const name = typeof food === "string" ? food : food.name || "";
                          const nameEn = typeof food === "string" ? "" : food.nameEn || "";
                          const subtitle = typeof food === "string" ? "" : food.subtitle || "";
                          const displayName = i18n.language === "en" ? nameEn || name : name;
                          return (
                            <article key={food._id || `${name}-${index}`} className="flex min-h-32 w-full max-w-[440px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:h-[200px] sm:min-h-0 sm:gap-5 sm:p-4">
                              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-orange-50 sm:h-32 sm:w-32">
                                <img src={food.image || "https://placehold.co/600"} alt={displayName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              </div>
                              <div className="w-40 min-w-0 shrink-0 py-2 text-center sm:w-48">
                                <h3 className="break-words text-base font-semibold leading-snug text-slate-800 sm:text-lg">{displayName}</h3>
                                {subtitle && <p className="mt-1 line-clamp-2 text-sm text-slate-500 sm:text-base">{subtitle}</p>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex w-full items-start justify-start gap-2.5 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide sm:h-full sm:gap-3">
                        {selectedFoods.map((food, index) => {
                          const name = typeof food === "string" ? food : food.name || "";
                          const nameEn = typeof food === "string" ? "" : food.nameEn || "";
                          const subtitle = typeof food === "string" ? "" : food.subtitle || "";
                          const displayName = i18n.language === "en" ? nameEn || name : name;
                          return (
                            <article key={food._id || `${name}-${index}`} className="flex min-h-[220px] w-[150px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:h-full sm:min-h-0 sm:p-2">
                              <div className="aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-orange-50">
                                <img src={food.image || "https://placehold.co/600"} alt={displayName} loading="lazy" decoding="async" className="h-full w-full rounded-xl object-cover" />
                              </div>
                              <div className="flex min-h-[60px] flex-1 flex-col items-center justify-center px-1 py-2 text-center">
                                <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 sm:text-sm">{displayName}</h3>
                                {subtitle && <p className="mt-1 line-clamp-1 text-[10px] text-slate-500 sm:text-xs">{subtitle}</p>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/60 p-5 text-center text-sm text-slate-500">{t("no_meal_period_menu")}</div>
              )}
            </section>
          );
        })}
      </div>
      {!isReadonly && (
        <div className="mt-14 flex justify-center">
        <button
            onClick={handleSubmit}
            disabled={expired}
            className={`
                rounded-2xl
                px-14
                py-4
                text-lg
                font-bold
                text-white
                shadow-lg
                transition-all
                duration-300
                ${
                  expired
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-orange-500 hover:bg-orange-600 hover:shadow-xl active:scale-95"
                }
            `}
          >
            {expired ? t("expired") : t(submitText)}
          </button>
        </div>
      )}
    </div>
  );
}

export default WeekMenuContent;
