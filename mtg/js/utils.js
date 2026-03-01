export function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function shrinkFontToFit(startSize, minSize, step, fits) {
    let size = startSize;
    while (size > minSize && !fits(size)) size -= step;
    return size;
}

export function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function showStatus(container, msg, type) {
    const growl = document.createElement('div');
    growl.className = 'growl growl--' + type;
    growl.textContent = msg;
    container.appendChild(growl);
    growl.addEventListener('animationend', (e) => {
        if (e.animationName === 'growl-out') growl.remove();
    });
}

export function clearStatus() {
    // No-op — growls self-dismiss
}
