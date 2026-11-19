import { useEffect, useState } from "react";

function UserModal({ open, onClose, onSave, editingUser, saving = false }) {
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    email: "",
    kitchen: "K1",
    role: "guest",
    language: "vi",
    password: "",
  });

  useEffect(() => {
    if (editingUser) {
      setForm({
        employeeId: editingUser.employeeId || "",
        name: editingUser.name || "",
        email: editingUser.email || "",
        kitchen: editingUser.role === "admin" ? "K1, K5" : (editingUser.kitchen?.toString() || "K1"),
        role: editingUser.role || "guest",
        language: editingUser.language || "vi",
        password: "",
      });
    } else {
      setForm({
        employeeId: "",
        name: "",
        email: "",
        kitchen: "K1",
        role: "guest",
        language: "vi",
        password: "",
      });
    }
  }, [editingUser, open]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
      ...(e.target.name === "role"
        ? {
            kitchen:
              e.target.value === "admin"
                ? "K1, K5"
                : form.kitchen === "K1" || form.kitchen === "K5"
                  ? form.kitchen
                  : "K1",
          }
        : {}),
    });
  };

  const handleSubmit = () => {
    if (saving) return;
    if (!form.employeeId.trim()) {
      return alert("Nhập Employee ID");
    }

    if (!form.name.trim()) {
      return alert("Nhập tên");
    }

    if (!form.email.trim()) {
      return alert("Nhập Email");
    }

    if (!editingUser && !form.password.trim()) {
      return alert("Nhập mật khẩu");
    }

    onSave(form);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[650px] rounded-xl bg-white p-8 shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold">
          {editingUser ? "Sửa User" : "Thêm User"}
        </h2>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block mb-2">Employee ID</label>

            <input
              name="employeeId"
              value={form.employeeId}
              onChange={handleChange}
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div>
            <label className="block mb-2">Tên</label>

            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div>
            <label className="block mb-2">Email</label>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-lg border p-3"
            />
          </div>

          {form.role !== "admin" && (
            <div>
              <label className="mb-2 block">Bếp</label>
              <select
                name="kitchen"
                value={form.kitchen}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              >
                <option value="K1">K1</option>
                <option value="K5">K5</option>
              </select>
            </div>
          )}

          <div>
            <label className="block mb-2">Role</label>

            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-lg border p-3"
            >
              <option value="admin">admin</option>
              <option value="admin_kitchen">admin_kitchen</option>
              <option value="guest">guest</option>
            </select>
          </div>

          <div>
            <label className="block mb-2">Language</label>

            <select
              name="language"
              value={form.language}
              onChange={handleChange}
              className="w-full rounded-lg border p-3"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>

          {!editingUser && (
            <div>
              <label className="block mb-2">Password</label>

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg bg-gray-300 px-6 py-3"
          >
            Hủy
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserModal;
