const API_URL = 'https://api.scryfall.com/cards/search?q=set%3Ahob&unique=cards&order=name';
const STORAGE_KEY = 'hob-sealed-pool-v1';

const listEl = document.getElementById('card-list');
const statusEl = document.getElementById('catalog-status');
const emptyEl = document.getElementById('empty-state');
const searchEl = document.getElementById('card-search');
const colorFilterEl = document.getElementById('color-filter');
const sortOrderEl = document.getElementById('sort-order');
const selectedOnlyEl = document.getElementById('selected-only');
const outputEl = document.getElementById('pool-output');
const cardTotalEl = document.getElementById('card-total');
const uniqueTotalEl = document.getElementById('unique-total');
const copyButton = document.getElementById('copy-button');
const downloadButton = document.getElementById('download-button');
const clearButton = document.getElementById('clear-button');
const copyStatusEl = document.getElementById('copy-status');
const rowTemplate = document.getElementById('card-row-template');

let cards = [];
const quantities = loadQuantities();
const rowsByName = new Map();

function loadQuantities() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return new Map(Object.entries(saved || {}).filter(([, qty]) => Number.isInteger(qty) && qty > 0));
    } catch {
        return new Map();
    }
}

function saveQuantities() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(quantities)));
}

function cardImage(card) {
    return card.image_uris?.small || card.card_faces?.find(face => face.image_uris)?.image_uris.small || '';
}

function cardColor(card) {
    if (card.type_line.includes('Land')) return 'L';
    const colors = card.color_identity || [];
    if (colors.length > 1) return 'M';
    return colors[0] || 'C';
}

function normalizeCard(card) {
    return {
        name: card.name,
        rarity: card.rarity,
        typeLine: card.type_line,
        manaValue: card.cmc ?? 0,
        collectorNumber: card.collector_number,
        image: cardImage(card),
        color: cardColor(card),
        searchName: card.name.toLocaleLowerCase()
    };
}

