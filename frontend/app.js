const authScreen =
  document.getElementById("authScreen");

const walletScreen =
  document.getElementById("walletScreen");

const emailStep =
  document.getElementById("emailStep");

const codeStep =
  document.getElementById("codeStep");

const emailInput =
  document.getElementById("email");

const codeInput =
  document.getElementById("code");

const sendCodeButton =
  document.getElementById("sendCodeButton");

const verifyCodeButton =
  document.getElementById("verifyCodeButton");

const resendButton =
  document.getElementById("resendButton");

const backButton =
  document.getElementById("backButton");

const logoutButton =
  document.getElementById("logoutButton");

const copyAddressButton =
  document.getElementById("copyAddressButton");

const emailPreview =
  document.getElementById("emailPreview");

const walletEmail =
  document.getElementById("walletEmail");

const walletAddress =
  document.getElementById("walletAddress");

const walletNetwork =
  document.getElementById("walletNetwork");

const message =
  document.getElementById("message");

const timer =
  document.getElementById("timer");

let currentEmail = "";
let countdownTimer = null;
let resendAvailableAt = 0;

function showMessage(text) {
  message.textContent = text;
}

function setLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.dataset.oldText = button.textContent;
    button.textContent = "Загрузка...";
  } else {
    button.disabled = false;

    if (button.dataset.oldText) {
      button.textContent = button.dataset.oldText;
    }
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },

    credentials: "include"
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: "Некорректный ответ сервера."
  }));

  if (!response.ok) {
    throw new Error(
      data.message || "Произошла ошибка."
    );
  }

  return data;
}

function showCodeStep() {
  emailStep.classList.add("hidden");
  codeStep.classList.remove("hidden");

  emailPreview.textContent = currentEmail;

  codeInput.focus();
}

function showEmailStep() {
  codeStep.classList.add("hidden");
  emailStep.classList.remove("hidden");

  codeInput.value = "";
  showMessage("");

  clearInterval(countdownTimer);

  timer.textContent = "";
  resendButton.disabled = true;
}

function startResendTimer() {
  resendAvailableAt =
    Date.now() + 60 * 1000;

  resendButton.disabled = true;

  updateTimer();

  clearInterval(countdownTimer);

  countdownTimer =
    setInterval(updateTimer, 1000);
}

function updateTimer() {
  const remaining =
    Math.max(
      0,
      resendAvailableAt - Date.now()
    );

  if (remaining <= 0) {
    clearInterval(countdownTimer);

    timer.textContent = "";
    resendButton.disabled = false;

    return;
  }

  const seconds =
    Math.ceil(remaining / 1000);

  timer.textContent =
    `Повторная отправка через ${seconds} сек.`;
}

async function requestCode() {
  const email =
    emailInput.value.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    showMessage("Введите корректный email.");
    return;
  }

  setLoading(sendCodeButton, true);
  showMessage("");

  try {
    await api(
      "/api/auth/request-code",
      {
        method: "POST",
        body: JSON.stringify({ email })
      }
    );

    currentEmail = email;

    showCodeStep();
    startResendTimer();

    showMessage(
      "Код отправлен на вашу почту."
    );

  } catch (error) {
    showMessage(error.message);

  } finally {
    setLoading(sendCodeButton, false);
  }
}

async function verifyCode() {
  const code =
    codeInput.value.trim();

  if (!/^\d{6}$/.test(code)) {
    showMessage("Введите 6-значный код.");
    return;
  }

  setLoading(verifyCodeButton, true);
  showMessage("");

  try {
    const result =
      await api(
        "/api/auth/verify-code",
        {
          method: "POST",
          body: JSON.stringify({
            email: currentEmail,
            code
          })
        }
      );

    if (result.success && result.user) {
      showWallet(result.user);
    }

  } catch (error) {
    showMessage(error.message);

  } finally {
    setLoading(verifyCodeButton, false);
  }
}

async function resendCode() {
  if (Date.now() < resendAvailableAt) {
    return;
  }

  setLoading(resendButton, true);

  try {
    await api(
      "/api/auth/request-code",
      {
        method: "POST",
        body: JSON.stringify({
          email: currentEmail
        })
      }
    );

    showMessage("Новый код отправлен.");

    startResendTimer();

    codeInput.value = "";
    codeInput.focus();

  } catch (error) {
    showMessage(error.message);

  } finally {
    if (Date.now() < resendAvailableAt) {
      resendButton.disabled = true;
    } else {
      resendButton.disabled = false;
    }
  }
}

function showWallet(user) {
  authScreen.classList.add("hidden");
  walletScreen.classList.remove("hidden");

  walletEmail.textContent =
    user.email || "—";

  const address =
    user.tronAddress ||
    user.tron_address ||
    user.address ||
    "";

  walletAddress.textContent =
    address || "Не создан";

  const network =
    user.network ||
    user.tronNetwork ||
    "TRON";

  walletNetwork.textContent =
    `Сеть: ${network}`;
}

async function loadWallet() {
  try {
    const result =
      await api("/api/wallet");

    if (result.success) {
      const address =
        result.address ||
        result.tronAddress ||
        result.tron_address ||
        "";

      if (address) {
        walletAddress.textContent = address;
      }

      walletNetwork.textContent =
        `Сеть: ${
          result.network ||
          result.tronNetwork ||
          "TRON"
        }`;
    }

  } catch (error) {
    console.error(
      "Wallet loading failed:",
      error
    );
  }
}

async function logout() {
  try {
    await api(
      "/api/auth/logout",
      {
        method: "POST"
      }
    );
  } catch (error) {
    console.error(error);
  }

  walletScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");

  showEmailStep();

  emailInput.value = "";
  currentEmail = "";
}

async function checkSession() {
  try {
    const result =
      await api("/api/auth/me");

    if (
      result.authenticated &&
      result.user
    ) {
      showWallet(result.user);
      await loadWallet();
    }

  } catch (error) {
    console.error(
      "Session check failed:",
      error
    );
  }
}

if (copyAddressButton) {
  copyAddressButton.addEventListener(
    "click",
    async () => {
      const address =
        walletAddress.textContent.trim();

      if (
        !address ||
        address === "—" ||
        address === "Не создан"
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(address);

        copyAddressButton.textContent =
          "Скопировано";

        setTimeout(() => {
          copyAddressButton.textContent =
            "Копировать";
        }, 1500);

      } catch (error) {
        console.error(
          "Copy failed:",
          error
        );
      }
    }
  );
}

sendCodeButton.addEventListener(
  "click",
  requestCode
);

verifyCodeButton.addEventListener(
  "click",
  verifyCode
);

resendButton.addEventListener(
  "click",
  resendCode
);

backButton.addEventListener(
  "click",
  showEmailStep
);

logoutButton.addEventListener(
  "click",
  logout
);

codeInput.addEventListener(
  "input",
  () => {
    codeInput.value =
      codeInput.value
        .replace(/\D/g, "")
        .slice(0, 6);

    if (
      codeInput.value.length === 6
    ) {
      verifyCode();
    }
  }
);

emailInput.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      requestCode();
    }
  }
);

checkSession();
