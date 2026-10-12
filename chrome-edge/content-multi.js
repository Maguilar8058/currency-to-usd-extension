const extensionAPI = globalThis.browser || globalThis.chrome;
const FALLBACK_RATES = { USD: 1, JPY: 1 / 0.0067, EUR: 0.89143 };
let usdRates = { ...FALLBACK_RATES };
let scanTimer;

function defaultDollarCurrency() {
  const host = location.hostname.toLowerCase();
  if (host === "ebay.com" || host.endsWith(".ebay.com")) return "USD";
  if (host.endsWith("ebay.ca")) return "CAD";
  if (host.endsWith("ebay.com.au")) return "AUD";
  if (host.endsWith("ebay.com.mx")) return "MXN";
  if (host.endsWith("ebay.com.br")) return "BRL";
  if (host.endsWith("ebay.es") || host.endsWith("ebay.de") || host.endsWith("ebay.fr") || host.endsWith("ebay.it") || host.endsWith("ebay.pt") || host.endsWith("ebay.nl") || host.endsWith("ebay.be") || host.endsWith("ebay.at") || host.endsWith("ebay.ie")) return "EUR";
  if (host.endsWith(".com.uy")) return "UYU";
  if (host.endsWith(".com.ar")) return "ARS";
  if (host.endsWith(".com.br")) return "BRL";
  if (host.endsWith(".com.mx")) return "MXN";
  if (host.endsWith(".cl")) return "CLP";
  if (host.endsWith(".co")) return "COP";
  if (host.endsWith(".pe")) return "PEN";
  if (host.endsWith(".es") || host.endsWith(".de") || host.endsWith(".fr") || host.endsWith(".it") || host.endsWith(".pt") || host.endsWith(".nl") || host.endsWith(".be") || host.endsWith(".at") || host.endsWith(".ie")) return "EUR";
  return "USD";
}

function toUSD(amount, code) {
  return code === "USD" ? amount : amount / usdRates[code];
}

function parseAmount(raw) {
  let value = String(raw).replace(/\s/g, "");
  const dot = value.lastIndexOf(".");
  const comma = value.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    const decimal = Math.max(dot, comma);
    const fractionDigits = value.length - decimal - 1;
    if (fractionDigits <= 2) {
      value = value.slice(0, decimal).replace(/[.,]/g, "") + "." + value.slice(decimal + 1);
    } else {
      value = value.replace(/[.,]/g, "");
    }
  } else if (dot >= 0 || comma >= 0) {
    const separator = dot >= 0 ? dot : comma;
    const fractionDigits = value.length - separator - 1;
    if (fractionDigits === 3) value = value.replace(/[.,]/g, "");
    else if (comma >= 0) value = value.replace(",", ".");
  }
  return Number(value);
}

function parseCurrency(text) {
  const list = [
    [/\b(?:US\$|USD)\s*([\d,.]+)/i, "USD", 1], [/([\d,.]+)\s*(?:US\$|USD)\b/i, "USD", 1],
    [/(?:HK\$|HKD)\s*([\d,.]+)/i, "HKD", 1], [/([\d,.]+)\s*(?:HK\$|HKD)/i, "HKD", 1],
    [/(?:NT\$|TWD)\s*([\d,.]+)/i, "TWD", 1], [/([\d,.]+)\s*(?:NT\$|TWD)/i, "TWD", 1],
    [/(?:C\$|CAD)\s*([\d,.]+)/i, "CAD", 1], [/([\d,.]+)\s*(?:C\$|CAD)/i, "CAD", 1],
    [/(?:A\$|AUD)\s*([\d,.]+)/i, "AUD", 1], [/([\d,.]+)\s*(?:A\$|AUD)/i, "AUD", 1],
    [/R\$\s*([\d,.]+)/i, "BRL", 1], [/([\d,.]+)\s*(?:R\$|BRL)/i, "BRL", 1],
    [/\$U\s*([\d,.]+)/i, "UYU", 1], [/([\d,.]+)\s*(?:\$U|UYU)/i, "UYU", 1],
    [/(?:MX\$|MXN)\s*([\d,.]+)/i, "MXN", 1], [/([\d,.]+)\s*(?:MX\$|MXN)/i, "MXN", 1],
    [/\u20AC\s*([\d,.]+)/i, "EUR", 1], [/([\d,.]+)\s*(?:\u20AC|EUR)/i, "EUR", 1],
    [/\u00A3\s*([\d,.]+)/i, "GBP", 1], [/([\d,.]+)\s*(?:\u00A3|GBP)/i, "GBP", 1],
    [/\u20A9\s*([\d,.]+)/i, "KRW", 1], [/([\d,.]+)\s*(?:\u20A9|KRW|\uC6D0)/i, "KRW", 1],
    [/(?:CNY|RMB)\s*([\d,.]+)/i, "CNY", 1], [/([\d,.]+)\s*(?:CNY|RMB|\u5143)/i, "CNY", 1],
    [/CHF\s*([\d,.]+)/i, "CHF", 1], [/([\d,.]+)\s*CHF\b/i, "CHF", 1],
    [/[\u00A5\uFFE5]\s*([\d,.]+)/i, "JPY", 1], [/([\d,.]+)\s*(?:[\u00A5\uFFE5]|Yen|JPY)/i, "JPY", 1],
    [/\$\s*([\d,.]+)/i, defaultDollarCurrency(), 1]
  ];
  for (const [regex, code, group] of list) {
    const match = text.match(regex);
    if (match && usdRates[code]) return { amount: parseAmount(match[group]), code };
  }
  return null;
}

