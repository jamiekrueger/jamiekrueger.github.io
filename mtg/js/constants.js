export const TYPE_PRIORITY = [
    'Creature', 'Planeswalker', 'Battle', 'Instant',
    'Sorcery', 'Enchantment', 'Artifact', 'Land'
];

export const FONT_HEADING = '"Barlow Semi Condensed", sans-serif';
export const FONT_BODY = '"Open Sans", sans-serif';
export const CARD_W = 745;
export const CARD_H = 1040;
export const BORDER = 32;

/* Packing list layout — base sizes are multiplied by scale factor S */
export const PACK = {
    CONTENT_PAD: 28,        // horizontal inset from card border
    TITLE_SIZE: 34,         // title font size (px)
    TITLE_BASELINE: 52,     // title Y from top border
    TITLE_RULE_GAP: 16,     // gap below title to horizontal rule
    FIRST_GROUP_GAP: 36,    // gap below rule to first group heading
    FOOTER_MARGIN: 40,      // reserved bottom space
    CELL_PAD: 14,           // horizontal padding inside each row
    NAME_SYM_GAP: 6,        // gap between card name and mana symbols
    BASE_ROW_H: 30,
    BASE_BODY_SIZE: 22,
    BASE_HEADING_SIZE: 28,
    BASE_HEADING_GAP: 10,   // heading text to underline
    BASE_UNDERLINE_GAP: 22, // underline to first card row
    BASE_GROUP_GAP: 12,     // space after last row before next group
    BASE_ROW_PAD: 8,        // vertical padding at top of each row
    BASE_SYM_PAD: 3,        // horizontal gap between mana symbols
    BASE_SYM_SIZE: 18,      // mana symbol size
    COLOR_TITLE: '#222222',
    COLOR_RULE: '#333333',
    COLOR_HEADING: '#e83411',
    COLOR_TEXT: '#43484f',
    COLOR_ROW_EVEN: '#ecf1f6',
    COLOR_ROW_ODD: '#ffffff',
};

/* Theme card overlay layout */
export const THEME = {
    ZONE_RATIO: 2 / 13,     // name bar & gradient each take 2/13 of inner height
    NAME_PAD: 60,            // horizontal padding for name text
    MIN_NAME_SIZE: 16,       // min font size when shrinking to fit
    NAME_SHRINK_STEP: 2,     // font size decrement per iteration
    SHADOW_OFFSET: 2,        // text shadow offset (px)
    SYM_SIZE: 40,            // mana symbol size
    SYM_GAP: 8,              // gap between mana symbols
    SYM_TOP_RATIO: 0.15,     // symbol Y position within gradient (0–1)
};

/* Sheet Queue (PDF generation) */
export const SHEET = {
    CARD_W_MM: 63,
    CARD_H_MM: 88,
    COLS: 3,
    ROWS: 3,
    CARDS_PER_PAGE: 9,
    PAPER: {
        letter: { w: 215.9, h: 279.4, label: 'Letter' },
        a4:     { w: 210,   h: 297,   label: 'A4' }
    }
};
