const extensionAPI = globalThis.browser || globalThis.chrome;
const CURRENCIES = ["EUR", "GBP", "JPY", "CAD", "AUD", "BRL", "UYU", "CNY", "KRW", "HKD", "TWD", "CHF", "MXN", "ARS", "CLP", "COP", "PEN"];
let refreshPromise;

async function refreshRates() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = Promise.allSettled(CURRENCIES.map(async (code) => {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/usd/${code.toLowerCase()}`);
    if (!response.ok) throw new Error(`${code}: HTTP ${response.status}`);
    const data = await response.json();
    return [code, Number(data.rate)];
  })).then(async (results) => {
    const rates = { USD: 1 };
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const [code, value] = result.value;
        if (Number.isFinite(value) && value > 0) rates[code] = value;
      }
    });
    if (!rates.JPY) throw new Error("No se recibiÃ³ JPY");
    await extensionAPI.storage.local.set({ usdRates: rates, jpyUsdRate: 1 / rates.JPY, ratesAt: new Date().toISOString() });
    return rates;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

extensionAPI.runtime.onInstalled.addListener(refreshRates);
extensionAPI.runtime.onStartup.addListener(refreshRates);
extensionAPI.runtime.onMessage.addListener((message) => message?.type === "refresh-rates" ? refreshRates() : undefined);

