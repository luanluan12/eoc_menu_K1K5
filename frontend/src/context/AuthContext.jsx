import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

const normalizeStoredUser = () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) return null;

    const roleAliases = {
        admin_eocmn: "admin",
        admin_floor: "admin_kitchen",
    };
    const user = {
        ...storedUser,
        role: roleAliases[storedUser.role] || storedUser.role,
        kitchen: String(storedUser.kitchen ?? "K1"),
    };

    localStorage.setItem("user", JSON.stringify(user));
    return user;
};

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(normalizeStoredUser);

    const login = (token, userData) => {

        localStorage.setItem("token", token);

        localStorage.setItem(
            "user",
            JSON.stringify(userData)
        );

        setUser(userData);

    };

    const logout = () => {

        localStorage.removeItem("token");

        localStorage.removeItem("user");

        setUser(null);

    };

    return (

        <AuthContext.Provider
            value={{
                user,
                login,
                logout
            }}
        >

            {children}

        </AuthContext.Provider>

    );

};

export const useAuth = () => useContext(AuthContext);
