import { useState } from "react";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";

import MainSection from "./MainSection";
import SingleDishSection from "./SingleDishSection";
import AddDishModal from "./AddDishModal";

const MEAL_GROUPS = [
  ["rice", "Món cơm"],
  ["vegetarian", "Món chay"],
  ["noodles", "Món nước"],
  ["soup", "Món soup"],
];

function FlexibleMealsEditor({ day, onChange }) {
  const meals = day.meals || { lunch: {}, dinner: {} };
  const update = (period, category, index, value) => {
    const next = { ...meals, [period]: { ...(meals[period] || {}) } };
    const list = [...(next[period][category] || [])];
    list[index] = typeof list[index] === "string" ? { name: value } : { ...list[index], ...value };
    next[period][category] = list;
    onChange({ ...day, meals: next });
  };
  const add = (period, category) => {
    const next = { ...meals, [period]: { ...(meals[period] || {}) } };
    next[period][category] = [...(next[period][category] || []), { name: "" }];
    onChange({ ...day, meals: next });
  };
  const remove = (period, category, index) => {
    const next = { ...meals, [period]: { ...(meals[period] || {}) } };
    next[period][category] = (next[period][category] || []).filter((_, i) => i !== index);
    onChange({ ...day, meals: next });
  };
  return <div className="space-y-6">
    {[["lunch", "Buổi trưa"], ["dinner", "Buổi chiều"]].map(([period, label]) => <section key={period} className="rounded-2xl border p-4 sm:p-6">
      <h2 className="mb-5 text-xl font-bold text-slate-800">{label} <span className={`text-sm font-semibold ${period === "lunch" ? "text-red-600" : "text-slate-500"}`}>{period === "lunch" ? "(bắt buộc · cần tên và ảnh)" : "(không bắt buộc)"}</span></h2>
      <div className="grid gap-5 md:grid-cols-2">
        {MEAL_GROUPS.map(([category, title]) => <div key={category} className="rounded-xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{title}</h3><button type="button" onClick={() => add(period, category)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">+ Thêm món</button></div>
          {(meals[period]?.[category] || []).map((dish, index) => <div className="relative mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 pr-11" key={dish._id || index}>
            {(dish.preview || (typeof dish.image === "string" && dish.image)) ? (
              <img src={dish.preview || dish.image} alt={dish.name || "Ảnh món"} className="h-14 w-14 shrink-0 rounded-lg object-cover"/>
            ) : (
              <label title="Thêm ảnh" className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100"><ImagePlus size={20}/><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => update(period, category, index, { image: file, preview: reader.result }); reader.readAsDataURL(file); }}/></label>
            )}
            <div className="min-w-0 flex-1">
              <input value={typeof dish === "string" ? dish : dish.name || ""} onChange={(e) => update(period, category, index, { name: e.target.value })} placeholder="Tên món" className="w-full border-0 bg-transparent px-0 py-1 text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0"/>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {(dish.image || dish.preview) &&
                <label title="Sửa ảnh" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-blue-300 bg-white text-blue-700 hover:bg-blue-50"><Pencil size={17}/><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => update(period, category, index, { image: file, preview: reader.result }); reader.readAsDataURL(file); }}/></label>
              }
              <button type="button" title="Xóa món" onClick={() => remove(period, category, index)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"><Trash2 size={17}/></button>
            </div>
          </div>)}
          {!meals[period]?.[category]?.length && <p className="text-sm text-slate-500">Chưa thêm món</p>}
        </div>)}
      </div>
    </section>)}
  </div>;
}

function DayMenuEditor({

    day,

    onChange

}) {

    const [open, setOpen] = useState(false);

    const [mode, setMode] = useState("");

    const [editingIndex, setEditingIndex] = useState(null);

    if (!day) return null;

    // ===========================
    // OPEN MODAL
    // ===========================

    const openMainAdd = () => {

        setMode("main-add");

        setEditingIndex(null);

        setOpen(true);

    };

    const openMainEdit = (index) => {

        setMode("main-edit");

        setEditingIndex(index);

        setOpen(true);

    };

    const openDrink = () => {

        setMode("drink");

        setOpen(true);

    };

    const openSoup = () => {

        setMode("soup");

        setOpen(true);

    };

    // ===========================
    // SAVE
    // ===========================

    const saveDish = (dish) => {

        let clone = {

            ...day

        };

        switch (mode) {

            case "main-add":

                clone.mains = [

                    ...clone.mains,

                    dish

                ];

                break;

            case "main-edit":

                clone.mains =

                    clone.mains.map(

                        (

                            item,

                            index

                        ) =>

                            index === editingIndex

                                ? dish

                                : item

                    );

                break;

            case "drink":

                clone.drink = dish;

                break;

            case "soup":

                clone.soup = dish;

                break;

            default:

                break;

        }

        onChange(clone);

    };

    // ===========================
    // REMOVE
    // ===========================

    const removeDish = () => {

        let clone = {

            ...day

        };

        switch (mode) {

            case "main-edit":

                clone.mains =

                    clone.mains.filter(

                        (

                            _,

                            index

                        ) =>

                            index !== editingIndex

                    );

                break;

            case "drink":

                clone.drink = {

                    name: "",

                    image: null

                };

                break;

            case "soup":

                clone.soup = {

                    name: "",

                    image: null

                };

                break;

            default:

                break;

        }

        onChange(clone);

    };

    // ===========================
    // CURRENT DISH
    // ===========================

    let currentDish = null;

    switch (mode) {

        case "main-edit":

            currentDish =

                day.mains[editingIndex];

            break;

        case "drink":

            currentDish =

                day.drink;

            break;

        case "soup":

            currentDish =

                day.soup;

            break;

        default:

            currentDish = null;

    }

    return (

        <div className="space-y-6 lg:space-y-12">

            {day.meals ? <FlexibleMealsEditor day={day} onChange={onChange} /> : <>
            {/* MAIN */}

            <MainSection

                mains={day.mains}

                onAdd={openMainAdd}

                onSelect={openMainEdit}

            />

            {/* DRINK */}

            <SingleDishSection

                title="Món nước"

                dish={day.drink}

                onAdd={openDrink}

                onSelect={openDrink}

            />
            {/* SOUP */}

            <SingleDishSection

                title="Món súp"

                dish={day.soup}

                onAdd={openSoup}

                onSelect={openSoup}

            />
            </>}

            {/* MODAL */}

            <AddDishModal

                open={open}

                dish={currentDish}

                mode={mode}

                removable={

                    mode !== "main-add"

                }

                title={

                    mode === "main-add"

                        ? "Thêm món"

                        : "Chỉnh sửa món"

                }

                onClose={() =>

                    setOpen(false)

                }

                onSave={saveDish}

                onRemove={removeDish}

            />

        </div>

    );

}

export default DayMenuEditor;
