import { Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";

import bepImage from "../assets/anh-optimized.png";

function OrderNotice({ flexible = false }) {

    const { t } = useTranslation();

    return (

        <div
            className="
                mt-6
                flex
                flex-col
                gap-5
                rounded-3xl
                bg-gradient-to-r
                from-orange-50
                via-orange-50
                to-orange-50
                p-5
                shadow-sm

                sm:p-6
                lg:mt-8
                lg:flex-row
                lg:items-center
                lg:justify-between
                lg:px-10
                lg:py-7
            "
        >

            {/* Left */}

            <div className="flex items-start gap-4 sm:items-center sm:gap-6">

                <div
                    className="
                        flex
                        h-12
                        w-12
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        bg-orange-500
                        text-white
                        shadow-lg

                        sm:h-16
                        sm:w-16
                    "
                >

                    <Lightbulb size={24} className="sm:hidden" />

                    <Lightbulb size={32} className="hidden sm:block" />

                </div>

                <div>

                    <p className="text-base font-semibold leading-7 text-slate-800 sm:text-lg">

                        {flexible ? t("notice_automatic") : <>

                        {t("notice_prefix")}

                        <span className="text-orange-600">

                            {" "}
                            {t("notice_main")}

                        </span>

                        {" "}

                        {t("notice_or")}

                        <span className="text-orange-600">

                            {" "}
                            {t("notice_side")}

                        </span>

                        </>}

                    </p>

                    {flexible && <p className="mt-2 text-sm text-slate-500 sm:text-[15px]">{t("notice_automatic_detail")}</p>}

                </div>

            </div>

            {/* Right */}

            <div className="flex justify-center lg:justify-end">

                <img

                    src={bepImage}

                    alt="Kitchen"

                    loading="lazy"

                    decoding="async"

                    className="
                        h-20
                        w-auto
                        object-contain

                        sm:h-24
                    "

                />

            </div>

        </div>

    );

}

export default OrderNotice;
