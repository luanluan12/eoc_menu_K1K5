module.exports = (user, resetLink) => {
  const isEn = user.language === "en";

  return `
        <!DOCTYPE html>

        <html>
        <head>
            <meta charset="utf-8">
        </head>

        <body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:30px;">

            <div style="
                max-width:650px;
                margin:auto;
                background:#fff;
                padding:40px;
                border-radius:12px;
            ">

                <h2 style="color:#16a34a;">
                    ${isEn ? "🔐 Reset your password" : "🔐 Đặt lại mật khẩu"}
                </h2>

                <p>
                    ${isEn ? "Hello" : "Xin chào"}
                    <strong>${user.name}</strong>,
                </p>

                <p>
                    ${
                      isEn
                        ? "You requested a password reset."
                        : "Bạn đã yêu cầu đặt lại mật khẩu."
                    }
                </p>

                <p>
                    ${
                      isEn
                        ? "Click the button below to set a new password."
                        : "Nhấn nút bên dưới để đặt lại mật khẩu."
                    }
                </p>

                <p>
                    <a
                        href="${resetLink}"
                        style="
                            display:inline-block;
                            padding:12px 24px;
                            background:#16a34a;
                            color:#fff;
                            text-decoration:none;
                            border-radius:6px;
                            font-weight:bold;
                        "
                    >
                        ${isEn ? "Reset password" : "Đặt lại mật khẩu"}
                    </a>
                </p>

                <p>
                    ${
                      isEn
                        ? "If the button does not work, use the link below."
                        : "Nếu nút không hoạt động, hãy mở liên kết sau:"
                    }
                </p>

                <p>${resetLink}</p>

                <p>
                    <b>
                        ${
                          isEn
                            ? "This link will expire in 15 minutes."
                            : "Liên kết này sẽ hết hạn sau 15 phút."
                        }
                    </b>
                </p>

                <p>
                    ${
                      isEn
                        ? "If you did not request a password reset, you can ignore this email."
                        : "Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này."
                    }
                </p>

            </div>

        </body>
        </html>
    `;
};
