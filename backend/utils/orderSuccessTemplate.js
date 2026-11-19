const moment = require("moment-timezone");

module.exports = (user, order, language = "vi") => {
  const isEn = language === "en";

  const rows = order.days
    .map((day) => {
      const date = moment(day.date)
        .tz("Asia/Ho_Chi_Minh")
        .format("DD/MM/YYYY (dddd)");

      let html = "";

      if (day.mains.length === 0 && !day.drink && !day.soup) {
        html += `
                <div style="color:#999;">
                    ${isEn ? "No meal" : "Không ăn"}
                </div>
            `;
      } else {
        day.mains.forEach((food) => {
          html += `
                    <div>
                        ${food.name}
                        ${food.quantity > 1 ? ` x${food.quantity}` : ""}
                    </div>
                `;
        });

        if (day.drink) {
          html += `
                    <div>
                        ${day.drink.name}
                    </div>
                `;
        }

        if (day.soup) {
          html += `
                    <div>
                        ${day.soup.name}
                    </div>
                `;
        }
      }

      return `
            <div style="
                border:1px solid #eee;
                border-radius:8px;
                padding:14px;
                margin-bottom:14px;
            ">

                <div style="
                    font-weight:bold;
                    color:#ea580c;
                    margin-bottom:8px;
                ">
                    ${date}
                </div>

                ${html}

            </div>
        `;
    })
    .join("");

  return `

<!DOCTYPE html>

<html>

<head>
<meta charset="utf-8">
</head>

<body style="
font-family:Arial,sans-serif;
background:#f5f5f5;
padding:30px;
">

<div style="
max-width:650px;
margin:auto;
background:white;
padding:40px;
border-radius:12px;
">

<h2 style="color:#16a34a;">
${isEn ? "✅ Meal order confirmed" : "✅ Đặt món thành công"}
</h2>

<p>
${isEn ? "Hello" : "Xin chào"}
<strong>${user.name}</strong>,
</p>

<p>
${
  isEn
    ? "Your meal order has been received."
    : "Hệ thống đã ghi nhận đơn đặt món của bạn."
}
</p>

<p>
<b>${isEn ? "Week:" : "Tuần:"}</b> ${order.week}
</p>

<hr>

${rows}

<hr>

<p style="font-size:13px;color:#888">
${
  isEn
    ? "This email was sent automatically by the Food Ordering System."
    : "Email được gửi tự động từ Food Ordering System."
}
</p>

</div>

</body>

</html>

`;
};
