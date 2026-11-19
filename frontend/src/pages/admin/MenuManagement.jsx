import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import { useNavigate } from "react-router-dom";
import MenuWeekCard from "../../components/MenuWeekCard";

import { toast } from "react-toastify";

import {
    FaEdit,
    FaTrash,
    FaSearch,
    FaPaperPlane,
} from "react-icons/fa";

import {
    getMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    publishMenu as publishMenuApi,
    setDayOrderingClosed,
} from "../../api/menuApi";

const getMenuDateRange = (menu) => {
    const first = menu.days?.[0]?.date;
    const last = menu.days?.[menu.days.length - 1]?.date;
    if (!first || !last) return "";
    const format = (value) => new Date(value).toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
    });
    return `${format(first)} – ${format(last)}`;
};

function MenuManagement() {
    const [menus, setMenus] = useState([]);
    const [filteredMenus, setFilteredMenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [keyword, setKeyword] = useState("");
    const navigate = useNavigate();
    const [publishingId, setPublishingId] = useState(null);
    const [publishMenu, setPublishMenu] = useState(null);
    const [publishing, setPublishing] = useState(false);
    const [updatingDayId, setUpdatingDayId] = useState(null);

    const loadMenus = async () => {

        setLoading(true);
        try {

            const res = await getMenus();

            const data = res.data.data ?? res.data;

            setMenus(data);

            setFilteredMenus(data);

        } catch (err) {

            console.log(err);

            toast.error("Không tải được Menu");

        } finally {
            setLoading(false);
        }

    };

    const handleAdd = () => {

        setEditingMenu(null);

        setOpenModal(true);

    };

    const handleEdit = (menu) => {

        navigate(

            `/admin/menu/edit/${menu._id}`

        );

    };

    const handleDelete = async (id) => {

        if (deletingId) return;

        const confirmDelete = window.confirm(
            "Bạn có chắc muốn xóa Menu?"
        );

        if (!confirmDelete) return;

        try {

            setDeletingId(id);

            await deleteMenu(id);

            toast.success("Xóa thành công");

            await loadMenus();

        } catch (err) {

            alert(

                err.response?.data?.message ||

                "Không thể xóa"

            );

        } finally {
            setDeletingId(null);
        }

    };

    // const handlePublish = async (menu) => {

    //     const confirmPublish = window.confirm(

    //         `Bạn có chắc muốn Gửi Menu tuần ${menu.week}?\n\n` +

    //         `Sau khi Publish sẽ gửi Email cho toàn bộ nhân viên.`

    //     );

    //     if (!confirmPublish) {

    //         return;

    //     }

    //     try {

    //         setPublishingId(menu._id);

    //         const res = await publishMenu(menu._id);

    //         toast.success(
    //             `${res.data.message} (${res.data.sent} email)`
    //         );

    //         await loadMenus();

    //     }


    //     catch (err) {

    //         toast.error(

    //             err.response?.data?.message ||

    //             err.message ||

    //             "Publish thất bại"

    //         );

    //     }
    //     finally {

    //         setPublishingId(null);

    //     }

    // };
    const handlePublish = (menu) => {
    setPublishMenu(menu);
};
const confirmPublish = async () => {

    if (!publishMenu) return;

    try {

        setPublishing(true);

        setPublishingId(publishMenu._id);

        const res = await publishMenuApi(publishMenu._id);

        toast.success(
            `${res.data.message} (${res.data.sent} email)`
        );

        setPublishMenu(null);

        await loadMenus();

    } catch (err) {

        toast.error(
            err.response?.data?.message ||
            "Publish thất bại"
        );

    } finally {

        setPublishing(false);

        setPublishingId(null);

    }

};

    const toggleDayOrdering = async (menu, day) => {
        if (updatingDayId) return;
        const closed = !day.orderingClosed;
        setUpdatingDayId(day._id);
        try {
            const response = await setDayOrderingClosed(menu._id, day._id, closed);
            const updatedMenu = response.data.data;
            setMenus((current) => current.map((item) => item._id === updatedMenu._id ? updatedMenu : item));
            toast.success(closed ? "Đã khóa ngày đặt món." : "Đã mở lại ngày đặt món.");
        } catch (err) {
            toast.error(err.response?.data?.message || "Không thể cập nhật trạng thái ngày.");
        } finally {
            setUpdatingDayId(null);
        }
    };

    useEffect(() => {
        loadMenus();
    }, []);

    useEffect(() => {

        const value = keyword.trim().toLowerCase();

        if (!value) {

            setFilteredMenus(menus);

            return;

        }

        const result = menus.filter(menu =>

            menu.days?.some(day =>

                day.mains?.some(item =>
                    item.name.toLowerCase().includes(value)
                ) ||

                day.drinks?.some(item =>
                    item.name.toLowerCase().includes(value)
                ) ||

                day.soups?.some(item =>
                    item.name.toLowerCase().includes(value)
                ) ||

                day.desserts?.some(item =>
                    item.name.toLowerCase().includes(value)
                ) || Object.values(day.meals || {}).some((period) =>
                    Object.values(period || {}).some((items) =>
                        items?.some((item) => (item.name || "").toLowerCase().includes(value))
                    )
                )

            )

        );

        setFilteredMenus(result);

    }, [keyword, menus]);

    if (loading) return <Loading />;

    return (
        <div className="space-y-6">

            {/* Title */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <button
                        onClick={() => navigate("/admin/menu/create")}
                        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-blue-700"
                    >
                        <span className="text-lg">+</span>
                        <span>Tạo Menu Tuần</span>
                    </button>
                </div>

            </div>

            {/* Table */}

            <div className="hidden overflow-hidden rounded-xl bg-white shadow lg:block">

                <table className="min-w-full">

                    <thead className="bg-gray-100">

                        <tr>

                            <th className="px-4 py-3 text-left">
                                Tuần
                            </th>

                            <th className="px-4 py-3 text-center">
                                Năm
                            </th>

                            <th className="px-4 py-3 text-center">
                                Số ngày
                            </th>

                            <th className="px-4 py-3 text-center">
                                Trạng thái
                            </th>

                            <th className="px-4 py-3 text-center">
                                Ngày tạo
                            </th>

                            <th className="px-4 py-3 text-center">
                                Action
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {

                            filteredMenus.length === 0 ?

                                (

                                    <tr>

                                        <td
                                            colSpan={7}
                                            className="py-10 text-center"
                                        >

                                            Không có dữ liệu

                                        </td>

                                    </tr>

                                )

                                :


                                filteredMenus.map(menu => (

                                    <tr
                                        key={menu._id}
                                        className="border-t hover:bg-gray-50"
                                    >

                                        <td className="px-4 py-3 font-semibold">
                                            <div>{menu.week}</div>
                                            <div className="mt-1 text-xs font-normal text-slate-500">{getMenuDateRange(menu)}</div>

                                        </td>

                                        <td className="px-4 py-3 text-center">

                                            {menu.year}

                                        </td>

                                        <td className="px-4 py-3 text-center">

                                            {menu.days?.length || 0}

                                        </td>

                                        <td className="px-4 py-3 text-center">

                                            {

                                                menu.status === "published"

                                                    ?

                                                    <span className="rounded bg-blue-100 px-3 py-1 text-blue-700">

                                                        Đã Gửi

                                                    </span>

                                                    :

                                                    <span className="rounded bg-blue-100 px-3 py-1 text-blue-700">

                                                        Chưa Gửi

                                                    </span>

                                            }

                                        </td>

                                        <td className="px-4 py-3 text-center">

                                            {

                                                new Date(menu.createdAt)

                                                    .toLocaleDateString("vi-VN")

                                            }

                                        </td>

                                        <td className="px-4 py-3">

                                            <div className="flex justify-center gap-3">

                                                <select
                                                    aria-label={`Trạng thái đặt món tuần ${menu.week}`}
                                                    disabled={updatingDayId !== null}
                                                    className="max-w-44 rounded border px-2 py-1 text-sm"
                                                    value=""
                                                    onChange={(event) => {
                                                        const day = menu.days?.[Number(event.target.value)];
                                                        if (day) toggleDayOrdering(menu, day);
                                                        event.target.value = "";
                                                    }}
                                                >
                                                    <option value="" disabled>Khóa / mở ngày</option>
                                                    {menu.days?.map((day, index) => (
                                                        <option key={day._id} value={index}>
                                                            {new Date(day.date).toLocaleDateString("vi-VN")} · {day.orderingClosed ? "Đang khóa" : "Đang mở"}
                                                        </option>
                                                    ))}
                                                </select>

                                                <button
                                                    onClick={() => handleEdit(menu)}
                                                    className="rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
                                                >
                                                    <FaEdit />
                                                </button>

                                                <button
                                                    disabled={deletingId === menu._id}
                                                    onClick={() => handleDelete(menu._id)}
                                                    className="rounded bg-red-500 p-2 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {deletingId === menu._id ? "..." : <FaTrash />}
                                                </button>

                                                <button
                                                    disabled={
                                                        menu.status === "published" ||
                                                        publishingId === menu._id
                                                    }
                                                    onClick={() => handlePublish(menu)}
                                                    className={`rounded p-2 text-white ${menu.status === "published"
                                                        ? "bg-gray-400 cursor-not-allowed"
                                                        : "bg-blue-500 hover:bg-blue-600"
                                                        }`}
                                                >
                                                    <FaPaperPlane />
                                                </button>

                                            </div>

                                        </td>

                                    </tr>

                                ))

                        }

                    </tbody>

                </table>

            </div>
            <div className="space-y-4 lg:hidden">

    {

        filteredMenus.length === 0 ? (

            <div className="rounded-xl bg-white p-8 text-center shadow">

                Không có dữ liệu

            </div>

        ) : (

            filteredMenus.map(menu => (

                <div
                    key={menu._id}
                    className="rounded-2xl bg-white p-5 shadow"
                >

                    <div className="flex items-center justify-between">

                        <div>

                            <h2 className="text-lg font-bold">

                                {menu.week}

                            </h2>

                            <p className="text-sm text-gray-500">

                                Năm {menu.year}

                            </p>

                            <p className="mt-1 text-xs text-slate-500">{getMenuDateRange(menu)}</p>

                        </div>

                        {

                            menu.status === "published"

                                ?

                                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">

                                    Đã gửi

                                </span>

                                :

                                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">

                                    Chưa Gửi

                                </span>

                        }

                    </div>

                    <div className="mt-4 space-y-2 text-sm">

                        <div className="flex justify-between">

                            <span className="text-gray-500">

                                Số ngày

                            </span>

                            <span>

                                {menu.days?.length || 0}

                            </span>

                        </div>

                        <div className="flex justify-between">

                            <span className="text-gray-500">

                                Ngày tạo

                            </span>

                            <span>

                                {

                                    new Date(menu.createdAt)

                                        .toLocaleDateString("vi-VN")

                                }

                            </span>

                        </div>

                    </div>

                    <div className="mt-5 flex gap-2">

                        <button
                            onClick={() => handleEdit(menu)}
                            className="flex-1 rounded-lg bg-blue-500 py-2 text-white"
                        >

                            <FaEdit className="mx-auto" />

                        </button>

                        <button
                            disabled={deletingId === menu._id}
                            onClick={() => handleDelete(menu._id)}
                            className="flex-1 rounded-lg bg-red-500 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >

                            {deletingId === menu._id ? "Đang xóa..." : <FaTrash className="mx-auto" />}

                        </button>

                        <button

                            disabled={
                                menu.status === "published" ||
                                publishingId === menu._id
                            }

                            onClick={() => handlePublish(menu)}

                            className={`flex-1 rounded-lg py-2 text-white ${
                                menu.status === "published"
                                    ? "bg-gray-400"
                                    : "bg-blue-500"
                            }`}

                        >

                            <FaPaperPlane className="mx-auto" />

                        </button>

                    </div>

                </div>

            ))

        )

    }

</div>

        {publishMenu && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-[420px] rounded-2xl bg-white p-6 shadow-xl">

            <h2 className="text-xl font-bold">
                Publish Menu
            </h2>

            <p className="mt-4 text-gray-700">
                Bạn có chắc muốn gửi menu{" "}
                <strong>{publishMenu.week}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">

                <button
                    disabled={publishing}
                    onClick={() => setPublishMenu(null)}
                    className="rounded-lg border px-5 py-2 hover:bg-gray-50"
                >
                    Hủy
                </button>

                <button
                    disabled={publishing}
                    onClick={confirmPublish}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-70"
                >
                    {publishing ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                            Đang Gửi...
                        </>
                    ) : (
                        <>
                            <FaPaperPlane />
                            Gửi
                        </>
                    )}
                </button>

            </div>

        </div>
    </div>
)}
        </div>

    );
}

export default MenuManagement;
