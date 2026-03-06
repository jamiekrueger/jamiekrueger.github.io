/** Convert arbitrary text to a URL-friendly slug (e.g. "My Deck Name!" → "my-deck-name"). */
export function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Font sizer: steps down from startSize until the `fits` callback returns
 * true or minSize is reached. Used to auto-shrink card text so it stays
 * within its bounding box.
 */
export function shrinkFontToFit(startSize, minSize, step, fits) {
    let size = startSize;
    while (size > minSize && !fits(size)) size -= step;
    return size;
}

/**
 * Truncate text with "..." so it fits within maxWidth (in the current canvas font).
 * Requires a CanvasRenderingContext2D with the desired font already set.
 */
export function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}

/** Promise-based delay — used for rate-limiting API calls. */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Show a temporary "growl" notification that auto-dismisses via CSS animation.
 * `type` maps to a BEM modifier class (e.g. "success", "error") for styling.
 */
export function showStatus(container, msg, type) {
    const growl = document.createElement('div');
    growl.className = 'growl growl--' + type;
    growl.textContent = msg;
    container.appendChild(growl);
    growl.addEventListener('animationend', (e) => {
        if (e.animationName === 'growl-out') growl.remove();
    });
}