async function fetchCards() {
    const fetched = [];
    let nextPage = API_URL;

    while (nextPage) {
        const response = await fetch(nextPage);
        if (!response.ok) throw new Error(`Scryfall returned ${response.status}`);
        const page = await response.json();
        fetched.push(...page.data);
        nextPage = page.has_more ? page.next_page : null;
    }

    // Scryfall's unique=cards normally handles this. Keep the explicit map so
    // alternate treatments can never produce duplicate checklist rows.
    const unique = new Map();
    for (const card of fetched) {
        if (!unique.has(card.name)) unique.set(card.name, normalizeCard(card));
    }
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function quantityFor(name) {
    return quantities.get(name) || 0;
}

function setQuantity(name, nextQuantity) {
    const quantity = Math.max(0, Math.min(99, Number.parseInt(nextQuantity, 10) || 0));
    if (quantity === 0) quantities.delete(name);
    else quantities.set(name, quantity);

    const row = rowsByName.get(name);
    if (row) {
        row.input.value = quantity;
        row.element.classList.toggle('is-selected', quantity > 0);
    }

    saveQuantities();
    updateOutput();
    if (selectedOnlyEl.checked) applyFilters();
}

function renderCards() {
    const fragment = document.createDocumentFragment();
    rowsByName.clear();

    for (const card of cards) {
        const row = rowTemplate.content.firstElementChild.cloneNode(true);
        const identityButton = row.querySelector('.card-identity');
        const image = row.querySelector('.card-image');
        const name = row.querySelector('.card-name');
        const meta = row.querySelector('.card-meta');
        const input = row.querySelector('.quantity-input');
        const decrement = row.querySelector('.decrement');
        const increment = row.querySelector('.increment');

        row.dataset.name = card.searchName;
        row.dataset.color = card.color;
        name.textContent = card.name;
        meta.textContent = `${card.typeLine} · ${card.rarity}`;
        input.value = quantityFor(card.name);
        input.setAttribute('aria-label', `Quantity of ${card.name}`);
        identityButton.setAttribute('aria-label', `Add ${card.name}`);
        decrement.setAttribute('aria-label', `Remove one ${card.name}`);
        increment.setAttribute('aria-label', `Add one ${card.name}`);
        row.classList.toggle('is-selected', quantityFor(card.name) > 0);

        if (card.image) {
            image.src = card.image;
            image.alt = `${card.name} card`;
        } else {
            image.classList.add('hidden');
        }

        identityButton.addEventListener('click', () => setQuantity(card.name, quantityFor(card.name) + 1));
        decrement.addEventListener('click', () => setQuantity(card.name, quantityFor(card.name) - 1));
        increment.addEventListener('click', () => setQuantity(card.name, quantityFor(card.name) + 1));
        input.addEventListener('change', () => setQuantity(card.name, input.value));
        input.addEventListener('focus', () => input.select());

        rowsByName.set(card.name, { element: row, input, card });
        fragment.appendChild(row);
    }

    listEl.replaceChildren(fragment);
    applySort();
    applyFilters();
}

function applySort() {
    const sortedRows = [...rowsByName.values()].sort((a, b) => {
        if (sortOrderEl.value === 'mana-value') {
            const manaDifference = a.card.manaValue - b.card.manaValue;
            if (manaDifference !== 0) return manaDifference;
        }
        return a.card.name.localeCompare(b.card.name);
    });

    const fragment = document.createDocumentFragment();
    for (const { element } of sortedRows) fragment.appendChild(element);
    listEl.appendChild(fragment);
}

function applyFilters() {
    const query = searchEl.value.trim().toLocaleLowerCase();
    const color = colorFilterEl.value;
    let visibleCount = 0;

    for (const { element, card } of rowsByName.values()) {
        const matchesSearch = !query || card.searchName.includes(query);
        const matchesColor = color === 'all' || card.color === color;
        const matchesSelected = !selectedOnlyEl.checked || quantityFor(card.name) > 0;
        const visible = matchesSearch && matchesColor && matchesSelected;
        element.classList.toggle('hidden', !visible);
        if (visible) visibleCount += 1;
    }

    emptyEl.classList.toggle('hidden', visibleCount !== 0);
}

function updateOutput() {
    const selected = cards
        .filter(card => quantityFor(card.name) > 0)
        .map(card => ({ name: card.name, quantity: quantityFor(card.name) }));
    const total = selected.reduce((sum, card) => sum + card.quantity, 0);

    outputEl.value = selected.map(card => `${card.quantity} ${card.name}`).join('\n');
    cardTotalEl.textContent = total;
    uniqueTotalEl.textContent = selected.length;
    copyButton.disabled = selected.length === 0;
    downloadButton.disabled = selected.length === 0;
    clearButton.disabled = selected.length === 0;
}

async function copyList() {
    try {
        await navigator.clipboard.writeText(outputEl.value);
    } catch {
        outputEl.select();
        document.execCommand('copy');
        window.getSelection()?.removeAllRanges();
    }
    copyStatusEl.textContent = 'Copied! Paste this list into Draftsim.';
    window.setTimeout(() => { copyStatusEl.textContent = ''; }, 3000);
}

function downloadList() {
    const blob = new Blob([`${outputEl.value}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hob-sealed-pool.txt';
    link.click();
    URL.revokeObjectURL(url);
}

function clearPool() {
    if (quantities.size === 0 || !window.confirm('Clear every card from this pool?')) return;
    quantities.clear();
    for (const { element, input } of rowsByName.values()) {
        input.value = 0;
        element.classList.remove('is-selected');
    }
    saveQuantities();
    updateOutput();
    applyFilters();
}

searchEl.addEventListener('input', applyFilters);
colorFilterEl.addEventListener('change', applyFilters);
sortOrderEl.addEventListener('change', applySort);
selectedOnlyEl.addEventListener('change', applyFilters);
copyButton.addEventListener('click', copyList);
downloadButton.addEventListener('click', downloadList);
clearButton.addEventListener('click', clearPool);

async function init() {
    try {
        cards = await fetchCards();
        renderCards();
        updateOutput();
        statusEl.textContent = `${cards.length} cards loaded`;
        statusEl.classList.add('is-loaded');
    } catch (error) {
        console.error(error);
        statusEl.innerHTML = 'Could not load the card list. <button type="button" id="retry-button">Try again</button>';
        statusEl.classList.add('is-error');
        document.getElementById('retry-button').addEventListener('click', () => {
            statusEl.textContent = 'Loading The Hobbit card list…';
            statusEl.classList.remove('is-error');
            init();
        });
    }
}

init();
