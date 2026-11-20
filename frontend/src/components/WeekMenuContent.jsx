import { useEffect, useState } from "react";

import DayTabs from "./DayTabs";
import FoodGroup from "./FoodGroup";
import OrderNotice from "./OrderNotice";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useTranslation } from "react-i18next";

const MEAL_CATEGORIES = ["rice", "vegetarian", "noodles", "soup"];

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
      {!isReadonly && (
        <div className="mb-10">
          <OrderNotice flexible />
        </div>
      )}

      <div className="space-y-10">
        {[["lunch", t("meal_lunch"), t("meal_required")], ["dinner", t("meal_dinner"), t("meal_optional")]].map(([period, periodLabel, requirement]) => (
          <section key={period} className="rounded-2xl py-2 sm:py-3">
            <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-slate-800">
              {periodLabel}
            </h2>
            {!isReadonly && <p className="-mt-3 mb-5 text-sm text-slate-500">{t("choose_one_option")}</p>}
            {MEAL_CATEGORIES.some((category) => (displayedMeals[period]?.[category] || []).length > 0) ? (
            <div className="space-y-8">
              {[["rice", t("meal_rice")], ["vegetarian", t("meal_vegetarian")], ["noodles", t("meal_noodles")], ["soup", t("meal_soup")]].map(([category, label]) => {
                const foods = (displayedMeals[period]?.[category] || []).filter((dish) => (typeof dish === "string" ? dish.trim() : dish.name?.trim()));
                if (!foods.length) return null;
                const selectedOption = orders[currentDay]?.selections?.[period]
                  || orders[currentDay]?.mains.find((item) => (item.mealPeriod === "dinner" ? "dinner" : "lunch") === period)?.category;
                return (
                  <FoodGroup
                    key={category}
                    title={label}
                    foods={foods}
                    type="main"
                    readOnly
                    optionSelectable={!isReadonly && editable && !isDayClosed}
                    optionSelected={selectedOption === category}
                    onSelectOption={() => selectOption(period, category)}
                  />
                );
              })}
            </div>
            ) : (
              <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-slate-500">{t("no_meal_period_menu")}</div>
            )}
          </section>
        ))}
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
