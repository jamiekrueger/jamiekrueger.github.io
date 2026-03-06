import { TYPE_PRIORITY } from './constants.js';
import { sleep } from './utils.js';

/**
 * Parse a raw decklist string into an array of { name, qty } objects.
 * Handles common export formats (MTGA, Moxfield, Archidekt, etc.)
 * and consolidates duplicate card names.
 */
export function parseDecklist(raw) {
    const lines = raw.split(/\r?\n/);
    // Skip section headers and comments common in exported decklists
    const skipPattern = /^(\/\/|#|deck\b|sideboard\b|commander\b|companion\b|maybeboard\b)/i;
    // Match lines like "4 Lightning Bolt" or "4x Lightning Bolt"
    const linePattern = /^(\d+)x?\s+(.+)$/;
    const consolidated = new Map();

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || skipPattern.test(trimmed)) continue;

        const match = trimmed.match(linePattern);
        let qty, name;

        if (match) {
            qty = parseInt(match[1], 10);
            name = match[2].trim();
        } else {
            qty = 1;
            name = trimmed;
        }

        // Strip trailing set code, collector number, foil markers
        // e.g. "Lightning Bolt (2XM) 117 *F*" → "Lightning Bolt"
        name = name
            .replace(/\s*\*F\*\s*$/i, '')
            .replace(/\s*[\(\[][A-Za-z0-9]+[\)\]]\s*\d*\s*$/, '')
            .trim();

        if (!name) continue;
        // Consolidate duplicate names, preserving the first-seen casing
        const key = name.toLowerCase();
        consolidated.set(key, {
            name: consolidated.has(key) ? consolidated.get(key).name : name,
            qty: (consolidated.get(key)?.qty || 0) + qty
        });
    }

    return Array.from(consolidated.values());
}

/**
 * Look up card metadata (type line, mana cost, colour identity) from Scryfall.
 * Sends requests in batches of 75 (Scryfall's collection endpoint limit)
 * with a 100 ms delay between batches to respect rate limits.
 *
 * Returns { found: [...cards with metadata], notFound: [names], colorIdentity: Set }
 */
export async function fetchCardTypes(cards) {
    const names = [...new Set(cards.map(c => c.name))];
    const BATCH_SIZE = 75; // Scryfall /cards/collection max per request
    const found = new Map();
    const notFound = [];
    const allColorIdentity = new Set();

    for (let i = 0; i < names.length; i += BATCH_SIZE) {
        if (i > 0) await sleep(100); // rate-limit between batches

        const batch = names.slice(i, i + BATCH_SIZE);
        const body = {
            identifiers: batch.map(name => ({ name }))
        };

        const resp = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            throw new Error('Scryfall API returned status ' + resp.status);
        }

        const data = await resp.json();

        if (data.data) {
            for (const card of data.data) {
                found.set(card.name.toLowerCase(), {
                    typeLine: card.type_line,
                    manaCost: card.mana_cost || ''
                });
                if (card.color_identity) {
                    for (const c of card.color_identity) {
                        allColorIdentity.add(c);
                    }
                }
            }
        }

        if (data.not_found) {
            for (const nf of data.not_found) {
                notFound.push(nf.name);
            }
        }
    }

    return {
        found: cards.filter(c => found.has(c.name.toLowerCase())).map(c => {
            const info = found.get(c.name.toLowerCase());
            return { ...c, typeLine: info.typeLine, manaCost: info.manaCost };
        }),
        notFound,
        colorIdentity: allColorIdentity
    };
}

/**
 * Group cards by their primary type (Creature, Instant, etc.) and sort
 * the groups in the canonical order defined by TYPE_PRIORITY.
 * Cards that Scryfall didn't recognise are placed in an "Unknown" group at the end.
 */
export function groupByType(foundCards, notFoundNames, allCards) {
    const groups = new Map();

    for (const card of foundCards) {
        const type = extractPrimaryType(card.typeLine);
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push(card);
    }

    for (const cards of groups.values()) {
        cards.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (notFoundNames.length > 0) {
        const notFoundSet = new Set(notFoundNames.map(nf => nf.toLowerCase()));
        const unknownCards = allCards.filter(c => notFoundSet.has(c.name.toLowerCase()));
        if (unknownCards.length > 0) {
            groups.set('Unknown', unknownCards.map(c => ({ ...c, typeLine: 'Unknown', manaCost: '' })));
        }
    }

    // Build the final array in three tiers:
    // 1. Known types in TYPE_PRIORITY order (Creature, Instant, Sorcery, …)
    // 2. Any types not in the priority list (edge cases)
    // 3. Unknown cards last
    const sorted = [];
    for (const type of TYPE_PRIORITY) {
        if (groups.has(type)) sorted.push([type, groups.get(type)]);
    }
    for (const [type, cards] of groups) {
        if (!TYPE_PRIORITY.includes(type) && type !== 'Unknown') {
            sorted.push([type, cards]);
        }
    }
    if (groups.has('Unknown')) sorted.push(['Unknown', groups.get('Unknown')]);

    return sorted;
}

/**
 * Extract the most relevant card type from a full type line.
 * e.g. "Legendary Artifact Creature — Golem" → "Creature"
 *      "Enchantment // Creature — God" → "Enchantment" (first face only)
 */
export function extractPrimaryType(typeLine) {
    const face = typeLine.split('//')[0].trim();       // first face of double-faced cards
    const mainPart = face.split(/\u2014/)[0].trim();   // supertypes/types before the em-dash
    const words = mainPart.split(/\s+/);

    for (const type of TYPE_PRIORITY) {
        if (words.some(w => w.toLowerCase() === type.toLowerCase())) {
            // "Artifact Creature" should list under Creature, not Artifact
            if (type === 'Artifact' && words.some(w => w.toLowerCase() === 'creature')) {
                continue;
            }
            return type;
        }
    }

    return 'Unknown';
}
