const RATE_URL = "https://api.frankfurter.app/latest?from=JPY&to=USD";
const FALLBACK_RATE = 0.0067;
const STORAGE_KEY = "jpyUsdRate";
let jpyUsdRate = FALLBACK_RATE;
let scanTimer;

async function loadRate() {
  const saved = await browser.storage.local.get([STORAGE_KEY]);
  if (typeof saved[STORAGE_KEY] === "number") jpyUsdRate = saved[STORAGE_KEY];
  try {
    const rate = Number(await browser.runtime.sendMessage({ type: "refresh-rate" }));
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Tasa inválida");
    jpyUsdRate = rate;
  } catch (error) {
    console.warn("Yen to USD: se usa la última tasa disponible", error);
  }
  scanPage();
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  const rate = Number(changes[STORAGE_KEY].newValue);
  if (!Number.isFinite(rate) || rate <= 0) return;
  jpyUsdRate = rate;
  scanPage();
  scanMercariTilePrices();
});

function convertTextNode(node) {
  if (!node.nodeValue || !node.parentElement) return;
  if (node.parentElement.closest(".yen-usd-converted, .yen-usd-original, script, style, noscript, textarea, input")) return;
  if (!/[¥￥]\s*[\d,.]+/.test(node.nodeValue)) return;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  const pattern = /([¥￥])\s*([\d,]+(?:\.\d+)?)/g;
  let match;
  while ((match = pattern.exec(node.nodeValue)) !== null) {
    fragment.append(document.createTextNode(node.nodeValue.slice(lastIndex, match.index)));
    const yen = Number(match[2].replace(/,/g, ""));
    const original = document.createElement("span");
    original.className = "yen-usd-original";
    original.textContent = match[0];
    const converted = document.createElement("span");
    converted.className = "yen-usd-converted";
    converted.textContent = ` (USD $${(yen * jpyUsdRate).toFixed(2)})`;
    fragment.append(original, converted);
    lastIndex = pattern.lastIndex;
  }
  fragment.append(document.createTextNode(node.nodeValue.slice(lastIndex)));
  node.parentNode.replaceChild(fragment, node);
}

function scanRoot(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  nodes.forEach(convertTextNode);
  root.querySelectorAll?.("*").forEach((element) => {
    if (element.shadowRoot) scanRoot(element.shadowRoot);
  });
}

function scanPage() {
  if (document.body) scanRoot(document.body);
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanPage, 150);
}

new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
loadRate();
setInterval(scanPage, 1200);

// Algunas páginas dibujan el precio de la tarjeta mediante CSS ::before/::after.
function scanGeneratedPrices() {
  document.querySelectorAll("*").forEach((element) => {
    if (element.dataset.yenUsdPseudoChecked === "1") return;
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(element, pseudo).content || "";
      const match = content.match(/[¥￥]\s*([\d,]+(?:\.\d+)?)/);
      if (!match) continue;
      const yen = Number(match[1].replace(/,/g, ""));
      const converted = document.createElement("span");
      converted.className = "yen-usd-pseudo-converted";
      converted.textContent = ` (USD $${(yen * jpyUsdRate).toFixed(2)})`;
      element.appendChild(converted);
      element.dataset.yenUsdPseudoChecked = "1";
      break;
    }
  });
}

setInterval(scanGeneratedPrices, 1200);
setTimeout(scanGeneratedPrices, 500);

// Mercari separa el símbolo ¥ y el importe en dos spans dentro de este elemento.
function scanMercariTilePrices() {
  document.querySelectorAll('[data-testid="item-tile-price"]').forEach((element) => {
    const match = element.textContent.match(/[\u00A5\uFFE5]\s*([\d,]+(?:\.\d+)?)/);
    if (!match) return;
    const yen = Number(match[1].replace(/,/g, ""));
    let converted = element.querySelector(".yen-usd-tile-converted");
    if (!converted) {
      converted = document.createElement("span");
      converted.className = "yen-usd-tile-converted";
      element.appendChild(converted);
    }
    converted.textContent = ` (USD $${(yen * jpyUsdRate).toFixed(2)})`;
  });
}

setInterval(scanMercariTilePrices, 500);
setTimeout(scanMercariTilePrices, 250);

// Detector universal: yen japonés escrito con símbolo, texto, código o kanji.
function extractYenAmount(text) {
  const patterns = [
    /[\u00A5\uFFE5]\s*([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*(?:円|yen|jpy)/i,
    /(?:yen|jpy)\s*([\d,]+(?:\.\d+)?)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ""));
  }
  return null;
}

// Detector de texto universal, con protección contra una conversión ya mostrada.
function convertTextNode(node) {
  if (!node.nodeValue || !node.parentElement) return;
  const parent = node.parentElement;
  if (parent.closest(".yen-usd-converted, .yen-usd-original, .yen-usd-pseudo-converted, .yen-usd-tile-converted, script, style, noscript, textarea, input")) return;
  if (/\b(?:US\$|USD)\s*\$?\s*[\d,.]+/i.test(parent.textContent)) return;
  const yen = extractYenAmount(node.nodeValue);
  if (!Number.isFinite(yen)) return;
  const original = document.createElement("span");
  original.className = "yen-usd-original";
  original.textContent = node.nodeValue;
  const converted = document.createElement("span");
  converted.className = "yen-usd-converted";
  converted.textContent = ` (USD $${(yen * jpyUsdRate).toFixed(2)})`;
  const fragment = document.createDocumentFragment();
  fragment.append(original, converted);
  node.parentNode.replaceChild(fragment, node);
}
