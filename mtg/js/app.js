import { slugify, shrinkFontToFit, showStatus as _showStatus, clearStatus as _clearStatus } from './utils.js';
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

// Sheet buttons
const packingSheetBtn = document.getElementById('packing-sheet-btn');
const themeSheetBtn = document.getElementById('theme-sheet-btn');
const pairSheetBtn = document.getElementById('pair-sheet-btn');

/* ===== Bound Status Functions ===== */
const showStatus = (msg, type) => _showStatus(growlContainer, msg, type);
const clearStatus = () => _clearStatus();

/* ===== Helpers ===== */
function getThemeName(fallback = '') {
    return themeInput.value.trim() || fallback;
}

/* ===== Packing Edit / View Toggle ===== */
let lastPackingGroups = null;

function showPackingView() {
    packingEdit.classList.add('hidden');
    packingView.classList.remove('hidden');
}

function showPackingEdit() {
    packingView.classList.add('hidden');
    packingEdit.classList.remove('hidden');
}

packingEditBtn.addEventListener('click', showPackingEdit);

/* ===== Theme Name Input ===== */
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

themeInput.addEventListener('input', async () => {
    updateThemeOverlay();
    if (!lastPackingGroups) return;
    if (!packingView.classList.contains('hidden')) {
        try {
            packingDownload.href = await snapshotPackingCard();
            const name = getThemeName();
            packingDownload.download = slugify(name ? name + '-packing-list' : 'packing-list') + '.png';
        } catch (err) {
            showStatus('Failed to update packing list.', 'error');
        }
    }
});

packingShowTitleCheck.addEventListener('change', async () => {
    if (!lastPackingGroups) return;
    if (!packingView.classList.contains('hidden')) {
        try {
            packingDownload.href = await snapshotPackingCard();
        } catch (err) {
            showStatus('Failed to update packing list.', 'error');
        }
    }
});

/* ===== Color Identity State ===== */
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
        document.getElementById('change-image-btn').classList.remove('hidden');
        updateThemeOverlay();
        updatePairButtonVisibility();
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
    generateBtn: document.getElementById('sheet-generate'),
    clearBtn: document.getElementById('sheet-clear'),
    testBtn: document.getElementById('sheet-test-btn'),
    panelEl: document.getElementById('sheet-panel'),
    toggleEl: document.getElementById('sheet-toggle'),
    closeEl: document.getElementById('sheet-close'),
    onStatus: showStatus
});

/* ===== Snapshots for Sheet ===== */
async function snapshotPackingCard() {
    await renderPackingList(lastPackingGroups, getThemeName('Packing List'), packingCanvas, { showTitle: packingShowTitleCheck.checked });
    return packingCanvas.toDataURL('image/png');
}

async function snapshotThemeCard() {
    await renderThemeCard(themeCanvas, cropper, selectedColors, getThemeName());
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
function updatePairButtonVisibility() {
    const hasPackingList = !packingView.classList.contains('hidden') && lastPackingGroups;
    const hasThemeCard = cropper.loaded;
    pairSheetBtn.classList.toggle('hidden', !(hasPackingList && hasThemeCard));
}

packingEditBtn.addEventListener('click', updatePairButtonVisibility);
const pairObserver = new MutationObserver(updatePairButtonVisibility);
pairObserver.observe(packingView, { attributes: true, attributeFilter: ['class'] });

/* ===== Generate (main flow) ===== */
generateBtn.addEventListener('click', run);

async function generatePackingList(themeName) {
    const cards = parseDecklist(decklistEl.value.trim());
    if (cards.length === 0) {
        showStatus('No valid card lines found. Use format: "1x Card Name" or "1 Card Name".', 'error');
        return { error: true };
    }

    showStatus('Looking up card types...', 'info');
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

    showStatus('Rendering packing list...', 'info');
    const overflow = await renderPackingList(groups, themeName || 'Packing List', packingCanvas, { showTitle: packingShowTitleCheck.checked });

    showPackingView();
    packingDownload.href = packingCanvas.toDataURL('image/png');
    packingDownload.download = slugify(themeName ? themeName + '-packing-list' : 'packing-list') + '.png';

    return { overflow };
}

async function generateThemeCard(themeName) {
    showStatus('Rendering theme card...', 'info');
    await renderThemeCard(themeCanvas, cropper, selectedColors, themeName);

    themeDownload.href = themeCanvas.toDataURL('image/png');
    themeDownload.download = slugify(themeName ? themeName + '-theme-card' : 'theme-card') + '.png';
}

async function run() {
    clearStatus();
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
        } else {
            clearStatus();
        }
    } catch (err) {
        showStatus('Error: ' + (err.message || 'Something went wrong.'), 'error');
    } finally {
        generateBtn.disabled = false;
    }
}
