import { Fragment, useEffect, useState } from "react";
import {
  deleteOrder,
  getOrderById,
  getOrders,
  getWeekSummary,
  manualCheckin,
} from "../../api/orderApi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import OrderDetailModal from "./OrderDetailModal";
import CheckinQrModal from "./CheckinQrModal";
import { Check } from "lucide-react";
import ManualOrderModal from "../../components/ManualOrderModal";
import AdminOrderEditModal from "../../components/AdminOrderEditModal";
import BulkCancelOrderModal from "../../components/BulkCancelOrderModal";

function OrderManagement() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [processingCheckinId, setProcessingCheckinId] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [loadingEditOrder, setLoadingEditOrder] = useState(false);
  const [openScanner, setOpenScanner] = useState(false);
  const getLocalDate = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split("T")[0];
  };
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [keyword, setKeyword] = useState("");
  const [openManualOrder, setOpenManualOrder] = useState(false);
  const [openBulkCancel, setOpenBulkCancel] = useState(false);
  const [openWeekSummary, setOpenWeekSummary] = useState(false);
  const [weekSummary, setWeekSummary] = useState(null);
  const [weekSummaryLoading, setWeekSummaryLoading] = useState(false);
  const [weekSummaryKeyword, setWeekSummaryKeyword] = useState("");
  const getTodayOrder = (order) => {
    let today = new Date();

    const dayOfWeek = today.getDay();

    // Cuối tuần không có suất ăn: Chủ nhật lùi về thứ Bảy gần nhất.
    if (dayOfWeek === 0) {
      today.setDate(today.getDate() - 1);
    }

    today.setHours(0, 0, 0, 0);

    return order.days?.find((d) => {
      const date = new Date(d.date);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime();
    });
  };

  const handleManualCheckin = async (order) => {
    if (processingCheckinId) return;
    const ok = window.confirm(`Xác nhận ${order.user.name} đã nhận suất ăn?`);

    if (!ok) return;

    try {
      setProcessingCheckinId(order._id);
      await manualCheckin({
        orderId: order._id,
        date: selectedDate,
      });

      await loadOrders();

      alert("Check-in thành công.");
    } catch (err) {
      alert(err.response?.data?.message || "Check-in thất bại.");
    } finally {
      setProcessingCheckinId(null);
    }
  };

  const receivedCount = orders.filter(
    (order) => order.selectedDay?.received,
  ).length;

  const notReceivedCount = orders.length - receivedCount;
  const filteredOrders = orders.filter((order) => {
    const key = keyword.trim().toLowerCase();

    if (!key) return true;

    return (
      order.user?.name?.toLowerCase().includes(key) ||
      order.user?.email?.toLowerCase().includes(key) ||
      order.user?.employeeId?.toLowerCase().includes(key)
    );
  });
  const orderPeriods = [
    { id: "lunch", label: "Buổi trưa" },
    { id: "dinner", label: "Buổi chiều" },
  ];
  const getMainsForPeriod = (day, period) =>
    (day?.mains || []).filter((main) =>
      period === "lunch"
        ? !main.mealPeriod || main.mealPeriod === "lunch"
        : main.mealPeriod === "dinner",
    );
  const getOrdersForPeriod = (period) =>
    filteredOrders.filter((order) => {
      const day = order.selectedDay;
      return (
        getMainsForPeriod(day, period).length > 0 ||
        (period === "lunch" && (day?.drink || day?.soup))
      );
    });
  const isReceivedForPeriod = (day, period) => {
    const periodReceived = period === "lunch" ? day?.receivedLunch : day?.receivedDinner;
    if (periodReceived) return true;

    // Compatibility with older records that only have the whole-day flag.
    return Boolean(day?.received && !day?.receivedLunch && !day?.receivedDinner);
  };

  const exportExcel = () => {
    const data = orders.map((order, index) => {
      const todayOrder = order.selectedDay;

      return {
        STT: index + 1,
        "Nhân viên": order.user?.name,
        Email: order.user?.email,
        Tuần: order.week,
        "Nhận hôm nay": todayOrder?.received ? "Đã nhận" : "Chưa nhận",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(blob, "DanhSachDatMon.xlsx");
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await getOrders({
        date: selectedDate,
      });

      const filteredOrders = res.data.data.filter((order) => {
        const day = order.selectedDay;

        if (!day) return false;

        return day.mains?.length > 0 || !!day.drink || !!day.soup;
      });

      setOrders(filteredOrders);
    } catch (err) {
      console.log(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const getNextWeekStart = () => {
    const date = new Date(`${selectedDate}T12:00:00`);
    const day = date.getDay();
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;

    date.setDate(date.getDate() + daysUntilNextMonday);
    return date.toISOString().split("T")[0];
  };

  const loadWeekSummary = async (date) => {
    if (weekSummaryLoading) return;
    try {
      setWeekSummaryLoading(true);
      const res = await getWeekSummary(date);
      setWeekSummary(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || "Không tải được danh sách đặt món.");
      setOpenWeekSummary(false);
    } finally {
      setWeekSummaryLoading(false);
    }
  };

  const openWeekOrders = () => {
    if (weekSummaryLoading) return;
    setWeekSummaryKeyword("");
    setOpenWeekSummary(true);
    loadWeekSummary(getNextWeekStart());
  };

  const weekSummaryOrders = (weekSummary?.orders || []).filter((order) => {
    const search = weekSummaryKeyword.trim().toLowerCase();

    if (!search) return true;

    return [order.user?.name, order.user?.email, order.user?.employeeId].some(
      (value) => value?.toLowerCase().includes(search),
    );
  });

  const handleDeleteOrder = async (order) => {
    if (deletingOrderId) return;
    const name = order.user?.name || "nhân viên này";
    const email = order.user?.email || "";
    const confirmed = window.confirm(
      `Xóa vĩnh viễn order của ${name}${email ? ` (${email})` : ""}?`,
    );

    if (!confirmed) return;

    try {
      setDeletingOrderId(order._id);
      await deleteOrder(order._id);
      setWeekSummary((current) =>
        current
          ? {
              ...current,
              orders: current.orders.filter((item) => item._id !== order._id),
            }
          : current,
      );
      await loadOrders();
      alert("Đã xóa order.");
    } catch (err) {
      alert(err.response?.data?.message || "Xóa order thất bại.");
    } finally {
      setDeletingOrderId(null);
    }
  };

  const openOrderEditor = async (order) => {
    if (user?.role !== "admin" || loadingEditOrder) return;

    try {
      setLoadingEditOrder(true);
      const response = await getOrderById(order._id);
      setEditingOrder(response.data.data);
    } catch (err) {
      alert(err.response?.data?.message || "Không tải được chi tiết order.");
    } finally {
      setLoadingEditOrder(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedDate]);

  if (ordersLoading) {
    return <div className="py-20 text-center text-gray-500">Đang tải đơn hàng...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div />

        {(user?.role === "admin" || user?.role === "admin_kitchen") && (
          <div className="flex flex-wrap gap-3">
            {user?.role === "admin" && (
              <>
                <button
                  onClick={() => setOpenManualOrder(true)}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  + Đặt hộ
                </button>
                <button
                  onClick={() => setOpenBulkCancel(true)}
                  className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
                >
                  Huỷ món hàng loạt
                </button>
              </>
            )}

            <button
              onClick={() => setOpenScanner(true)}
              className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-600"
            >
              QR Check-in
            </button>
            <button
              onClick={openWeekOrders}
              disabled={weekSummaryLoading}
              className="rounded-xl bg-slate-700 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Người đặt tuần sau
            </button>
          </div>
        )}
      </div>

      {/* Thống kê */}

      <div className="mb-6 grid grid grid-cols-1 gap-4 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Tổng đơn</p>
          <p className="mt-2 text-3xl font-bold">{orders.length}</p>
        </div>

        <div className="rounded-xl border bg-blue-50 p-5 shadow">
          <p className="text-sm text-blue-600">Đã nhận hôm nay</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            {receivedCount}
          </p>
        </div>

        <div className="rounded-xl border bg-red-50 p-5 shadow">
          <p className="text-sm text-red-600">Chưa nhận hôm nay</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {notReceivedCount}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="🔍 Tìm tên, email hoặc mã nhân viên..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full rounded-xl border p-3 sm:max-w-md"
        />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full rounded-xl border p-3 sm:w-auto"
        />
      </div>

      <div className="hidden overflow-hidden rounded-2xl border bg-white shadow lg:block">
        <div className="max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
            <tr>
              <th className="p-4 text-left">STT</th>

              <th className="p-4 text-left">Nhân viên</th>

              <th className="p-4 text-left">Email</th>

              <th className="p-4 text-center">Bếp</th>

              <th className="p-4 text-center">Tuần</th>

              <th className="p-4 text-center">Nhận hôm nay</th>
              <th className="p-4 text-center">Check-in</th>

              <th className="p-4 text-center">Chi tiết</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400">
                  Chưa có đơn đặt món.
                </td>
              </tr>
            ) : (
              orderPeriods.map((period) => {
                const periodOrders = getOrdersForPeriod(period.id);
                return (
                  <Fragment key={period.id}>
                    <tr className="border-t bg-blue-50">
                      <td colSpan={8} className="px-4 py-3 font-bold text-blue-800">
                        {period.label} <span className="font-medium">({periodOrders.length} đơn)</span>
                      </td>
                    </tr>
                    {periodOrders.map((order, index) => {
                      const todayOrder = order.selectedDay;
                      const received = isReceivedForPeriod(todayOrder, period.id);
                      const periodReceivedAt = period.id === "lunch"
                        ? todayOrder?.receivedLunchAt
                        : todayOrder?.receivedDinnerAt;
                      const mains = getMainsForPeriod(todayOrder, period.id);

                      return (
                  <tr key={`${period.id}-${order._id}`} className="border-t hover:bg-gray-50">
                    <td className="p-4">{index + 1}</td>

                    <td className="p-4">{order.user?.name}</td>

                    <td className="p-4">{order.user?.email}</td>

                    <td className="p-4 text-center">{order.user?.kitchen}</td>

                    <td className="p-4 text-center">{order.week}</td>

                    <td className="p-4 text-center">
                      <span
                        title={
                          periodReceivedAt || (received ? todayOrder?.receivedAt : null)
                            ? new Date(periodReceivedAt || todayOrder.receivedAt).toLocaleString(
                                "vi-VN",
                              )
                            : ""
                        }
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${received ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}
                      >
                        {received ? "Đã nhận" : "Chưa nhận"}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      {received ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-700">
                          <Check size={16} />
                          Đã nhận
                        </span>
                      ) : (
                        <button
                          disabled={processingCheckinId !== null}
                          onClick={() => handleManualCheckin(order)}
                          className="rounded-lg bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {processingCheckinId === order._id ? "Đang xử lý..." : "Check-in"}
                        </button>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        >
                          Xem
                        </button>
                        {user?.role === "admin" && (
                          <button
                            onClick={() => openOrderEditor(order)}
                            disabled={loadingEditOrder}
                            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                          >
                            Sửa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                      );
                    })}
                    {periodOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-gray-400">
                          Chưa có đơn cho {period.label.toLowerCase()}.
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
        </div>

        <OrderDetailModal
          open={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      </div>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 lg:hidden">
        {filteredOrders.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow">
            Chưa có đơn đặt món.
          </div>
        ) : (
          orderPeriods.map((period) => {
            const periodOrders = getOrdersForPeriod(period.id);
            return (
              <section key={period.id} className="space-y-3">
                <h2 className="rounded-xl bg-blue-50 px-4 py-3 font-bold text-blue-800">
                  {period.label} ({periodOrders.length} đơn)
                </h2>
                {periodOrders.length === 0 ? (
                  <div className="rounded-xl bg-white p-5 text-center text-gray-400 shadow">
                    Chưa có đơn cho {period.label.toLowerCase()}.
                  </div>
                ) : periodOrders.map((order) => {
              const day = order.selectedDay;
              const received = isReceivedForPeriod(day, period.id);
              const periodReceivedAt = period.id === "lunch" ? day?.receivedLunchAt : day?.receivedDinnerAt;
              const mains = getMainsForPeriod(day, period.id);

              return (
              <div key={`${period.id}-${order._id}`} className="rounded-2xl bg-white p-5 shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{order.user?.name}</h2>

                    <p className="text-sm text-gray-500">{order.user?.email}</p>
                  </div>

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                    Bếp {order.user?.kitchen}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tuần</span>

                    <span>{order.week}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Trạng thái</span>

                    <span>{received ? "✅ Đã nhận" : "⏳ Chưa nhận"}</span>
                  </div>

                  {(periodReceivedAt || (received && day?.receivedAt)) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Thời gian</span>

                      <span>
                        {new Date(periodReceivedAt || day.receivedAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {mains.map((main, mainIndex) => (
                    <span key={mainIndex} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                      {main.name}{main.quantity > 1 ? ` ×${main.quantity}` : ""}
                    </span>
                  ))}
                  {period.id === "lunch" && day?.drink && <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{day.drink.name}</span>}
                  {period.id === "lunch" && day?.soup && <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{day.soup.name}</span>}
                </div>
                {!received && (
                  <button
                    disabled={processingCheckinId !== null}
                    onClick={() => handleManualCheckin(order)}
                    className="mt-4 w-full rounded-lg bg-blue-500 py-2 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processingCheckinId === order._id ? "Đang xử lý..." : "Check-in"}
                  </button>
                )}

                <button
                  onClick={() => setSelectedOrder(order)}
                  className="mt-5 w-full rounded-lg bg-blue-600 py-2 text-white"
                >
                  Xem chi tiết
                </button>
                {user?.role === "admin" && (
                  <button
                    onClick={() => openOrderEditor(order)}
                    disabled={loadingEditOrder}
                    className="mt-2 w-full rounded-lg bg-blue-500 py-2 font-semibold text-white hover:bg-blue-600"
                  >
                    Sửa order
                  </button>
                )}
              </div>
              );
            })}
              </section>
            );
          })
        )}
      </div>
      <OrderDetailModal
        open={!!selectedOrder}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
      <CheckinQrModal
        open={openScanner}
        onClose={() => setOpenScanner(false)}
      />
      <ManualOrderModal
        open={openManualOrder}
        onClose={() => setOpenManualOrder(false)}
        onSuccess={() => {
          loadOrders();
        }}
      />
      <BulkCancelOrderModal
        open={openBulkCancel}
        onClose={() => setOpenBulkCancel(false)}
        onSuccess={() => {
          loadOrders();
          if (openWeekSummary) {
            loadWeekSummary(getNextWeekStart());
          }
        }}
      />
      <AdminOrderEditModal
        open={!!editingOrder}
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSuccess={() => {
          loadOrders();
          if (openWeekSummary) {
            loadWeekSummary(getNextWeekStart());
          }
        }}
      />
      {openWeekSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-xl font-bold">Người đã đặt món tuần sau</h2>
                {weekSummary && (
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(`${weekSummary.weekStart}T00:00:00`).toLocaleDateString("vi-VN")} - {new Date(`${weekSummary.weekEnd}T00:00:00`).toLocaleDateString("vi-VN")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpenWeekSummary(false)}
                className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100"
              >
                Đóng
              </button>
            </div>
            <div className="max-h-[calc(85vh-80px)] overflow-y-auto p-5">
              {weekSummaryLoading ? (
                <p className="py-10 text-center text-gray-500">Đang tải...</p>
              ) : weekSummary?.orders?.length ? (
                <div className="overflow-x-auto">
                  <div className="mb-4 flex min-w-[620px] gap-2">
                    <input
                      type="search"
                      value={weekSummaryKeyword}
                      onChange={(event) => setWeekSummaryKeyword(event.target.value)}
                      placeholder="Tìm tên, email hoặc mã nhân viên..."
                      className="w-full rounded-lg border px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => setWeekSummaryKeyword(weekSummaryKeyword.trim())}
                      className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                    >
                      Tìm kiếm
                    </button>
                  </div>
                  <table className="w-full min-w-[620px]">
                    <thead className="border-b bg-gray-50 text-left text-sm text-gray-600">
                      <tr>
                        <th className="p-3">Nhân viên</th>
                        <th className="p-3">Email</th>
                        <th className="p-3 text-center">Bếp</th>
                        <th className="p-3 text-center">Tuần</th>
                        <th className="p-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekSummaryOrders.map((order) => (
                        <tr key={order._id} className="border-b last:border-0">
                          <td className="p-3 font-medium">{order.user?.name || "Đã xóa user"}</td>
                          <td className="p-3 text-gray-600">{order.user?.email || "-"}</td>
                          <td className="p-3 text-center">{order.user?.kitchen ?? "-"}</td>
                          <td className="p-3 text-center">{order.week}</td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-2">
                              {user?.role === "admin" && (
                                <button
                                  onClick={() => openOrderEditor(order)}
                                  disabled={loadingEditOrder}
                                  className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                                >
                                  Sửa order
                                </button>
                              )}
                              <button
                                disabled={deletingOrderId !== null}
                                onClick={() => handleDeleteOrder(order)}
                                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingOrderId === order._id ? "Đang xóa..." : "Xóa order"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {weekSummaryOrders.length === 0 && (
                    <p className="py-8 text-center text-gray-500">
                      Không tìm thấy người phù hợp.
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-10 text-center text-gray-500">Chưa có ai đặt món trong tuần này.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderManagement;
