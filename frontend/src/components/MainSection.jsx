import { Plus } from "lucide-react";
import DishCard from "./DishCard";

function MainSection({
    mains,
    onSelect,
    onAdd,
}) {

    return (

        <section className="space-y-5">

            {/* Header */}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                    <h2 className="text-xl font-bold text-slate-800 sm:text-2xl lg:text-[26px]">

                        Món cơm

                    </h2>

                </div>

                <div className="self-start rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600">

                    {mains.length}/5 món

                </div>

            </div>

            {/* Cards */}

            <div
                className="
                    grid
                    grid-cols-2
                    gap-4
                    sm:grid-cols-3
                    lg:grid-cols-5
                    lg:gap-8
                    justify-items-center
                    items-start
                "
            >

                {

                    mains.map((dish, index) => (

                        <DishCard

                            key={index}

                            dish={dish}

                            onClick={() => onSelect(index)}

                        />

                    ))

                }

                {

                    mains.length < 5 && (

                        <button

                            type="button"

                            onClick={onAdd}

                            className="
                                group
                                flex
                                h-[170px]
                                w-full
                                max-w-[150px]
                                flex-col
                                items-center
                                justify-center
                                rounded-2xl
                                border-2
                                border-dashed
                                border-blue-300
                                bg-blue-50
                                transition-all
                                duration-300
                                hover:-translate-y-1
                                hover:border-blue-500
                                hover:bg-blue-100
                                hover:shadow-lg
                                sm:h-[185px]
                                lg:h-[197px]
                            "

                        >

                            <div
                                className="
                                    flex
                                    h-14
                                    w-14
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-white
                                    shadow
                                    transition
                                    group-hover:scale-110
                                    sm:h-16
                                    sm:w-16
                                "
                            >

                                <Plus

                                    size={28}

                                    className="text-blue-500"

                                />

                            </div>

                            <p className="mt-4 text-base font-bold text-blue-600 sm:text-lg">

                                Thêm món

                            </p>

                        </button>

                    )

                }

            </div>

        </section>

    );

}

export default MainSection;