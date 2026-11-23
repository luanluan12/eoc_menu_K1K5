import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaKey,
  FaFileExcel,
} from "react-icons/fa";
import { toast } from "react-toastify";
import UserModal from "../../components/UserModal";

import { FaUserSlash } from "react-icons/fa";

import ResignUserModal from "../../components/ResignUserModal";

import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  importExcel,
  downloadTemplate,
} from "../../api/userApi";

function UserManagement() {
  const fileRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [userActionId, setUserActionId] = useState(null);

  const [keyword, setKeyword] = useState("");

  const [openModal, setOpenModal] = useState(false);

  const [editingUser, setEditingUser] = useState(null);

  const [openResignModal, setOpenResignModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);

  const renderRole = (user) => user.role === "guest" ? (
    <span className="inline-flex min-w-36 flex-col items-center rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700 leading-tight">
      <span className="text-sm font-semibold">Guest</span>
      <span className="mt-0.5 text-[11px] font-medium text-blue-600">
        {user.guestType === "expert" ? "Chuyên gia" : user.guestType === "employee" ? "Nhân viên" : "Chưa chọn loại"}
        <span className="mx-1 text-blue-300">·</span>
        {user.company || "Chưa chọn công ty"}
      </span>
    </span>
  ) : (
    <span className="inline-flex rounded-lg bg-blue-100 px-3 py-1 text-blue-700">
      {user.role}
    </span>
  );

  const handleDownloadTemplate = async () => {
    if (downloadingTemplate) return;
    setDownloadingTemplate(true);
    try {
      const res = await downloadTemplate();

      const url = window.URL.createObjectURL(new Blob([res.data]));

      const link = document.createElement("a");

      link.href = url;

      link.download = "User_Template.xlsx";

      link.click();

      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Không tải được Template");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);

    setOpenModal(true);
  };

  const handleResetPassword = async (id) => {
    if (userActionId) return;
    if (!window.confirm("Reset password?")) return;

    try {
      setUserActionId(id);
      await resetPassword(id);

      toast.success("Reset password thành công");
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset thất bại");
    } finally {
      setUserActionId(null);
    }
  };

  const handleImportExcel = async (e) => {
    if (importing) return;
    const file = e.target.files[0];

    if (!file) return;

    const formData = new FormData();

    formData.append("file", file);

    setImporting(true);
    try {
      const res = await importExcel(formData);

      const result = res.data;

      toast.success(
        `Đã thêm ${result.imported ?? 0} user, bỏ qua ${result.failed ?? 0} user.`,
      );

      if (result.errors?.length) {
        toast.info(`Có ${result.errors.length} dòng lỗi. Mở Console để xem chi tiết.`);
        console.table(result.errors);
      }

      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Import thất bại");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);

    setOpenModal(true);
  };

  const handleSave = async (form) => {
    if (saving) return;
    setSaving(true);
    try {
      if (editingUser) {
        await updateUser(
          editingUser._id,

          form,
        );

        toast.success("Cập nhật thành công");
      } else {
        await createUser(form);

        toast.success("Thêm User thành công");
      }

      setOpenModal(false);

      setEditingUser(null);

      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Có lỗi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (userActionId) return;
    if (!window.confirm("Bạn có chắc muốn xóa?")) return;

    try {
      setUserActionId(id);
      await deleteUser(id);

      toast.success("Đã xóa");

      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa");
    } finally {
      setUserActionId(null);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await getUsers();

      const data = res.data.data ?? res.data;

      setUsers(data);
    } catch (err) {
      console.log(err);

      alert("Không tải được User");
    } finally {
      setLoading(false);
    }
  };

  const handleResign = (user) => {
    setSelectedUser(user);

    setOpenResignModal(true);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const value = keyword.toLowerCase();

      return (
        user.employeeId?.toLowerCase().includes(value) ||
        user.name?.toLowerCase().includes(value) ||
        user.email?.toLowerCase().includes(value) ||
        user.kitchen?.toString().includes(value) ||
        user.role?.toLowerCase().includes(value)
      );
    });
  }, [users, keyword]);

  const getStatus = (user) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const inactiveDate = user.inactiveFrom ? new Date(user.inactiveFrom) : null;

    if (inactiveDate) {
      inactiveDate.setHours(0, 0, 0, 0);
    }

    if (
      user.status === "inactive" ||
      inactiveDate?.getTime() <= today.getTime()
    ) {
      return {
        text: "Đã nghỉ việc",
        className: "bg-red-500 text-white",
      };
    }

    if (inactiveDate) {
      const day = String(inactiveDate.getDate()).padStart(2, "0");
      const month = String(inactiveDate.getMonth() + 1).padStart(2, "0");

      return {
        text: `Nghỉ từ ${day}/${month}`,
        className: "bg-blue-500 text-white",
      };
    }

    return {
      text: "Còn hoạt động",
      className: "bg-blue-600 text-white",
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <button
          onClick={handleAdd}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
        >
          <FaPlus />
          Thêm User
        </button>

        <button
          onClick={() => fileRef.current.click()}
          disabled={importing}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaFileExcel />
          {importing ? "Đang import..." : "Import Excel"}
        </button>

        <button
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaFileExcel />
          {downloadingTemplate ? "Đang tải..." : "Download Template"}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          disabled={importing}
          onChange={handleImportExcel}
        />
      </div>

      <div className="flex w-full items-center rounded-lg border bg-white px-4 py-3 lg:w-96">
        <FaSearch className="mr-3 text-gray-500" />

        <input
          className="w-full outline-none"
          placeholder="Search..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="hidden overflow-hidden rounded-xl bg-white shadow lg:block">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="sticky top-0 z-10 bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Employee ID</th>

              <th className="px-4 py-3 text-left">Name</th>

              <th className="px-4 py-3 text-left">Email</th>

              <th className="px-4 py-3 text-center">Kitchen</th>

              <th className="px-4 py-3 text-center">Role</th>

              <th className="px-4 py-3 text-center">Status</th>

              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  Loading...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user._id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{user.employeeId}</td>

                  <td className="px-4 py-3">{user.name}</td>

                  <td className="px-4 py-3">{user.email}</td>

                  <td className="px-4 py-3 text-center">
                    {user.role === "admin" ? "" : user.kitchen}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {renderRole(user)}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${getStatus(user).className}`}
                    >
                      {getStatus(user).text}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
                      >
                        <FaEdit />
                      </button>

                      <button
                        disabled={userActionId !== null}
                        onClick={() => handleDelete(user._id)}
                        className="rounded bg-red-500 p-2 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FaTrash />
                      </button>
                      <button
                        disabled={userActionId !== null}
                        onClick={() => handleResetPassword(user._id)}
                        className="rounded bg-blue-500 p-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FaKey />
                      </button>
                      <button
                        onClick={() => handleResign(user)}
                        disabled={
                          user.status === "inactive" || !!user.inactiveFrom
                        }
                        className="rounded bg-gray-700 p-2 text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FaUserSlash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 lg:hidden">
        {loading ? (
          <div className="rounded-xl bg-white p-6 text-center shadow">
            Loading...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow">
            Không có dữ liệu
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user._id} className="rounded-2xl bg-white p-5 shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{user.name}</h2>

                  <p className="text-sm text-gray-500">{user.employeeId}</p>
                </div>

                {renderRole(user)}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>

                  <span className="text-right">{user.email}</span>
                </div>

                {user.role !== "admin" && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bếp</span>
                    <span>{user.kitchen}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Trạng thái</span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatus(user).className}`}
                  >
                    {getStatus(user).text}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleEdit(user)}
                  className="rounded-lg bg-blue-500 py-2 text-white"
                >
                  <FaEdit className="mx-auto" />
                </button>

                <button
                  disabled={userActionId !== null}
                  onClick={() => handleDelete(user._id)}
                  className="rounded-lg bg-red-500 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaTrash className="mx-auto" />
                </button>

                <button
                  disabled={userActionId !== null}
                  onClick={() => handleResetPassword(user._id)}
                  className="rounded-lg bg-blue-500 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaKey className="mx-auto" />
                </button>
                <button
                  onClick={() => handleResign(user)}
                  disabled={user.status === "inactive" || !!user.inactiveFrom}
                  className="rounded bg-gray-700 p-2 text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FaUserSlash />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <UserModal
        open={openModal}
        editingUser={editingUser}
        saving={saving}
        onClose={() => {
          setOpenModal(false);

          setEditingUser(null);
        }}
        onSave={handleSave}
      />
      <ResignUserModal
        open={openResignModal}
        user={selectedUser}
        onClose={() => {
          setOpenResignModal(false);

          setSelectedUser(null);
        }}
        onSuccess={() => {
          loadUsers();
        }}
      />
    </div>
  );
}

export default UserManagement;
