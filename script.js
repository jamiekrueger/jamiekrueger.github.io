const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let hue = 0;
let color = 'black';
const img = new Image();
img.src = 'me.png';

img.onload = function() {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Draw the image onto the canvas
};

function draw(e) {
    if (!isDrawing) return;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

document.getElementById('colorRed').addEventListener('click', () => color = 'red');
document.getElementById('colorBlue').addEventListener('click', () => color = 'blue');
document.getElementById('colorGreen').addEventListener('click', () => color = 'green');
document.getElementById('eraser').addEventListener('click', () => color = 'white');
document.getElementById('reset').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Redraw the image
});