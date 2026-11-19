const jwt = require("jsonwebtoken");

const supportedRoles = new Set(["admin", "admin_kitchen", "guest"]);
const legacyRoleAliases = {
    admin_eocmn: "admin",
    admin_floor: "admin_kitchen",
};

module.exports = (req, res, next) => {

    const token = req.header("Authorization");

    if (!token) {

        return res.status(401).json({
            message: "Unauthorized"
        });

    }

    try {

        const decoded = jwt.verify(
            token.replace("Bearer ", ""),
            process.env.JWT_SECRET
        );

        decoded.role = legacyRoleAliases[decoded.role] || decoded.role;
        if (!supportedRoles.has(decoded.role)) {
            return res.status(403).json({
                message: "Tài khoản không còn được hỗ trợ.",
            });
        }

        req.user = decoded;

        next();

    } catch {

        return res.status(401).json({
            message: "Invalid Token"
        });

    }

};
