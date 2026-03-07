/**
 * App entry point — wires together the UI for the Jumpstart card builder.
 *
 * User workflow:
 *   1. (Optional) Paste a decklist → parsed, looked up on Scryfall, rendered
 *      as a packing-list card. Colour identity is auto-detected.
 *   2. (Optional) Upload artwork → positioned in the cropper, rendered as a
 *      theme card with name bar, gradient, and mana symbols.
 *   3. Add cards to the print sheet (single, or front/back pair) → export PDF.
 *
 * Each feature area is a section below, roughly in UI order.
 */
import { slugify, shrinkFontToFit, showStatus as _showStatus } from './utils.js';
import { parseDecklist, fetchCardTypes, groupByType } from './decklist.js';
import ImageCropper from './cropper.js';
import { renderPackingList } from './packing-renderer.js';
import { renderThemeCard } from './theme-renderer.js';
import { initSheet } from './sheet.js';

/* ===== DOM Refs ===== */
const themeInput = document.getElementById('theme-name');
const decklistEl = document.getElementById('decklist');
const generateBtn = document.getElementById('generate-btn');
const growlContainer = document.getElementById('growl-container');
const colorToggles = document.querySelectorAll('.color-toggle');

// Packing list
const packingCanvas = document.getElementById('packing-canvas');
const packingEdit = document.getElementById('packing-edit');
const packingView = document.getElementById('packing-view');
const packingEditBtn = document.getElementById('packing-edit-btn');
const packingDownload = document.getElementById('packing-download');
const packingShowTitleCheck = document.getElementById('packing-show-title');

// Theme card
const themeCanvas = document.getElementById('theme-canvas');
const themeDownload = document.getElementById('theme-download');
const themePanel = document.getElementById('theme-panel');
const themeOverlay = document.getElementById('theme-overlay');
const themeOverlayName = document.getElementById('theme-overlay-name');
const themeOverlayColors = document.getElementById('theme-overlay-colors');
const themeGradientCheck = document.getElementById('theme-gradient');

// Sheet buttons
const packingSheetBtn = document.getElementById('packing-sheet-btn');
const themeSheetBtn = document.getElementById('theme-sheet-btn');
const pairSheetBtn = document.getElementById('pair-sheet-btn');

/* ===== Bound Status Functions ===== */
// Bind the growl container so callers only need (msg, type)
const showStatus = (msg, type) => _showStatus(growlContainer, msg, type);

/* ===== Helpers ===== */
function getThemeName(fallback = '') {
    return themeInput.value.trim() || fallback;
}

/* ===== Packing Edit / View Toggle ===== */
// Toggles between the decklist textarea (edit) and the rendered card (view).
// lastPackingGroups caches the most recent grouped card data so the card
// can be re-rendered when the theme name or "show title" option changes.
let lastPackingGroups = null;

function showPackingView() {
    packingEdit.classList.add('hidden');
    packingView.classList.remove('hidden');
    updatePairButtonVisibility();
}

function showPackingEdit() {
    packingView.classList.add('hidden');
    packingEdit.classList.remove('hidden');
    updatePairButtonVisibility();
}

packingEditBtn.addEventListener('click', showPackingEdit);

/* ===== Theme Name Input ===== */
/**
 * Sync the live-preview overlay on the cropper with the current theme name.
 * Uses visibility (not display:none) when empty so the overlay's name bar
 * still occupies layout space and the gradient stays positioned correctly.
 */
function updateThemeOverlay() {
    const text = themeInput.value.trim();
    themeOverlayName.textContent = text;

    if (!text) {
        // Use visibility (not .hidden) to preserve the name bar's layout
        // space within the overlay — collapsing it would misposition the gradient.
        themeOverlayName.style.visibility = 'hidden';
        themeOverlay.classList.add('no-name');
    } else {
        themeOverlayName.style.visibility = '';
        themeOverlay.classList.remove('no-name');
        // Size font to half the bar height, shrink if text overflows
        const barH = themeOverlayName.offsetHeight;
        shrinkFontToFit(Math.floor(barH / 2), 8, 1, s => {
            themeOverlayName.style.fontSize = s + 'px';
            return themeOverlayName.scrollWidth <= themeOverlayName.offsetWidth;
        });
    }
}

/** Re-render the visible packing card and update its download link. */
async function refreshPackingIfVisible() {
    if (!lastPackingGroups || packingView.classList.contains('hidden')) return;
    try {
        packingDownload.href = await snapshotPackingCard();
        const name = getThemeName();
        packingDownload.download = slugify(name ? name + '-packing-list' : 'packing-list') + '.png';
    } catch (err) {
        showStatus('Failed to update packing list.', 'error');
    }
}

