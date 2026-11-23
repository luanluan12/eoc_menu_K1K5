import { ConciergeBell } from "lucide-react";
import { useTranslation } from "react-i18next";

import bepImage from "../assets/anh-optimized.png";

function OrderNotice({ flexible = false }) {

    const { t } = useTranslation();

    return (

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-100/90 via-orange-50 to-orange-100/70 px-3 py-3 shadow-sm sm:mt-5 sm:gap-5 sm:px-5 sm:py-3">

            {/* Left */}

            <div className="flex min-w-0 items-center gap-3 sm:gap-4">

                <div
                    className="
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        bg-orange-500
                        text-white
                        shadow-lg

                        sm:h-12
                        sm:w-12
                    "
                >

                    <ConciergeBell size={23} />

                </div>

                <div>

                    <p className="text-xs font-semibold leading-5 text-slate-800 sm:text-sm sm:leading-6">

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

                    {flexible && <p className="mt-1 text-[10px] leading-4 text-slate-600 sm:text-xs">{t("notice_automatic_detail")}</p>}

                </div>

            </div>

            {/* Right */}

            <div className="flex shrink-0 justify-end">

                <img

                    src={bepImage}

                    alt="Kitchen"

                    loading="lazy"

                    decoding="async"

                    className="
                        h-14
                        w-auto
                        object-contain
                        sm:h-[68px]
                    "

                />

            </div>

        </div>

    );

}

export default OrderNotice;
