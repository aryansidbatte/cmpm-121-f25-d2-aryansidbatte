import "./style.css";

// Create and insert the app title via TypeScript (do not edit index.html)
const appTitle = document.createElement("h1");
appTitle.textContent = "Simple Drawing App — Demo";
document.body.appendChild(appTitle);

// Create a 256x256 canvas and append it to the document
const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
canvas.className = "drawing-canvas";
canvas.setAttribute("aria-label", "Drawing canvas");
document.body.appendChild(canvas);

// Add a simple Clear button to erase the canvas
const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
clearButton.className = "clear-button";
document.body.appendChild(clearButton);

// Drawing state and stroke storage
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not get canvas context");
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = "#000";
ctx.lineWidth = 4;

type Point = { x: number; y: number };
let strokes: Point[][] = [];
let currentStroke: Point[] | null = null;
let isDrawing = false;

function getCanvasCoords(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

// Redraw observer: listens for `drawing-changed` and redraws the full canvas
canvas.addEventListener("drawing-changed", () => {
  // Clear and redraw all strokes
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
    ctx.closePath();
  }
});

function dispatchDrawingChanged() {
  const ev = new Event("drawing-changed");
  canvas.dispatchEvent(ev);
}

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  const p = getCanvasCoords(e);
  currentStroke = [{ x: p.x, y: p.y }];
  strokes.push(currentStroke);
  dispatchDrawingChanged();
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing || !currentStroke) return;
  const p = getCanvasCoords(e);
  currentStroke.push({ x: p.x, y: p.y });
  // Notify observers after each point is added
  dispatchDrawingChanged();
});

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  currentStroke = null;
}

canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

clearButton.addEventListener("click", () => {
  strokes = [];
  currentStroke = null;
  dispatchDrawingChanged();
});
