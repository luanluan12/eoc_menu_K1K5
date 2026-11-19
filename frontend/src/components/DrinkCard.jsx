import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

function DrinkCard({
    food,
    checked,
    disabled,
    onSelect,
}) {

    const { t, i18n } = useTranslation();

    const displayName =
        i18n.language === "en"
            ? (food.nameEn || food.name)
            : food.name;
        const displaySubtitle =
        i18n.language === "en"
            ? (food.subtitleEn || food.subtitle)
            : food.subtitle;

    return (

        <div
            className={`
                relative
                flex
                flex-col
                gap-4
                rounded-3xl
                border-2
                bg-white
                p-4
                transition-all
                duration-300

                sm:flex-row
                sm:items-center
                sm:gap-6

                ${
                    checked
                        ? "border-blue-500 shadow-lg"
                        : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                }

                ${
                    disabled
                        ? "opacity-50"
                        : ""
                }
            `}
        >

            {/* Check */}

            {

                checked && (

                    <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow sm:h-10 sm:w-10">

                        <Check
                            size={18}
                            className="text-white"
                        />

                    </div>

                )

            }

            {/* Image */}

            <img

                src={
    food.image
        ? food.image
        : "https://placehold.co/300"
}

                alt={displayName}

                loading="lazy"

                decoding="async"

                className="
                    h-44
                    w-full
                    rounded-2xl
                    object-cover

                    sm:h-36
                    sm:w-36

                    lg:h-40
                    lg:w-40
                "

            />

            {/* Content */}

            <div className="flex flex-1 flex-col justify-center">

                <h3 className="text-lg font-semibold text-slate-800 sm:text-xl">

                    {displayName}

                </h3>

                {displaySubtitle && (

                    <p className="mt-2 text-sm text-gray-500">

                        {displaySubtitle}

                    </p>

                )}

                <button

                    type="button"

                    disabled={disabled}

                    onClick={() => onSelect(food)}

                    className={`
                        mt-5
                        w-full
                        rounded-full
                        px-6
                        py-3
                        text-sm
                        font-semibold
                        transition-all

                        sm:mt-6
                        sm:w-fit
                        sm:text-[15px]

                        ${
                            checked
                                ? "bg-blue-100 text-blue-600"
                                : "bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                        }

                        ${
                            disabled
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                        }
                    `}
                >

                    {

                        checked

                            ? `✓ ${t("selected")}`

                            : t("select_dish")

                    }

                </button>

            </div>

        </div>

    );

}

export default DrinkCard;
