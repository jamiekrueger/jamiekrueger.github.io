export default class ImageCropper {
    constructor({ viewport, img, uploadZone, fileInput, cropArea, zoomSlider, changeImageBtn, onLoad, onError }) {
        this.viewport = viewport;
        this.img = img;
        this._uploadZone = uploadZone;
        this._fileInput = fileInput;
        this._cropArea = cropArea;
        this._slider = zoomSlider;
        this._onLoad = onLoad;
        this._onError = onError;

        this._natW = 0; this._natH = 0;
        this._vpW = 0; this._vpH = 0;
        this._minScale = 1; this._maxScale = 4;
        this._scale = 1;
        this._offX = 0; this._offY = 0;
        this._objectUrl = null;
        this.loaded = false;

        this._dragging = false;
        this._dragStartX = 0; this._dragStartY = 0;
        this._dragOffX = 0; this._dragOffY = 0;

        this._touches = [];
        this._pinchDist = 0; this._pinchScale = 0;
        this._pinchMidX = 0; this._pinchMidY = 0;
        this._pinchOffX = 0; this._pinchOffY = 0;

        this._onMouseMove = e => this._mouseMove(e);
        this._onMouseUp = () => { this._dragging = false; };
        this._bind(changeImageBtn);
    }

    _bind(changeImageBtn) {
        const uz = this._uploadZone;
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

        this.viewport.addEventListener('mousedown', e => this._mouseDown(e));
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this.viewport.addEventListener('wheel', e => this._wheel(e), { passive: false });
        this.viewport.addEventListener('touchstart', e => this._touchStart(e), { passive: false });
        this.viewport.addEventListener('touchmove', e => this._touchMove(e), { passive: false });
        this.viewport.addEventListener('touchend', e => {
            if (e.touches.length < 2) this._touches = [];
            if (e.touches.length === 0) this._dragging = false;
        });
        this._slider.addEventListener('input', () => this._sliderInput());
    }

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
            requestAnimationFrame(() => {
                const r = this.viewport.getBoundingClientRect();
                this._vpW = r.width;
                this._vpH = r.height;
                this._minScale = Math.max(this._vpW / this._natW, this._vpH / this._natH);
                this._maxScale = this._minScale * 4;
                this._scale = this._minScale;
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

    reset() {
        this._cropArea.classList.add('hidden');
        this._uploadZone.classList.remove('hidden');
        this._fileInput.value = '';
        this.img.src = '';
        if (this._objectUrl) { URL.revokeObjectURL(this._objectUrl); this._objectUrl = null; }
        this.loaded = false;
    }

    destroy() {
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
        this.reset();
    }

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

    _clamp() {
        const w = this._natW * this._scale, h = this._natH * this._scale;
        this._offX = Math.min(0, Math.max(this._vpW - w, this._offX));
        this._offY = Math.min(0, Math.max(this._vpH - h, this._offY));
    }

    _applyTransform() {
        this._clamp();
        this.img.style.transform =
            'translate(' + this._offX + 'px,' + this._offY + 'px) scale(' + this._scale + ')';
    }

    _scaleToSlider(s) { return ((s - this._minScale) / (this._maxScale - this._minScale)) * 100; }
    _sliderToScale(v) { return this._minScale + (v / 100) * (this._maxScale - this._minScale); }

    _mouseDown(e) {
        if (e.button !== 0) return;
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

    _wheel(e) {
        e.preventDefault();
        const r = this.viewport.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        const old = this._scale;
        this._scale = Math.min(this._maxScale, Math.max(this._minScale,
            this._scale * (e.deltaY > 0 ? 0.95 : 1.05)));
        this._offX = cx - (cx - this._offX) * (this._scale / old);
        this._offY = cy - (cy - this._offY) * (this._scale / old);
        this._slider.value = this._scaleToSlider(this._scale);
        this._applyTransform();
    }

    _touchStart(e) {
        if (e.touches.length === 2) {
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
            this._dragging = true;
            this._dragStartX = e.touches[0].clientX; this._dragStartY = e.touches[0].clientY;
            this._dragOffX = this._offX; this._dragOffY = this._offY;
        }
    }

    _touchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const d = this._touchDist(Array.from(e.touches));
            const ns = Math.min(this._maxScale, Math.max(this._minScale,
                this._pinchScale * (d / this._pinchDist)));
            this._offX = this._pinchMidX - (this._pinchMidX - this._pinchOffX) * (ns / this._pinchScale);
            this._offY = this._pinchMidY - (this._pinchMidY - this._pinchOffY) * (ns / this._pinchScale);
            this._scale = ns;
            this._slider.value = this._scaleToSlider(this._scale);
            this._applyTransform();
        } else if (e.touches.length === 1 && this._dragging) {
            e.preventDefault();
            this._offX = this._dragOffX + (e.touches[0].clientX - this._dragStartX);
            this._offY = this._dragOffY + (e.touches[0].clientY - this._dragStartY);
            this._applyTransform();
        }
    }

    _touchDist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

    _sliderInput() {
        const old = this._scale;
        this._scale = this._sliderToScale(parseFloat(this._slider.value));
        const cx = this._vpW / 2, cy = this._vpH / 2;
        this._offX = cx - (cx - this._offX) * (this._scale / old);
        this._offY = cy - (cy - this._offY) * (this._scale / old);
        this._applyTransform();
    }
}
