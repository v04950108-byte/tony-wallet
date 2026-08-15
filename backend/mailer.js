const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM =
  process.env.SMTP_FROM || `TONY Wallet <${SMTP_USER}>`;

if (!SMTP_USER) {
  console.warn("SMTP_USER is not configured.");
}

if (!SMTP_PASS) {
  console.warn("SMTP_PASS is not configured.");
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,

  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000
});

async function verifyMailer() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "SMTP_USER or SMTP_PASS is missing in .env"
    );
  }

  await transporter.verify();

  return true;
}

async function sendVerificationCode(email, code) {
  if (!email) {
    throw new Error("Recipient email is missing.");
  }

  if (!/^\d{6}$/.test(String(code))) {
    throw new Error(
      "Verification code must contain exactly 6 digits."
    );
  }

  const result = await transporter.sendMail({
    from: SMTP_FROM,
    to: email,

    subject: "TONY Wallet — код подтверждения",

    text:
      `Ваш код подтверждения: ${code}\n\n` +
      `Код действителен 10 минут.\n\n` +
      `Если вы не запрашивали этот код, просто проигнорируйте письмо.`,

    html: `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TONY Wallet</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f6f8;
  font-family:Arial,Helvetica,sans-serif;
">

  <div style="
    max-width:520px;
    margin:40px auto;
    background:#ffffff;
    border-radius:16px;
    padding:32px;
  ">

    <h1 style="
      margin:0 0 20px;
      font-size:28px;
    ">
      TONY Wallet
    </h1>

    <p style="
      font-size:16px;
      line-height:1.5;
    ">
      Ваш код подтверждения:
    </p>

    <div style="
      margin:25px 0;
      padding:20px;
      text-align:center;
      background:#f1f3f5;
      border-radius:12px;
      font-size:34px;
      font-weight:bold;
      letter-spacing:8px;
    ">
      ${code}
    </div>

    <p style="
      color:#666666;
      font-size:14px;
      line-height:1.5;
    ">
      Код действителен 10 минут.
    </p>

    <p style="
      color:#666666;
      font-size:14px;
      line-height:1.5;
    ">
      Если вы не запрашивали этот код,
      проигнорируйте это письмо.
    </p>

  </div>

</body>
</html>
`
  });

  console.log(
    `Verification email sent to ${email}. Message ID: ${result.messageId}`
  );

  return result;
}

module.exports = {
  sendVerificationCode,
  verifyMailer
};
