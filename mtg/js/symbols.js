const symbolCache = new Map();

export function loadSymbol(key) {
    if (symbolCache.has(key)) return symbolCache.get(key);
    const promise = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = '/mtg/symbols/' + encodeURIComponent(key) + '.svg';
    });
    symbolCache.set(key, promise);
    return promise;
}

export function parseManaCost(manaCost) {
    if (!manaCost) return [];
    return Array.from(manaCost.matchAll(/\{([^}]+)\}/g), m => m[1]);
}

export async function resolveSymbols(keys) {
    await Promise.all(keys.map(s => loadSymbol(s)));
    const resolved = new Map();
    for (const k of keys) resolved.set(k, await symbolCache.get(k));
    return resolved;
}

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
