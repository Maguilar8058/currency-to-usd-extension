const RATE_URL = "https://api.frankfurter.app/latest?from=JPY&to=USD";
const FALLBACK_RATE = 0.0067;
const STORAGE_KEY = "jpyUsdRate";
let jpyUsdRate = FALLBACK_RATE;
let scanTimer;

async function loadRate() {
  const saved = await browser.storage.local.get([STORAGE_KEY]);
  if (typeof saved[STORAGE_KEY] === "number") jpyUsdRate = saved[STORAGE_KEY];
  try {
    const response = await fetch(RATE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rate = Number(data.rates && data.rates.USD);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Tasa inválida");
    jpyUsdRate = rate;
    await browser.storage.local.set({ [STORAGE_KEY]: rate, jpyUsdRateAt: new Date().toISOString() });
  } catch (error) {
    console.warn("Yen to USD: se usa la última tasa disponible", error);
  }
  scanPage();
}

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
    converted.textContent = ` USD(${(yen * jpyUsdRate).toFixed(2)})`;
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
