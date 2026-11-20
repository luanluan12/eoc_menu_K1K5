import { useEffect, useState } from "react";

import { toast } from "react-toastify";

import WeekMenuContent from "../../components/WeekMenuContent";

import { getWeekMenu } from "../../api/menuApi";

import { useSearchParams } from "react-router-dom";

import DeadlineBanner from "../../components/DeadlineBanner";

import { useTranslation } from "react-i18next";

import { createOrder, updateOrder } from "../../api/orderApi";

import { verifyInvite } from "../../api/orderApi";

function getCurrentIsoWeek() {
  const today = new Date();
  const date = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const dayNumber = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);

  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function WeekMenu() {
  const [loading, setLoading] = useState(true);

  const [menu, setMenu] = useState(null);

  const [order, setOrder] = useState(null);

  const [searchParams] = useSearchParams();

  const { t } = useTranslation();

  const token = searchParams.get("token");

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      if (token) {
        const res = await verifyInvite(token);

        setMenu(res.data.data.menu);

        return;
      }

      // Chọn menu đã publish đúng tuần hiện tại, không lấy menu tuần sau mới publish nhất.
      const menuRes = await getWeekMenu(getCurrentIsoWeek());

      setMenu(menuRes.data.data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (days) => {
    try {
      if (order) {
        await updateOrder(order._id, {
          days,
        });
      } else {
        await createOrder({
          menuId: menu._id,
          days,
        });
      }

      toast.success("Đặt món thành công.");

      await loadData();

      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Có lỗi xảy ra.");

      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {t("loading")}
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="flex h-screen items-center justify-center">
        {t("no_week_menu")}
      </div>
    );
  }

  // Tạm bỏ validate deadline phía giao diện để test đặt món tuần hiện tại.
  // Khôi phục sau khi test xong:
  // const expired = new Date() > new Date(menu.deadline);
  const expired = false;

  if (expired) {
    return (
      <div className="mx-auto mt-20 max-w-2xl rounded-3xl bg-white/90 p-12 text-center shadow-xl">
        <div className="text-6xl">🍽️</div>

        <h2 className="mt-6 text-3xl font-bold">{t("order_closed")}</h2>

        <p className="mt-4 text-gray-500">{t("order_closed_message")}</p>

        <p className="mt-2 text-gray-500">{t("wait_next_menu")}</p>
      </div>
    );
  }

  return (
    <>
      <DeadlineBanner deadline={menu.deadline} />

      <WeekMenuContent
        menu={menu}
        initialOrder={order}
        editable={!token || !order}
        submitText={
          token ? "submit_order" : order ? "update_order" : "submit_order"
        }
        onSubmit={submit}
      />
    </>
  );
}

export default WeekMenu;
