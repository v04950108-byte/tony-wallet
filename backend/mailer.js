const nodemailer = require("nodemailer");

const smtpPort = Number(
  process.env.SMTP_PORT || 465
);

const smtpSecure =
  String(
    process.env.SMTP_SECURE || "true"
  ).toLowerCase() === "true";

const transporter =
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,

    port: smtpPort,

    secure: smtpSecure,

    auth: {
      user: process.env.SMTP_USER,

      pass: process.env.SMTP_PASSWORD
    }
  });

/*
  Отправка кода подтверждения
*/

async function sendVerificationCode(
  email,
  code
) {
  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD
  ) {
    throw new Error(
      "SMTP credentials are not configured."
    );
  }

  const fromEmail =
    process.env.FROM_EMAIL ||
    process.env.SMTP_USER;

  const fromName =
    process.env.FROM_NAME ||
    "TONY Wallet";

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,

    to: email,

    subject:
      "Код подтверждения — TONY Wallet",

    text:
      `TONY Wallet\n\n` +
      `Ваш код подтверждения: ${code}\n\n` +
      `Код действителен 10 минут.\n\n` +
      `Если вы не запрашивали регистрацию, ` +
      `просто проигнорируйте это письмо.`,

    html: `
<!DOCTYPE html>
<html lang="ru">

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>TONY Wallet</title>
</head>

<body
  style="
    margin:0;
    padding:40px 20px;
    background:#050505;
    color:#ffffff;
    font-family:
      Arial,
      Helvetica,
      sans-serif;
  "
>

  <div
    style="
      max-width:480px;
      margin:0 auto;
      padding:35px;
      background:#101010;
      border:1px solid #222222;
      border-radius:20px;
      text-align:center;
    "
  >

    <div
      style="
        font-size:26px;
        font-weight:800;
        margin-bottom:10px;
      "
    >
      TONY Wallet
    </div>

    <div
      style="
        color:#888888;
        font-size:14px;
        margin-bottom:30px;
      "
    >
      Подтверждение регистрации
    </div>

    <div
      style="
        padding:22px;
        background:#181818;
        border-radius:15px;
        font-size:36px;
        font-weight:700;
        letter-spacing:10px;
      "
    >
      ${code}
    </div>

    <div
      style="
        color:#777777;
        font-size:13px;
        margin-top:20px;
        line-height:1.5;
      "
    >
      Код действителен в течение 10 минут.
    </div>

    <div
      style="
        color:#555555;
        font-size:12px;
        margin-top:25px;
        line-height:1.5;
      "
    >
      Если вы не запрашивали этот код,
      проигнорируйте это письмо.
    </div>

  </div>

</body>

</html>
`
  });
}

/*
  Проверка SMTP-соединения
*/

async function verifyMailer() {
  await transporter.verify();

  console.log(
    "SMTP connection is ready."
  );
}

module.exports = {
  sendVerificationCode,
  verifyMailer
};
