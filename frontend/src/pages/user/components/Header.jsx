import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronDown,
    Lock,
    ClipboardList,
    LogOut,
    QrCode,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
const logo = "/logo.png";

function Header() {

    const { user, logout } = useAuth();

    const navigate = useNavigate();

    const { i18n, t } = useTranslation();

    const [open, setOpen] = useState(false);

    const ref = useRef(null);

    const changeLanguage = (lang) => {

        i18n.changeLanguage(lang);

        localStorage.setItem("language", lang);

    };

    useEffect(() => {

        const click = (e) => {

            if (

                ref.current &&

                !ref.current.contains(e.target)

            ) {

                setOpen(false);

            }

        };

        window.addEventListener("click", click);

        return () =>

            window.removeEventListener("click", click);

    }, []);

    return (

        <header className="sticky top-0 z-50 border-b border-white/30 bg-white/20 backdrop-blur-xl">

            <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">

                {/* Logo */}

                <div className="flex items-center">

                    <img

                        src={logo}

                        alt="Logo"

                        className="h-10 w-auto object-contain sm:h-12 lg:h-14"

                    />

                </div>

                {/* Right */}

                <div className="flex items-center gap-2 sm:gap-3">

                    {/* Language */}

                    <div className="overflow-hidden rounded-xl border border-orange-100 bg-white/80 shadow-sm backdrop-blur-md">

                        <button
    onClick={() => changeLanguage("vi")}
    className={`px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:py-2 sm:text-sm ${
        i18n.language === "vi"
            ? "bg-orange-500 text-white"
            : "text-gray-700 hover:bg-white/40"
    }`}
>
    VI
</button>

                        <button
    onClick={() => changeLanguage("en")}
    className={`px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:py-2 sm:text-sm ${
        i18n.language === "en"
            ? "bg-orange-500 text-white"
            : "text-gray-700 hover:bg-white/40"
    }`}
>
    EN
</button>

                    </div>

                    {/* User */}

                    <div

                        ref={ref}

                        className="relative"

                    >

                        <button

                            onClick={() => setOpen(!open)}

                            className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-white/80 px-2.5 py-1.5 shadow-sm backdrop-blur-md transition hover:bg-white sm:gap-3 sm:px-3 sm:py-2"

                        >

                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white sm:h-9 sm:w-9">

                                {user?.name?.charAt(0)}

                            </div>

                            <div className="hidden text-left sm:block">

                                <div className="font-semibold">

                                    {user?.name}

                                </div>

                            </div>

                            <ChevronDown size={18} />

                        </button>

                        {

                            open && (

                                <div className="absolute right-0 mt-3 w-[280px] max-w-[90vw] overflow-hidden rounded-2xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-xl">

                                    <div className="border-b p-5">

                                        <div className="font-bold">

                                            {user?.name}

                                        </div>

                                        <div className="break-all text-sm text-gray-500">

                                            {user?.email}

                                        </div>

                                    </div>

                                    <button

                                        onClick={() => {

                                            setOpen(false);

                                            navigate("/change-password");

                                        }}

                                        className="flex w-full items-center gap-3 px-5 py-4 hover:bg-gray-50"

                                    >

                                        <Lock size={18} />

                                        {t("change_password")}

                                    </button>

                                    <button

                                        onClick={() => {

                                            setOpen(false);

                                            navigate("/history");

                                        }}

                                        className="flex w-full items-center gap-3 px-5 py-4 hover:bg-gray-50"

                                    >

                                        <ClipboardList size={18} />

                                        {t("history")}

                                    </button>

                                    <button

    onClick={() => {

        setOpen(false);

        navigate("/checkin");

    }}

    className="flex w-full items-center gap-3 px-5 py-4 hover:bg-gray-50"

>

    <QrCode size={18} />

    {t("check_in")}

</button>

                                    <button

                                        onClick={() => {

                                            setOpen(false);

                                            logout();

                                            navigate("/");

                                        }}

                                        className="flex w-full items-center gap-3 border-t px-5 py-4 text-red-600 hover:bg-red-50"

                                    >

                                        <LogOut size={18} />

                                        {t("logout")}

                                    </button>

                                </div>

                            )

                        }

                    </div>

                </div>

            </div>

            <div className="mx-auto max-w-[1120px] border-b-2 border-orange-500"></div>

        </header>

    );

}

export default Header;
