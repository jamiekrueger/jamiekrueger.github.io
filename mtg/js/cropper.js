/**
 * ImageCropper — pan-and-zoom image cropper used to frame card art.
 *
 * The user loads an image (via file picker or drag-and-drop), then positions it
 * inside a fixed-size viewport by panning and zooming. The visible region of
 * the viewport becomes the crop rectangle used for the final card art.
 *
 * Interaction model:
 *   Desktop  — click-drag to pan, scroll-wheel to zoom.
 *   Touch    — long-press then drag to pan (short swipes scroll the page),
 *              two-finger pinch to zoom.
 *   Slider   — a range input provides an alternative zoom control.
 */
export default class ImageCropper {
    constructor({ viewport, img, uploadZone, fileInput, cropArea, zoomSlider, changeImageBtn, onLoad, onError }) {
        // DOM references
        this.viewport = viewport;       // the fixed-size visible "window" into the image
        this.img = img;                 // the <img> element being transformed
        this._uploadZone = uploadZone;  // drop-zone / click-to-upload overlay
        this._fileInput = fileInput;    // hidden <input type="file">
        this._cropArea = cropArea;      // wrapper shown after an image is loaded
        this._slider = zoomSlider;      // range input for zoom level
        this._onLoad = onLoad;          // callback: image loaded successfully
        this._onError = onError;        // callback: image failed to load

        // Image natural dimensions (pixels) and viewport dimensions (CSS px)
        this._natW = 0; this._natH = 0;
        this._vpW = 0; this._vpH = 0;

        // Zoom state — scale is bounded by [_minScale, _maxScale].
        // _minScale is computed on load so the image always covers the viewport.
        this._minScale = 1; this._maxScale = 4;
        this._scale = 1;

        // Pan offset (CSS px) — top-left corner of the image relative to the viewport
        this._offX = 0; this._offY = 0;

        // Object URL for the loaded file (revoked on reset to avoid memory leaks)
        this._objectUrl = null;
        this.loaded = false;

        // Mouse drag state
        this._dragging = false;
        this._dragStartX = 0; this._dragStartY = 0;     // cursor position at drag start
        this._dragOffX = 0; this._dragOffY = 0;         // image offset at drag start

        // Touch pinch-zoom state
        this._touches = [];
        this._pinchDist = 0; this._pinchScale = 0;      // initial finger distance & scale
        this._pinchMidX = 0; this._pinchMidY = 0;       // midpoint between fingers (viewport-relative)
        this._pinchOffX = 0; this._pinchOffY = 0;       // image offset at pinch start

        // Touch single-finger handling.
        // On touch devices a long-press (200 ms) activates panning so that short
        // swipes still scroll the page instead of moving the image.
        this._longPressTimer = null;
        this._touchScrolling = false;
        this._isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

        // Bound handlers kept as references so they can be removed in destroy()
        this._onMouseMove = e => this._mouseMove(e);
        this._onMouseUp = () => { this._dragging = false; };
        this._bind(changeImageBtn);
    }

    // ── Event binding ──────────────────────────────────────────────────

    /** Wire up all DOM event listeners. Called once from the constructor. */
    _bind(changeImageBtn) {
        const uz = this._uploadZone;

        // Upload zone: click opens file picker, drag-and-drop loads the image
        uz.addEventListener('click', () => this._fileInput.click());
        uz.addEventListener('dragover', e => { e.preventDefault(); uz.classList.add('drag-over'); });
        uz.addEventListener('dragleave', () => uz.classList.remove('drag-over'));
        uz.addEventListener('drop', e => {
            e.preventDefault();
            uz.classList.remove('drag-over');
            const f = e.dataTransfer.files[0];
            if (f && f.type.startsWith('image/')) this.load(f);
        });
        this._fileInput.addEventListener('change', () => {
            if (this._fileInput.files[0]) this.load(this._fileInput.files[0]);
        });
        changeImageBtn.addEventListener('click', () => this._fileInput.click());

        // Mouse: drag to pan, wheel to zoom
        this.viewport.addEventListener('mousedown', e => this._mouseDown(e));
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this.viewport.addEventListener('wheel', e => this._wheel(e), { passive: false });

        // Touch: single-finger pan (after long-press), two-finger pinch-zoom
        this.viewport.addEventListener('touchstart', e => this._touchStart(e), { passive: false });
        this.viewport.addEventListener('touchmove', e => this._touchMove(e), { passive: false });
        this.viewport.addEventListener('touchend', e => {
            this._cancelLongPress();
            this.viewport.classList.remove('crop-panning');
            if (e.touches.length < 2) this._touches = [];
            if (e.touches.length === 0) { this._dragging = false; this._touchScrolling = false; }
        });
        this.viewport.addEventListener('touchcancel', () => {
            this._cancelLongPress();
            this.viewport.classList.remove('crop-panning');
            this._touches = [];
            this._dragging = false;
            this._touchScrolling = false;
        });

        // Zoom slider
        this._slider.addEventListener('input', () => this._sliderInput());
    }