// Re-render the packing list live as the user types, since the theme name
// appears as the card title. Only fires when a packing list is visible.
themeInput.addEventListener('input', () => {
    updateThemeOverlay();
    refreshPackingIfVisible();
});

packingShowTitleCheck.addEventListener('change', refreshPackingIfVisible);

/* ===== Gradient Toggle ===== */
themeGradientCheck.addEventListener('change', () => {
    themeOverlay.classList.toggle('no-gradient', !themeGradientCheck.checked);
});

/* ===== Color Identity State ===== */
// Tracks which WUBRG colours are active. Auto-populated from Scryfall results
// but can be manually toggled by the user via the colour buttons.
const selectedColors = new Set();

colorToggles.forEach(btn => {
    btn.addEventListener('click', () => {
        const c = btn.dataset.color;
        if (selectedColors.has(c)) {
            selectedColors.delete(c);
            btn.classList.remove('active');
        } else {
            selectedColors.add(c);
            btn.classList.add('active');
        }
        updateColorOverlay();
    });
});

/** Programmatically set the colour identity (e.g. from Scryfall results). */
function setColorIdentity(colors) {
    selectedColors.clear();
    colorToggles.forEach(btn => btn.classList.remove('active'));
    for (const c of colors) {
        selectedColors.add(c);
        const btn = document.querySelector('.color-toggle[data-color="' + c + '"]');
        if (btn) btn.classList.add('active');
    }
    updateColorOverlay();
}

/** Rebuild the mana symbol icons in the theme card's live-preview overlay. */
function updateColorOverlay() {
    themeOverlayColors.replaceChildren();
    const colors = ['W', 'U', 'B', 'R', 'G'].filter(c => selectedColors.has(c));
    for (const c of colors) {
        const img = document.createElement('img');
        img.src = '/mtg/symbols/' + c + '.svg';
        img.alt = c;
        themeOverlayColors.appendChild(img);
    }
}

/* ===== Image Cropper ===== */
const cropper = new ImageCropper({
    viewport: document.getElementById('crop-viewport'),
    img: document.getElementById('crop-img'),
    uploadZone: document.getElementById('upload-zone'),
    fileInput: document.getElementById('file-input'),
    cropArea: document.getElementById('crop-area'),
    zoomSlider: document.getElementById('zoom-slider'),
    changeImageBtn: document.getElementById('change-image-btn'),
    onLoad() {
        themePanel.classList.remove('hidden');
        themeOverlay.classList.remove('hidden');
        themeOverlay.classList.toggle('no-gradient', !themeGradientCheck.checked);
        document.getElementById('change-image-btn').classList.remove('hidden');
        updateThemeOverlay();
        updatePairButtonVisibility();
        // Show mobile gesture hint
        const hint = document.getElementById('gesture-hint');
        hint.classList.remove('hidden');
        // Re-trigger animation on subsequent image loads
        hint.style.animation = 'none';
        hint.offsetHeight; // force reflow
        hint.style.animation = '';
    },
    onError() {
        showStatus('Failed to load image.', 'error');
    }
});

themeDownload.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        themeDownload.href = await snapshotThemeCard();
        const name = getThemeName();
        themeDownload.download = slugify(name ? name + '-theme-card' : 'theme-card') + '.png';
        // Re-render then trigger download via a temporary <a> — the visible
        // download link's href is stale until clicked, so we render fresh here.
        const a = document.createElement('a');
        a.href = themeDownload.href;
        a.download = themeDownload.download;
        a.click();
    } catch (err) {
        showStatus('Failed to render theme card.', 'error');
    }
});

/* ===== Sheet Panel ===== */
const sheet = initSheet({
    slotsEl: document.getElementById('sheet-slots'),
    countEl: document.getElementById('sheet-count'),
    paperSel: document.getElementById('sheet-paper'),
    doubleCheck: document.getElementById('sheet-double'),
    cropCheck: document.getElementById('sheet-cropmarks'),
    backOffsetInput: document.getElementById('sheet-back-offset'),
    offsetRow: document.getElementById('sheet-offset-row'),
    downloadBtn: document.getElementById('sheet-download'),
    clearBtn: document.getElementById('sheet-clear'),
    testBtn: document.getElementById('sheet-test-btn'),
    panelEl: document.getElementById('sheet-panel'),
    toggleEl: document.getElementById('sheet-toggle'),
    closeEl: document.getElementById('sheet-close'),
    onStatus: showStatus
});

/* ===== Snapshots for Sheet ===== */
// Snapshot functions re-render a card to the offscreen canvas and return
// a data URL. Used when adding cards to the print sheet or downloading.

async function snapshotPackingCard() {
    await renderPackingList(lastPackingGroups, getThemeName('Packing List'), packingCanvas, { showTitle: packingShowTitleCheck.checked });
    return packingCanvas.toDataURL('image/png');
}

