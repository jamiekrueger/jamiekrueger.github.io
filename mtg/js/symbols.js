/**
 * Mana symbol loader — fetches and caches SVG mana icons (e.g. {W}, {2}, {U})
 * used when rendering mana costs on card type-line displays.
 * Symbols are loaded from /mtg/symbols/<key>.svg as Image objects.
 */

/** Cache of symbol key → Promise<Image|null>, so each SVG is fetched at most once. */
const symbolCache = new Map();

/** Load a single mana symbol SVG by key (e.g. "W", "2", "B/P"). Returns a cached Promise<Image|null>. */
export function loadSymbol(key) {
    if (symbolCache.has(key)) return symbolCache.get(key);
    const promise = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // gracefully skip missing symbols
        img.src = '/mtg/symbols/' + encodeURIComponent(key) + '.svg';
    });
    symbolCache.set(key, promise);
    return promise;
}

/**
 * Extract symbol keys from Scryfall's mana cost string.
 * e.g. "{2}{W}{U}" → ["2", "W", "U"]
 */
export function parseManaCost(manaCost) {
    if (!manaCost) return [];
    return Array.from(manaCost.matchAll(/\{([^}]+)\}/g), m => m[1]);
}

/** Load an array of symbol keys in parallel and return a Map of key → Image|null. */
export async function resolveSymbols(keys) {
    const images = await Promise.all(keys.map(s => loadSymbol(s)));
    return new Map(keys.map((k, i) => [k, images[i]]));
}

/**
 * Scan all card groups for unique mana symbols and preload them.
 * Call this once after fetching card data so symbols are ready
 * before the UI needs to render mana costs.
 */
export async function preloadSymbols(groups) {
    const allSymbols = new Set();
    for (const [, cards] of groups) {
        for (const card of cards) {
            for (const sym of parseManaCost(card.manaCost)) {
                allSymbols.add(sym);
            }
        }
    }
    return resolveSymbols([...allSymbols]);
}
