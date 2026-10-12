const RATE_URL = "https://api.frankfurter.app/latest?from=JPY&to=USD";
let refreshPromise = null;

async function refreshRate() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(RATE_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(async (data) => {
      const rate = Number(data.rates && data.rates.USD);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("Tasa inválida");
      await browser.storage.local.set({
        jpyUsdRate: rate,
        jpyUsdRateAt: new Date().toISOString()
      });
      return rate;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

browser.runtime.onInstalled.addListener(() => refreshRate());
browser.runtime.onStartup.addListener(() => refreshRate());
browser.runtime.onMessage.addListener((message) => {
  if (message && message.type === "refresh-rate") return refreshRate();
  return undefined;
});
