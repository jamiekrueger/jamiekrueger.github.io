import { CARD_W, CARD_H, BORDER, PACK, FONT_HEADING, FONT_BODY } from './constants.js';
import { truncateText } from './utils.js';
import { parseManaCost, preloadSymbols } from './symbols.js';

// Find the largest scale multiplier (0–10 → 1.0×–2.0×) that fits all content on the card.
export function bestSizeOffset(groups, { showTitle = true } = {}) {
    const FOOTER_ZONE = CARD_H - BORDER - PACK.FOOTER_MARGIN;
    const FIXED_Y = showTitle
        ? BORDER + PACK.TITLE_BASELINE + PACK.TITLE_RULE_GAP
        : BORDER + PACK.CONTENT_PAD;
    let totalCards = 0;
    let totalGroups = 0;
    for (const [, cards] of groups) {
        totalCards += cards.length;
        totalGroups++;
    }
    for (let off = 10; off >= 0; off--) {
        const s = 1 + off * 0.1;
        const rowH = Math.round(PACK.BASE_ROW_H * s);
        const firstGap = Math.round(PACK.FIRST_GROUP_GAP * s);
        const groupOverhead = Math.round(PACK.BASE_HEADING_GAP * s)
            + Math.round(PACK.BASE_UNDERLINE_GAP * s)
            + Math.round(PACK.BASE_GROUP_GAP * s);
        const y = FIXED_Y + firstGap + totalGroups * groupOverhead + totalCards * rowH;
        if (y <= FOOTER_ZONE) return off;
    }
    return 0;
}

export async function renderPackingList(groups, title, canvas, { showTitle = true } = {}) {
    const ctx = canvas.getContext('2d');

    await document.fonts.ready;
    const symbolMap = await preloadSymbols(groups);

    const sizeOffset = bestSizeOffset(groups, { showTitle });
    const S = 1 + sizeOffset * 0.1;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const innerW = CARD_W - BORDER * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(BORDER, BORDER, innerW, CARD_H - BORDER * 2);

    const MARGIN_X = BORDER + PACK.CONTENT_PAD;
    const MAX_X = CARD_W - BORDER - PACK.CONTENT_PAD;
    const ROW_H = Math.round(PACK.BASE_ROW_H * S);
    const BODY_SIZE = Math.round(PACK.BASE_BODY_SIZE * S);
    const HEADING_SIZE = Math.round(PACK.BASE_HEADING_SIZE * S);
    const SYM_SIZE = Math.round(PACK.BASE_SYM_SIZE * S);
    const HEADING_GAP = Math.round(PACK.BASE_HEADING_GAP * S);
    const UNDERLINE_GAP = Math.round(PACK.BASE_UNDERLINE_GAP * S);
    const GROUP_GAP = Math.round(PACK.BASE_GROUP_GAP * S);
    const ROW_PAD = Math.round(PACK.BASE_ROW_PAD * S);
    const SYM_PAD = Math.round(PACK.BASE_SYM_PAD * S);
    let overflow = false;
    const FOOTER_ZONE = CARD_H - BORDER - PACK.FOOTER_MARGIN;
    let rowIndex = 0;
    let y;

    if (showTitle) {
        y = BORDER + PACK.TITLE_BASELINE;

        ctx.fillStyle = PACK.COLOR_TITLE;
        ctx.font = 'bold ' + PACK.TITLE_SIZE + 'px ' + FONT_HEADING;
        ctx.textAlign = 'center';
        const truncTitle = truncateText(ctx, title.toUpperCase(), innerW - PACK.CONTENT_PAD * 2);
        ctx.fillText(truncTitle, CARD_W / 2, y);
        y += PACK.TITLE_RULE_GAP;

        ctx.strokeStyle = PACK.COLOR_RULE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(MARGIN_X, y);
        ctx.lineTo(MAX_X, y);
        ctx.stroke();
        y += Math.round(PACK.FIRST_GROUP_GAP * S);
    } else {
        y = BORDER + PACK.CONTENT_PAD + Math.round(PACK.FIRST_GROUP_GAP * S);
    }

    ctx.textAlign = 'left';

    for (const [type, cards] of groups) {
        if (y > FOOTER_ZONE) { overflow = true; break; }

        const totalQty = cards.reduce((sum, c) => sum + c.qty, 0);

        ctx.fillStyle = PACK.COLOR_HEADING;
        ctx.font = 'bold ' + HEADING_SIZE + 'px ' + FONT_HEADING;
        const heading = type.toUpperCase() + ' (' + totalQty + ')';
        ctx.fillText(heading, MARGIN_X, y);
        y += HEADING_GAP;

        ctx.strokeStyle = PACK.COLOR_HEADING;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN_X, y);
        ctx.lineTo(MAX_X, y);
        ctx.stroke();
        y += UNDERLINE_GAP;

        rowIndex = 0;
        for (const card of cards) {
            if (y > FOOTER_ZONE) { overflow = true; break; }

            const rowBg = rowIndex % 2 === 0 ? PACK.COLOR_ROW_EVEN : PACK.COLOR_ROW_ODD;
            ctx.fillStyle = rowBg;
            ctx.fillRect(MARGIN_X, y - ROW_H + ROW_PAD, MAX_X - MARGIN_X, ROW_H);
            rowIndex++;

            const symbols = parseManaCost(card.manaCost);
            const symbolsWidth = symbols.length > 0
                ? symbols.length * (SYM_SIZE + SYM_PAD) - SYM_PAD
                : 0;

            const qtyStr = card.qty + ' ';

            ctx.font = 'bold ' + BODY_SIZE + 'px ' + FONT_BODY;
            ctx.fillStyle = PACK.COLOR_TEXT;
            ctx.fillText(qtyStr, MARGIN_X + PACK.CELL_PAD, y);
            const qtyWidth = ctx.measureText(qtyStr).width;

            ctx.font = BODY_SIZE + 'px ' + FONT_BODY;
            ctx.fillStyle = PACK.COLOR_TEXT;
            const nameX = MARGIN_X + PACK.CELL_PAD + qtyWidth;
            const nameMaxWidth = MAX_X - PACK.CELL_PAD - nameX - symbolsWidth - (symbolsWidth > 0 ? PACK.NAME_SYM_GAP : 0);
            const truncName = truncateText(ctx, card.name, nameMaxWidth);
            ctx.fillText(truncName, nameX, y);

            let symX = MAX_X - PACK.CELL_PAD - symbolsWidth;
            for (const sym of symbols) {
                const img = symbolMap.get(sym);
                if (img) {
                    ctx.drawImage(img, symX, y - SYM_SIZE + SYM_PAD, SYM_SIZE, SYM_SIZE);
                }
                symX += SYM_SIZE + SYM_PAD;
            }

            y += ROW_H;
        }

        y += GROUP_GAP;
    }

    return overflow;
}
