import { CARD_W, CARD_H, BORDER, THEME, FONT_HEADING } from './constants.js';
import { shrinkFontToFit } from './utils.js';
import { resolveSymbols } from './symbols.js';

export async function renderThemeCard(canvas, cropperInstance, selectedColors, themeName) {
    const ctx = canvas.getContext('2d');
    await document.fonts.ready;

    const colors = ['W', 'U', 'B', 'R', 'G'].filter(c => selectedColors.has(c));
    const symbolMap = await resolveSymbols(colors);

    const { srcX, srcY, srcW, srcH } = cropperInstance.getCropRect();

    ctx.clearRect(0, 0, CARD_W, CARD_H);
    ctx.drawImage(cropperInstance.img, srcX, srcY, srcW, srcH, 0, 0, CARD_W, CARD_H);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CARD_W, BORDER);
    ctx.fillRect(0, CARD_H - BORDER, CARD_W, BORDER);
    ctx.fillRect(0, 0, BORDER, CARD_H);
    ctx.fillRect(CARD_W - BORDER, 0, BORDER, CARD_H);

    // --- Name bar + gradient layout (matches official theme cards) ---
    const innerH = CARD_H - BORDER * 2;
    const barH = Math.round(innerH * THEME.ZONE_RATIO);
    const gradH = barH; // both zones are 2/13
    const gradBottom = CARD_H - BORDER;
    const gradTop = gradBottom - gradH;
    const barTop = gradTop - barH;

    // Dark semi-transparent bar for theme name (only if name provided)
    const hasName = themeName && themeName.trim();
    if (hasName) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(BORDER, barTop, CARD_W - BORDER * 2, barH);
    }

    // Gradient zone below the bar — fade from transparent when no name
    // bar above, otherwise match the bar's opacity for a smooth transition.
    const grad = ctx.createLinearGradient(0, gradTop, 0, gradBottom);
    grad.addColorStop(0, hasName ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(BORDER, gradTop, CARD_W - BORDER * 2, gradH);

    if (hasName) {
        // Theme name text centered in the bar (default = half bar height, shrink if needed)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const barCenterY = barTop + barH / 2;
        const maxTextW = CARD_W - BORDER * 2 - THEME.NAME_PAD;

        shrinkFontToFit(Math.round(barH / 2), THEME.MIN_NAME_SIZE, THEME.NAME_SHRINK_STEP, s => {
            ctx.font = 'bold ' + s + 'px ' + FONT_HEADING;
            return ctx.measureText(themeName.toUpperCase()).width <= maxTextW;
        });

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillText(themeName.toUpperCase(), CARD_W / 2 + THEME.SHADOW_OFFSET, barCenterY + THEME.SHADOW_OFFSET);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(themeName.toUpperCase(), CARD_W / 2, barCenterY);
    }

    // Mana symbols centered in the gradient zone
    if (colors.length > 0) {
        const totalSymW = colors.length * THEME.SYM_SIZE + (colors.length - 1) * THEME.SYM_GAP;
        let symX = (CARD_W - totalSymW) / 2;
        const symY = gradTop + Math.round(gradH * THEME.SYM_TOP_RATIO);

        for (const c of colors) {
            const img = symbolMap.get(c);
            if (img) {
                ctx.drawImage(img, symX, symY, THEME.SYM_SIZE, THEME.SYM_SIZE);
            }
            symX += THEME.SYM_SIZE + THEME.SYM_GAP;
        }
    }
}
