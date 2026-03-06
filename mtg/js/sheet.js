import { SHEET } from './constants.js';

export function initSheet({ slotsEl, countEl, paperSel, doubleCheck, cropCheck, backOffsetInput, offsetRow, downloadBtn, clearBtn, testBtn, panelEl, toggleEl, closeEl, onStatus }) {
    let sheetQueue = [];
    let sheetIdCounter = 0;
    let hasAutoExpanded = false;
    let sheetPaper = 'letter';
    let sheetDoubleSided = false;
    let sheetCropMarks = true;
    let sortableInstance = null;
    let dragSource = null; // { slotId, side } for native card drag

    paperSel.addEventListener('change', () => { sheetPaper = paperSel.value; });
    doubleCheck.addEventListener('change', () => {
        sheetDoubleSided = doubleCheck.checked;
        offsetRow.style.display = sheetDoubleSided ? '' : 'none';
        refreshSheetPanel();
    });
    cropCheck.addEventListener('change', () => {
        sheetCropMarks = cropCheck.checked;
    });

    toggleEl.addEventListener('click', () => {
        panelEl.classList.toggle('expanded');
    });

    closeEl.addEventListener('click', () => {
        panelEl.classList.remove('expanded');
    });

    clearBtn.addEventListener('click', () => {
        clearSheet();
    });

    downloadBtn.addEventListener('click', () => {
        if (sheetQueue.length === 0) return;
        if (sheetDoubleSided) {
            generateDoubleSidedPDF();
        } else {
            generateSingleSidedPDF();
        }
    });

    testBtn.addEventListener('click', () => {
        generateTestPDF();
    });

    /* ===== Drag Helpers ===== */
    function createDropZone(slotId, side, cardData) {
        const zone = document.createElement('div');
        zone.className = 'sheet-drop' + (cardData ? ' filled' : '');
        zone.dataset.slotId = slotId;
        zone.dataset.side = side;

        if (cardData) {
            const img = document.createElement('img');
            img.src = cardData.dataUrl;
            img.alt = cardData.label;
            img.draggable = true;
            img.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                dragSource = { slotId, side };
                e.dataTransfer.effectAllowed = 'move';
                slotsEl.classList.add('card-dragging');
            });
            img.addEventListener('dragend', () => {
                dragSource = null;
                slotsEl.classList.remove('card-dragging');
            });
            zone.appendChild(img);
        } else {
            zone.textContent = side === 'front' ? 'Front' : 'Back';
        }

        // Accept drops — highlight border, swap on drop
        // stopPropagation prevents Sortable (row reorder) from intercepting card drags
        let enterCount = 0;
        zone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; });
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (++enterCount === 1) zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            if (--enterCount === 0) zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            enterCount = 0;
            zone.classList.remove('drag-over');
            if (!dragSource) return;
            moveCard(dragSource.slotId, dragSource.side, slotId, side);
            dragSource = null;
        });

        return zone;
    }

    function moveCard(fromSlotId, fromSide, toSlotId, toSide) {
        const fromSlot = sheetQueue.find(s => s.id === fromSlotId);
        const toSlot = sheetQueue.find(s => s.id === toSlotId);
        if (!fromSlot || !toSlot) return;
        if (fromSlotId === toSlotId && fromSide === toSide) return;

        const fromCard = fromSlot[fromSide];
        const toCard = toSlot[toSide];

        toSlot[toSide] = fromCard;
        fromSlot[fromSide] = toCard;

        sheetQueue = sheetQueue.filter(s => s.front || s.back);
        refreshSheetPanel();
    }

    /* ===== Refresh Sheet Panel ===== */
    function refreshSheetPanel() {
        // Destroy previous Sortable instance (row reordering only)
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }

        const count = sheetQueue.length;
        countEl.textContent = '(' + count + ')';
        downloadBtn.disabled = count === 0;
        clearBtn.disabled = count === 0;

        slotsEl.replaceChildren();

        if (count === 0) {
            const msg = document.createElement('div');
            msg.className = 'sheet-empty-msg';
            msg.textContent = 'No cards added yet';
            slotsEl.appendChild(msg);
        } else {
            for (const slot of sheetQueue) {
                const slotEl = document.createElement('div');
                slotEl.className = 'sheet-slot';
                slotEl.dataset.slotId = slot.id;

                // Drag handle for row reordering
                const handle = document.createElement('span');
                handle.className = 'sheet-drag-handle';
                handle.textContent = '\u2630';
                slotEl.appendChild(handle);

                const frontDrop = createDropZone(slot.id, 'front', slot.front);
                slotEl.appendChild(frontDrop);

                const backDrop = createDropZone(slot.id, 'back', slot.back);
                slotEl.appendChild(backDrop);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'sheet-slot-remove';
                removeBtn.textContent = '\u00d7';
                removeBtn.title = 'Remove slot';
                removeBtn.addEventListener('click', () => {
                    sheetQueue = sheetQueue.filter(s => s.id !== slot.id);
                    refreshSheetPanel();
                });
                slotEl.appendChild(removeBtn);

                slotsEl.appendChild(slotEl);
            }

            // "Drop here for new row" zone at the bottom
            const dropNew = document.createElement('div');
            dropNew.className = 'sheet-drop-new';
            let dragEnterCount = 0;
            dropNew.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
            dropNew.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (++dragEnterCount === 1) dropNew.classList.add('drag-over');
            });
            dropNew.addEventListener('dragleave', () => {
                if (--dragEnterCount === 0) dropNew.classList.remove('drag-over');
            });
            dropNew.addEventListener('drop', (e) => {
                e.preventDefault();
                dragEnterCount = 0;
                dropNew.classList.remove('drag-over');
                if (!dragSource) return;
                const fromSlot = sheetQueue.find(s => s.id === dragSource.slotId);
                if (!fromSlot) return;
                const cardData = fromSlot[dragSource.side];
                if (!cardData) return;
                fromSlot[dragSource.side] = null;
                sheetQueue.push({ id: ++sheetIdCounter, front: cardData, back: null });
                sheetQueue = sheetQueue.filter(s => s.front || s.back);
                dragSource = null;
                refreshSheetPanel();
            });
            slotsEl.appendChild(dropNew);

            // Initialize SortableJS for row reordering
            sortableInstance = new Sortable(slotsEl, {
                animation: 0,
                handle: '.sheet-drag-handle',
                ghostClass: 'sheet-slot-ghost',
                chosenClass: 'sheet-slot-chosen',
                dragClass: 'sheet-slot-drag',
                filter: '.sheet-drop-new',
                onEnd(evt) {
                    if (evt.oldIndex === evt.newIndex) return;
                    const [moved] = sheetQueue.splice(evt.oldIndex, 1);
                    sheetQueue.splice(evt.newIndex, 0, moved);
                    refreshSheetPanel();
                }
            });
        }
    }

    /* ===== PDF Helpers ===== */
    function createPDF() {
        const { jsPDF } = window.jspdf;
        const paper = SHEET.PAPER[sheetPaper];
        return { doc: new jsPDF({ orientation: 'portrait', unit: 'mm', format: [paper.w, paper.h] }), paper };
    }

    function getGridLayout(paper) {
        const gridW = SHEET.COLS * SHEET.CARD_W_MM;
        const gridH = SHEET.ROWS * SHEET.CARD_H_MM;
        return { gridW, gridH, marginX: (paper.w - gridW) / 2, marginY: (paper.h - gridH) / 2 };
    }

    function getCellPos(posOnPage, marginX, marginY) {
        const col = posOnPage % SHEET.COLS;
        const row = Math.floor(posOnPage / SHEET.COLS);
        return { col, row, x: marginX + col * SHEET.CARD_W_MM, y: marginY + row * SHEET.CARD_H_MM };
    }

    function getMirroredCellPos(posOnPage, marginX, marginY) {
        const { col, row, y } = getCellPos(posOnPage, marginX, marginY);
        return { col, row, x: marginX + (SHEET.COLS - 1 - col) * SHEET.CARD_W_MM, y };
    }

    /* ===== PDF Crop Marks ===== */
    function drawCropMarks(doc, marginX, marginY, gridW, gridH) {
        if (!sheetCropMarks) return;
        const MARK_LEN = 5;   // mm length of each mark line
        const MARK_GAP = 1.5; // mm gap between card edge and mark start
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.2);

        for (let col = 0; col <= SHEET.COLS; col++) {
            const x = marginX + col * SHEET.CARD_W_MM;
            for (let row = 0; row <= SHEET.ROWS; row++) {
                const y = marginY + row * SHEET.CARD_H_MM;
                // top mark
                if (row === 0) {
                    doc.line(x, marginY - MARK_GAP, x, marginY - MARK_GAP - MARK_LEN);
                }
                // bottom mark
                if (row === SHEET.ROWS) {
                    doc.line(x, marginY + gridH + MARK_GAP, x, marginY + gridH + MARK_GAP + MARK_LEN);
                }
                // left mark
                if (col === 0) {
                    doc.line(marginX - MARK_GAP, y, marginX - MARK_GAP - MARK_LEN, y);
                }
                // right mark
                if (col === SHEET.COLS) {
                    doc.line(marginX + gridW + MARK_GAP, y, marginX + gridW + MARK_GAP + MARK_LEN, y);
                }
            }
        }
    }

    /* ===== PDF Generation: Single-Sided ===== */
    function generateSingleSidedPDF() {
        const { doc, paper } = createPDF();
        const { gridW, gridH, marginX, marginY } = getGridLayout(paper);

        // Flatten all cards (fronts and backs) onto single-sided pages
        const cards = [];
        for (const slot of sheetQueue) {
            if (slot.front) cards.push(slot.front.dataUrl);
            if (slot.back) cards.push(slot.back.dataUrl);
        }

        if (cards.length === 0) return;

        for (let i = 0; i < cards.length; i++) {
            if (i > 0 && i % SHEET.CARDS_PER_PAGE === 0) {
                doc.addPage([paper.w, paper.h], 'portrait');
            }
            const posOnPage = i % SHEET.CARDS_PER_PAGE;
            const { x, y } = getCellPos(posOnPage, marginX, marginY);
            doc.addImage(cards[i], 'PNG', x, y, SHEET.CARD_W_MM, SHEET.CARD_H_MM);

            // Draw crop marks after last card on each page
            if (posOnPage === SHEET.CARDS_PER_PAGE - 1 || i === cards.length - 1) {
                drawCropMarks(doc, marginX, marginY, gridW, gridH);
            }
        }

        doc.save('jumpstart-sheet.pdf');
    }

    /* ===== PDF Generation: Double-Sided ===== */
    function generateDoubleSidedPDF() {
        const { doc, paper } = createPDF();
        const { gridW, gridH, marginX, marginY } = getGridLayout(paper);

        // Build parallel front/back arrays by slot
        const fronts = [];
        const backs = [];
        for (const slot of sheetQueue) {
            fronts.push(slot.front ? slot.front.dataUrl : null);
            backs.push(slot.back ? slot.back.dataUrl : null);
        }

        const backOffsetY = parseFloat(backOffsetInput.value) || 0;
        const totalPages = Math.ceil(fronts.length / SHEET.CARDS_PER_PAGE);
        let firstPage = true;

        for (let page = 0; page < totalPages; page++) {
            const startIdx = page * SHEET.CARDS_PER_PAGE;
            const endIdx = Math.min(startIdx + SHEET.CARDS_PER_PAGE, fronts.length);

            // Front page
            if (!firstPage) doc.addPage([paper.w, paper.h], 'portrait');
            firstPage = false;

            for (let i = startIdx; i < endIdx; i++) {
                if (!fronts[i]) continue;
                const { x, y } = getCellPos(i - startIdx, marginX, marginY);
                doc.addImage(fronts[i], 'PNG', x, y, SHEET.CARD_W_MM, SHEET.CARD_H_MM);
            }
            drawCropMarks(doc, marginX, marginY, gridW, gridH);

            // Back page — mirror columns for long-edge duplex, shifted by back offset
            const backMarginY = marginY + backOffsetY;
            doc.addPage([paper.w, paper.h], 'portrait');
            for (let i = startIdx; i < endIdx; i++) {
                if (!backs[i]) continue;
                const { x, y } = getMirroredCellPos(i - startIdx, marginX, backMarginY);
                doc.addImage(backs[i], 'PNG', x, y, SHEET.CARD_W_MM, SHEET.CARD_H_MM);
            }
            drawCropMarks(doc, marginX, backMarginY, gridW, gridH);
        }

        doc.save('jumpstart-sheet-double.pdf');
    }

    /* ===== PDF Generation: Alignment Test Page ===== */
    function generateTestPDF() {
        const { doc, paper } = createPDF();
        const { gridW, gridH, marginX, marginY } = getGridLayout(paper);
        const backOffsetY = parseFloat(backOffsetInput.value) || 0;

        function setupTestPageStyle() {
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.setFontSize(18);
            doc.setTextColor(0);
        }

        // Front page
        setupTestPageStyle();
        for (let i = 0; i < SHEET.CARDS_PER_PAGE; i++) {
            const { x, y } = getCellPos(i, marginX, marginY);
            doc.rect(x, y, SHEET.CARD_W_MM, SHEET.CARD_H_MM);
            doc.text((i + 1) + ' FRONT', x + SHEET.CARD_W_MM / 2, y + SHEET.CARD_H_MM / 2, { align: 'center', baseline: 'middle' });
        }
        drawCropMarks(doc, marginX, marginY, gridW, gridH);

        // Back page — mirror columns, apply back offset
        const backMarginY = marginY + backOffsetY;
        doc.addPage([paper.w, paper.h], 'portrait');
        setupTestPageStyle();
        for (let i = 0; i < SHEET.CARDS_PER_PAGE; i++) {
            const { x, y } = getMirroredCellPos(i, marginX, backMarginY);
            doc.rect(x, y, SHEET.CARD_W_MM, SHEET.CARD_H_MM);
            doc.text((i + 1) + ' BACK', x + SHEET.CARD_W_MM / 2, y + SHEET.CARD_H_MM / 2, { align: 'center', baseline: 'middle' });
        }
        drawCropMarks(doc, marginX, backMarginY, gridW, gridH);

        doc.save('alignment-test.pdf');
    }

    function addToSheet(front, back) {
        sheetQueue.push({
            id: ++sheetIdCounter,
            front: front || null,
            back: back || null,
        });
        refreshSheetPanel();
        // Auto-expand on first add (desktop only) — after that, respect the user's choice
        if (!hasAutoExpanded && window.matchMedia('(min-width: 769px)').matches) {
            panelEl.classList.add('expanded');
            hasAutoExpanded = true;
        }
        requestAnimationFrame(() => slotsEl.scrollTop = slotsEl.scrollHeight);
    }

    function clearSheet() {
        sheetQueue = [];
        refreshSheetPanel();
    }

    // Initialize panel
    refreshSheetPanel();

    return { addToSheet, clearSheet };
}