    // ── Image loading / teardown ───────────────────────────────────────

    /**
     * Load a File (or Blob) as the cropper image.
     * Creates an object URL, reads natural dimensions via an offscreen Image,
     * then fits the image to cover the viewport (CSS "cover" behaviour).
     */
    load(file) {
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        this._objectUrl = URL.createObjectURL(file);
        const tmp = new Image();
        tmp.onerror = () => { if (this._onError) this._onError(); };
        tmp.onload = () => {
            this._natW = tmp.naturalWidth;
            this._natH = tmp.naturalHeight;
            this.img.src = this._objectUrl;
            this._uploadZone.classList.add('hidden');
            this._cropArea.classList.remove('hidden');

            // Wait one frame so the viewport has its layout dimensions
            requestAnimationFrame(() => {
                const r = this.viewport.getBoundingClientRect();
                this._vpW = r.width;
                this._vpH = r.height;

                // _minScale ensures the image always fully covers the viewport
                // (whichever axis is tighter dictates the minimum zoom).
                this._minScale = Math.max(this._vpW / this._natW, this._vpH / this._natH);
                this._maxScale = this._minScale * 4;
                this._scale = this._minScale;

                // Center the image within the viewport
                this._offX = (this._vpW - this._natW * this._scale) / 2;
                this._offY = (this._vpH - this._natH * this._scale) / 2;
                this._slider.value = 0;
                this.loaded = true;
                this._applyTransform();
                if (this._onLoad) this._onLoad();
            });
        };
        tmp.src = this._objectUrl;
    }

    /** Reset the cropper to its empty/upload state. */
    reset() {
        this._cropArea.classList.add('hidden');
        this._uploadZone.classList.remove('hidden');
        this._fileInput.value = '';
        this.img.src = '';
        if (this._objectUrl) { URL.revokeObjectURL(this._objectUrl); this._objectUrl = null; }
        this.loaded = false;
    }

    /** Remove global listeners and reset. Call when the cropper is no longer needed. */
    destroy() {
        this._cancelLongPress();
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
        this.reset();
    }

