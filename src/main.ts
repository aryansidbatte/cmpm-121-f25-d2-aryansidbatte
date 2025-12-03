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

// Add Undo and Redo buttons
const undoButton = document.createElement("button");
undoButton.textContent = "Undo";
undoButton.className = "undo-button toolbar-button";
undoButton.disabled = true;
document.body.appendChild(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "Redo";
redoButton.className = "redo-button toolbar-button";
redoButton.disabled = true;
document.body.appendChild(redoButton);

// Marker tool buttons (thin / thick)
const thinButton = document.createElement("button");
thinButton.textContent = "Thin";
thinButton.className = "tool-button toolbar-button";
document.body.appendChild(thinButton);

const thickButton = document.createElement("button");
thickButton.textContent = "Thick";
thickButton.className = "tool-button toolbar-button";
document.body.appendChild(thickButton);

// Drawing state and stroke storage
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not get canvas context");
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = "#000";
ctx.lineWidth = 4;

type Point = { x: number; y: number };

// Command object representing a marker line (display command)
class MarkerLine {
  points: Point[] = [];
  thickness: number;
  constructor(start: Point, thickness = 4) {
    this.points.push(start);
    this.thickness = thickness;
  }
  drag(x: number, y: number) {
    this.points.push({ x, y });
  }
  display(ctx: CanvasRenderingContext2D) {
    if (this.points.length === 0) return;
    ctx.save();
    ctx.lineWidth = this.thickness;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }
}

let strokes: MarkerLine[] = [];
let redoStack: MarkerLine[] = [];
let currentStroke: MarkerLine | null = null;
// Current tool thickness (default thin)
let currentThickness = 2;

// Initialize tool selection UI
function selectTool(button: HTMLButtonElement, thickness: number) {
  // remove selected class from both
  thinButton.classList.remove("selected");
  thickButton.classList.remove("selected");
  button.classList.add("selected");
  currentThickness = thickness;
}

// Default selection: Thin
selectTool(thinButton, 2);

thinButton.addEventListener("click", () => selectTool(thinButton, 2));
thickButton.addEventListener("click", () => selectTool(thickButton, 8));
let isDrawing = false;

function getCanvasCoords(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

// Redraw observer: listens for `drawing-changed` and redraws the full canvas
canvas.addEventListener("drawing-changed", () => {
  // Clear and redraw all display commands
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const cmd of strokes) {
    cmd.display(ctx);
  }
});

function dispatchDrawingChanged() {
  const ev = new Event("drawing-changed");
  canvas.dispatchEvent(ev);
}

function updateToolbarButtons() {
  undoButton.disabled = strokes.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  const p = getCanvasCoords(e);
  currentStroke = new MarkerLine({ x: p.x, y: p.y }, currentThickness);
  strokes.push(currentStroke);
  // When starting a new stroke, clear the redo stack
  redoStack = [];
  dispatchDrawingChanged();
  updateToolbarButtons();
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing || !currentStroke) return;
  const p = getCanvasCoords(e);
  currentStroke.drag(p.x, p.y);
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
  // Clear display list and redo stack
  if (strokes.length === 0) return;
  redoStack = [];
  strokes = [];
  currentStroke = null;
  dispatchDrawingChanged();
  updateToolbarButtons();
});

undoButton.addEventListener("click", () => {
  if (strokes.length === 0) return;
  const last = strokes.pop();
  if (last) {
    redoStack.push(last);
  }
  dispatchDrawingChanged();
  updateToolbarButtons();
});

redoButton.addEventListener("click", () => {
  if (redoStack.length === 0) return;
  const item = redoStack.pop();
  if (item) {
    strokes.push(item);
  }
  dispatchDrawingChanged();
  updateToolbarButtons();
});