async function snapshotThemeCard() {
    await renderThemeCard(themeCanvas, cropper, selectedColors, getThemeName(), { showGradient: themeGradientCheck.checked });
    return themeCanvas.toDataURL('image/png');
}

// Add to sheet: packing list only
packingSheetBtn.addEventListener('click', async () => {
    try {
        const url = await snapshotPackingCard();
        sheet.addToSheet({ dataUrl: url, label: getThemeName('Packing List') + ' (pack)' }, null);
    } catch (err) {
        showStatus('Failed to add packing list to sheet.', 'error');
    }
});

// Add to sheet: theme card only
themeSheetBtn.addEventListener('click', async () => {
    try {
        const url = await snapshotThemeCard();
        sheet.addToSheet({ dataUrl: url, label: getThemeName('Theme Card') + ' (theme)' }, null);
    } catch (err) {
        showStatus('Failed to add theme card to sheet.', 'error');
    }
});

// Add pair to sheet: theme card front, packing list back
pairSheetBtn.addEventListener('click', async () => {
    try {
        const frontUrl = await snapshotThemeCard();
        const backUrl = await snapshotPackingCard();
        const name = getThemeName('Card');
        sheet.addToSheet(
            { dataUrl: frontUrl, label: name + ' (theme)' },
            { dataUrl: backUrl, label: name + ' (pack)' }
        );
    } catch (err) {
        showStatus('Failed to add cards to sheet.', 'error');
    }
});

/* ===== Pair Button Visibility ===== */
// The "Add pair" button only makes sense when both a packing list AND a theme
// card are available. Show/hide it whenever either state changes.
function updatePairButtonVisibility() {
    const hasPackingList = !packingView.classList.contains('hidden') && lastPackingGroups;
    const hasThemeCard = cropper.loaded;
    pairSheetBtn.classList.toggle('hidden', !(hasPackingList && hasThemeCard));
}

/* ===== Generate (main flow) ===== */
generateBtn.addEventListener('click', run);

/**
 * Parse the decklist, look up card data on Scryfall, render the packing list,
 * and auto-set the colour identity from the results.
 * Returns { error: true } on failure, or { overflow: boolean } on success.
 */
async function generatePackingList(themeName) {
    const cards = parseDecklist(decklistEl.value.trim());
    if (cards.length === 0) {
        showStatus('No valid card lines found. Use format: "1x Card Name" or "1 Card Name".', 'error');
        return { error: true };
    }

    const { found, notFound, colorIdentity } = await fetchCardTypes(cards);

    if (found.length === 0) {
        showStatus('None of the cards were found on Scryfall. Check spelling and try again.', 'error');
        return { error: true };
    }

    if (colorIdentity.size > 0) setColorIdentity(colorIdentity);

    if (notFound.length > 0) {
        showStatus(
            'Warning: ' + notFound.length + ' card(s) not found: ' +
            notFound.join(', ') + '. They will appear under "Unknown".',
            'warning'
        );
    }

    const groups = groupByType(found, notFound, cards);
    lastPackingGroups = groups;

    const overflow = await renderPackingList(groups, themeName || 'Packing List', packingCanvas, { showTitle: packingShowTitleCheck.checked });

    showPackingView();
    packingDownload.href = packingCanvas.toDataURL('image/png');
    packingDownload.download = slugify(themeName ? themeName + '-packing-list' : 'packing-list') + '.png';

    return { overflow };
}

/** Render the theme card from the current cropper state + selected colours. */
async function generateThemeCard(themeName) {
    await renderThemeCard(themeCanvas, cropper, selectedColors, themeName, { showGradient: themeGradientCheck.checked });

    themeDownload.href = themeCanvas.toDataURL('image/png');
    themeDownload.download = slugify(themeName ? themeName + '-theme-card' : 'theme-card') + '.png';
}

/**
 * Main generate handler — runs whichever outputs are available:
 *   - decklist present → packing list card
 *   - image loaded    → theme card
 *   - both            → both cards, plus the "add pair" button becomes visible
 */
async function run() {
    generateBtn.disabled = true;

    try {
        const hasDecklist = decklistEl.value.trim().length > 0;
        const hasImage = cropper.loaded;

        if (!hasDecklist && !hasImage) {
            showStatus('Enter a decklist, upload an image, or both.', 'error');
            return;
        }

        const themeName = getThemeName();
        let overflow = false;

        if (hasDecklist) {
            const result = await generatePackingList(themeName);
            if (result.error) return;
            overflow = result.overflow;
        }

        if (hasImage) {
            await generateThemeCard(themeName);
        }

        if (overflow) {
            showStatus('List too long for card — some entries were cut off.', 'warning');
        }
    } catch (err) {
        showStatus('Error: ' + (err.message || 'Something went wrong.'), 'error');
    } finally {
        generateBtn.disabled = false;
    }
}
