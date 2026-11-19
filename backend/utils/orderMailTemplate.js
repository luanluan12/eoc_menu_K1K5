const orderMailTemplate = (user, menu, inviteLink, language = "vi") => {
  const isEn = language === "en";

  return `

<!DOCTYPE html>
<html>

<head>
<meta charset="utf-8">
</head>

<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:30px;">

<div style="max-width:600px;margin:auto;background:#fff;padding:40px;border-radius:10px;">

<h2 style="color:#2563eb;">
${isEn ? "Weekly menu is now available" : "Thông báo mở đặt món"}
</h2>

<p>
${isEn ? "Hello" : "Xin chào"} <strong>${user.name}</strong>,
</p>

<p>
${
  isEn
    ? `The menu for <strong>${menu.week}</strong> is now open for orders.`
    : `Thực đơn <strong>${menu.week}</strong> đã được mở để đặt món.`
}
</p>

<p>
${
  isEn
    ? "Click the button below to view this week's menu and choose your meals."
    : "Vui lòng nhấn nút bên dưới để xem thực đơn và lựa chọn món ăn của bạn."
}
</p>

<div style="margin:40px 0;text-align:center;">

<a
href="${inviteLink}"
style="
display:inline-block;
padding:15px 40px;
background:#2563eb;
color:#fff;
text-decoration:none;
border-radius:8px;
font-size:18px;
font-weight:bold;
"
>

${isEn ? "VIEW MENU" : "XEM THỰC ĐƠN"}

</a>

</div>

<p>
⏰
${isEn ? "Order deadline:" : "Hạn đặt món:"}
<strong>${new Date(menu.deadline).toLocaleString(isEn ? "en-US" : "vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
})}</strong>
</p>

<p>
${
  isEn
    ? "Orders will close automatically after the deadline."
    : "Sau thời gian trên hệ thống sẽ tự động khóa việc đặt món."
}
</p>

<hr>

<p style="font-size:12px;color:#888;">

${
  isEn
    ? "This email was sent automatically by the Food Ordering System.<br>Please do not reply."
    : "Email được gửi tự động từ hệ thống Food Ordering.<br>Vui lòng không trả lời email này."
}

</p>

</div>

</body>

</html>

`;
};

module.exports = orderMailTemplate;