    _cancelLongPress() {
        if (this._longPressTimer) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }
    }

    // ── Crop rectangle ─────────────────────────────────────────────────

    /**
     * Return the visible region in the image's natural-pixel coordinate space.
     * Used when drawing the final cropped artwork onto a canvas.
     */
    getCropRect() {
        const r = this.viewport.getBoundingClientRect();
        this._vpW = r.width;
        this._vpH = r.height;
        return {
            srcX: -this._offX / this._scale,
            srcY: -this._offY / this._scale,
            srcW: this._vpW / this._scale,
            srcH: this._vpH / this._scale
        };
    }

    // ── Transform helpers ──────────────────────────────────────────────

    /**
     * Clamp the pan offset so the image edges never pull inside the viewport.
     * offX/offY are negative (image origin is left/above the viewport origin),
     * so we keep them between -(imageSize - vpSize) and 0.
     */
    _clamp() {
        const w = this._natW * this._scale, h = this._natH * this._scale;
        this._offX = Math.min(0, Math.max(this._vpW - w, this._offX));
        this._offY = Math.min(0, Math.max(this._vpH - h, this._offY));
    }

    /** Apply the current scale + offset to the <img> via a CSS transform. */
    _applyTransform() {
        this._clamp();
        this.img.style.transform =
            'translate(' + this._offX + 'px,' + this._offY + 'px) scale(' + this._scale + ')';
    }

    // Linearly map between the slider's 0-100 range and the scale range
    _scaleToSlider(s) { return ((s - this._minScale) / (this._maxScale - this._minScale)) * 100; }
    _sliderToScale(v) { return this._minScale + (v / 100) * (this._maxScale - this._minScale); }

    // ── Mouse interaction ──────────────────────────────────────────────

    _mouseDown(e) {
        if (e.button !== 0) return; // left-click only
        this._dragging = true;
        this._dragStartX = e.clientX; this._dragStartY = e.clientY;
        this._dragOffX = this._offX; this._dragOffY = this._offY;
        e.preventDefault();
    }

    _mouseMove(e) {
        if (!this._dragging) return;
        this._offX = this._dragOffX + (e.clientX - this._dragStartX);
        this._offY = this._dragOffY + (e.clientY - this._dragStartY);
        this._applyTransform();
    }

    /**
     * Wheel zoom: scale around the cursor position so the point under the
     * cursor stays fixed (the standard "zoom-to-pointer" pattern).
     */
    _wheel(e) {
        e.preventDefault();
        const r = this.viewport.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top; // cursor pos in viewport
        const old = this._scale;
        // 5% zoom per wheel tick
        this._scale = Math.min(this._maxScale, Math.max(this._minScale,
            this._scale * (e.deltaY > 0 ? 0.95 : 1.05)));
        // Adjust offset so the point under the cursor doesn't move
        this._offX = cx - (cx - this._offX) * (this._scale / old);
        this._offY = cy - (cy - this._offY) * (this._scale / old);
        this._slider.value = this._scaleToSlider(this._scale);
        this._applyTransform();
    }

    // ── Touch interaction ──────────────────────────────────────────────

    _touchStart(e) {
        if (e.touches.length === 2) {
            // Two-finger pinch: record initial distance, scale, midpoint, and offset
            this._cancelLongPress();
            e.preventDefault();
            this._touches = Array.from(e.touches);
            this._pinchDist = this._touchDist(this._touches);
            this._pinchScale = this._scale;
            const r = this.viewport.getBoundingClientRect();
            this._pinchMidX = (this._touches[0].clientX + this._touches[1].clientX) / 2 - r.left;
            this._pinchMidY = (this._touches[0].clientY + this._touches[1].clientY) / 2 - r.top;
            this._pinchOffX = this._offX;
            this._pinchOffY = this._offY;
        } else if (e.touches.length === 1) {
            this._dragStartX = e.touches[0].clientX; this._dragStartY = e.touches[0].clientY;
            this._dragOffX = this._offX; this._dragOffY = this._offY;
            if (this._isTouchDevice) {
                // On touch devices, wait 200 ms before activating pan so that
                // quick swipes scroll the page normally instead of moving the image.
                this._touchScrolling = false;
                this._longPressTimer = setTimeout(() => {
                    this._longPressTimer = null;
                    this._dragging = true;
                    this.viewport.classList.add('crop-panning');
                }, 200);
            } else {
                // Non-touch device with touch events (e.g. stylus) — pan immediately
                this._dragging = true;
            }
        }
    }

    _touchMove(e) {
        if (e.touches.length === 2) {
            // Pinch zoom: scale around the midpoint between the two fingers
            e.preventDefault();
            const d = this._touchDist(Array.from(e.touches));
            const ns = Math.min(this._maxScale, Math.max(this._minScale,
                this._pinchScale * (d / this._pinchDist)));
            this._offX = this._pinchMidX - (this._pinchMidX - this._pinchOffX) * (ns / this._pinchScale);
            this._offY = this._pinchMidY - (this._pinchMidY - this._pinchOffY) * (ns / this._pinchScale);
            this._scale = ns;
            this._slider.value = this._scaleToSlider(this._scale);
            this._applyTransform();
        } else if (e.touches.length === 1) {
            if (this._dragging) {
                // Long-press confirmed — pan the image
                e.preventDefault();
                this._offX = this._dragOffX + (e.touches[0].clientX - this._dragStartX);
                this._offY = this._dragOffY + (e.touches[0].clientY - this._dragStartY);
                this._applyTransform();
            } else if (this._longPressTimer && !this._touchScrolling) {
                // Still within the long-press window — check if the finger moved
                // far enough to be considered a scroll instead of a press-and-hold.
                const dx = e.touches[0].clientX - this._dragStartX;
                const dy = e.touches[0].clientY - this._dragStartY;
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    this._cancelLongPress();
                    this._touchScrolling = true; // let the browser handle the scroll
                }
            }
        }
    }

    /** Euclidean distance between two Touch objects (used for pinch gestures). */
    _touchDist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

    // ── Slider zoom ────────────────────────────────────────────────────

    /** Zoom via the slider, scaling around the viewport centre. */
    _sliderInput() {
        const old = this._scale;
        this._scale = this._sliderToScale(parseFloat(this._slider.value));
        const cx = this._vpW / 2, cy = this._vpH / 2;
        // Same "zoom-to-point" formula, but anchored at the viewport centre
        this._offX = cx - (cx - this._offX) * (this._scale / old);
        this._offY = cy - (cy - this._offY) * (this._scale / old);
        this._applyTransform();
    }
}