function scanText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  nodes.forEach((textNode) => {
    const parent = textNode.parentElement;
    if (!parent || parent.closest(".yen-usd-original, .yen-usd-converted, .yen-usd-tile-converted, .a-price, [class*='a-price'], script, style, noscript, textarea, input")) return;
    if (/\b(?:US\$|USD)\s*\$?\s*[\d,.]+/i.test(parent.textContent) && !/\b(?:US\$|USD)\b/i.test(textNode.nodeValue)) return;
    const parsed = parseCurrency(textNode.nodeValue);
    if (!parsed || !Number.isFinite(parsed.amount) || !usdRates[parsed.code]) return;
    const usdAmount = toUSD(parsed.amount, parsed.code);
    if (!Number.isFinite(usdAmount)) return;
    const original = document.createElement("span");
    original.className = "yen-usd-original";
    original.textContent = textNode.nodeValue;
    const converted = document.createElement("span");
    converted.className = "yen-usd-converted";
    converted.textContent = ` (USD $${usdAmount.toFixed(2)})`;
    const fragment = document.createDocumentFragment();
    fragment.append(original, converted);
    textNode.parentNode.replaceChild(fragment, textNode);
  });
  root.querySelectorAll?.("*").forEach((element) => element.shadowRoot && scanText(element.shadowRoot));
}

function scanMercariTiles() {
  document.querySelectorAll('[data-testid="item-tile-price"]').forEach((element) => {
    const match = element.textContent.match(/[Â¥ï¿¥]\s*([\d,]+)/i);
    if (!match || !usdRates.JPY) return;
    let converted = element.querySelector(".yen-usd-tile-converted");
    if (!converted) { converted = document.createElement("span"); converted.className = "yen-usd-tile-converted"; element.appendChild(converted); }
    converted.textContent = ` (USD $${toUSD(parseAmount(match[1]), "JPY").toFixed(2)})`;
  });
}

function scanMercadoLibrePrices() {
  if (!location.hostname.toLowerCase().includes("mercadolibre.")) return;
  document.querySelectorAll(".andes-money-amount, .poly-card__price, [data-testid*='price']").forEach((element) => {
    if (element.querySelector(".yen-usd-converted, .yen-usd-tile-converted")) return;
    const parsed = parseCurrency(element.textContent || "");
    if (!parsed || !Number.isFinite(parsed.amount) || !usdRates[parsed.code]) return;
    const usdAmount = toUSD(parsed.amount, parsed.code);
    if (!Number.isFinite(usdAmount)) return;
    const converted = document.createElement("span");
    converted.className = "yen-usd-converted";
    converted.textContent = ` (USD $${usdAmount.toFixed(2)})`;
    element.appendChild(converted);
  });
}

function scanAmazonPrices() {
  if (!location.hostname.toLowerCase().includes("amazon.")) return;
  const prices = new Set(document.querySelectorAll(".a-price, [class*='a-price']"));
  document.querySelectorAll(".a-price-whole, [class*='a-price-whole']").forEach((wholeNode) => {
    const container = wholeNode.closest(".a-price, [class*='a-price']") || wholeNode.parentElement;
    if (container) prices.add(container);
  });
  prices.forEach((element) => {
    if (element.querySelector(".yen-usd-converted")) return;
    const whole = element.querySelector(".a-price-whole")?.textContent?.trim();
    const fraction = element.querySelector(".a-price-fraction")?.textContent?.trim();
    const symbol = element.querySelector(".a-price-symbol")?.textContent?.trim();
    const source = whole && fraction && symbol
      ? `${whole},${fraction} ${symbol}`
      : element.querySelector(".a-offscreen")?.textContent || element.textContent || "";
    const wholeDigits = whole?.replace(/\D/g, "");
    const fractionDigits = fraction?.replace(/\D/g, "").padEnd(2, "0").slice(0, 2);
    const directEuroAmount = wholeDigits && fractionDigits
      ? Number(`${wholeDigits}.${fractionDigits}`)
      : NaN;
    let parsed = parseCurrency(source);
    if (!parsed || !Number.isFinite(parsed.amount)) {
      parsed = symbol?.includes("€") && Number.isFinite(directEuroAmount)
        ? { amount: directEuroAmount, code: "EUR" }
        : null;
    }
    if (!parsed || !Number.isFinite(parsed.amount) || !usdRates[parsed.code]) return;
    const usdAmount = toUSD(parsed.amount, parsed.code);
    if (!Number.isFinite(usdAmount)) return;
    const converted = document.createElement("span");
    converted.className = "yen-usd-converted";
    converted.textContent = ` (USD $${usdAmount.toFixed(2)})`;
    element.appendChild(converted);
  });
}

function scanPage() { if (document.body) { scanText(document.body); scanMercariTiles(); scanMercadoLibrePrices(); scanAmazonPrices(); } }
async function loadRates() {
  const saved = await extensionAPI.storage.local.get(["usdRates"]);
  if (saved.usdRates) usdRates = { ...FALLBACK_RATES, ...saved.usdRates };
  try { const rates = await extensionAPI.runtime.sendMessage({ type: "refresh-rates" }); if (rates?.USD) usdRates = rates; } catch (error) { console.warn("Se usan tasas guardadas", error); }
  scanPage();
}

extensionAPI.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.usdRates?.newValue) { usdRates = { ...FALLBACK_RATES, ...changes.usdRates.newValue }; scanPage(); }
});
new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(scanPage, 150); }).observe(document.documentElement, { childList: true, subtree: true });
loadRates();
setInterval(scanPage, 1000);


