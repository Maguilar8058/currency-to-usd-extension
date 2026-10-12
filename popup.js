const extensionAPI = globalThis.browser || globalThis.chrome;
async function showStatus() {
  const data = await extensionAPI.storage.local.get(["usdRates", "ratesAt"]);
  const rates = data.usdRates || {};
  const codes = Object.keys(rates).sort();
  const date = data.ratesAt ? new Date(data.ratesAt).toLocaleString() : "not available yet";
  document.querySelector("#status").textContent = `${codes.length} supported currencies. Last update: ${date}`;
  const list = document.querySelector("#currencies");
  codes.forEach((code) => {
    const item = document.createElement("span");
    item.className = "currency";
    item.textContent = code;
    list.appendChild(item);
  });
}

showStatus();

