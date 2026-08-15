const {
  TronWeb
} = require("tronweb");

const TRON_NETWORK =
  process.env.TRON_NETWORK || "shasta";

const NETWORKS = {
  shasta: {
    name: "TRON Shasta Testnet",
    fullHost: "https://api.shasta.trongrid.io"
  },

  mainnet: {
    name: "TRON Mainnet",
    fullHost: "https://api.trongrid.io"
  }
};

const network =
  NETWORKS[TRON_NETWORK];

if (!network) {
  throw new Error(
    `Unknown TRON_NETWORK: ${TRON_NETWORK}`
  );
};

const tronWeb = new TronWeb({
  fullHost: network.fullHost,

  privateKey:
    process.env.TRON_SERVER_PRIVATE_KEY ||
    undefined
});

/*
 * Проверяем корректность
 * TRON-адреса.
 */
function isValidAddress(address) {
  try {
    return tronWeb.isAddress(address);
  } catch {
    return false;
  }
}

/*
 * Получаем баланс TRX.
 *
 * Результат возвращается
 * в TRX, а не в SUN.
 */
async function getTRXBalance(address) {
  if (!isValidAddress(address)) {
    throw new Error(
      "Invalid TRON address."
    );
  }

  const balance =
    await tronWeb.trx.getBalance(
      address
    );

  return Number(balance) / 1_000_000;
}

/*
 * Получаем баланс USDT TRC20.
 *
 * Адрес контракта берём
 * из переменной окружения.
 */
async function getUSDTBalance(address) {
  if (!isValidAddress(address)) {
    throw new Error(
      "Invalid TRON address."
    );
  }

  const contractAddress =
    process.env.USDT_TRC20_CONTRACT;

  if (!contractAddress) {
    throw new Error(
      "USDT_TRC20_CONTRACT is not configured."
    );
  }

  if (
    !isValidAddress(
      contractAddress
    )
  ) {
    throw new Error(
      "Invalid USDT contract address."
    );
  }

  const contract =
    await tronWeb.contract().at(
      contractAddress
    );

  const balance =
    await contract
      .balanceOf(address)
      .call();

  /*
   * USDT TRC20 обычно имеет
   * 6 знаков после запятой.
   */
  const raw =
    balance.toString();

  return (
    Number(raw) / 1_000_000
  );
}

/*
 * Получаем оба баланса.
 */
async function getBalances(address) {
  const [
    trx,
    usdt
  ] = await Promise.all([
    getTRXBalance(address),
    getUSDTBalance(address)
  ]);

  return {
    trx,
    usdt,
    network: TRON_NETWORK
  };
}

module.exports = {
  tronWeb,
  TRON_NETWORK,
  isValidAddress,
  getTRXBalance,
  getUSDTBalance,
  getBalances
};
