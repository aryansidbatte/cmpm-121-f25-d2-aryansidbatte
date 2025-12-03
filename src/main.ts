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

// Export button
const exportButton = document.createElement("button");
exportButton.textContent = "Export";
exportButton.className = "export-button toolbar-button";
document.body.appendChild(exportButton);

// Marker tool buttons (thin / thick)
const thinButton = document.createElement("button");
thinButton.textContent = "Thin";
thinButton.className = "tool-button toolbar-button";
document.body.appendChild(thinButton);

const thickButton = document.createElement("button");
thickButton.textContent = "Thick";
thickButton.className = "tool-button toolbar-button";
document.body.appendChild(thickButton);

// Sticker tool buttons (data-driven)
const stickerButtons: HTMLButtonElement[] = [];
let stickers: string[] = ["😀", "🌟", "❤️"];

function createStickerButton(emoji: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = emoji;
  b.className = "tool-button toolbar-button sticker-button";
  b.addEventListener("click", () => selectSticker(b, emoji));
  document.body.appendChild(b);
  stickerButtons.push(b);
  return b;
}

// initialize buttons from the stickers array
stickers.forEach((emo) => createStickerButton(emo));

// Add custom sticker button
const addStickerButton = document.createElement("button");
addStickerButton.textContent = "Add Sticker";
addStickerButton.className = "tool-button toolbar-button";
addStickerButton.addEventListener("click", () => {
  const input = prompt("Enter a sticker (emoji or text):", "⭐");
  if (input === null) return; // cancelled
  const val = input.trim();
  if (val.length === 0) return;
  // add to stickers array and create a button for it
  stickers.push(val);
  const newBtn = createStickerButton(val);
  // select the newly created sticker
  selectSticker(newBtn, val);
});
document.body.appendChild(addStickerButton);

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

// Commands can be MarkerLine or StickerCommand — use a common type
type Command = MarkerLine | StickerCommand;

let strokes: Command[] = [];
let redoStack: Command[] = [];
let currentStroke: Command | null = null;
// Current tool: 'marker' or 'sticker'
let currentTool: "marker" | "sticker" = "marker";
// Current tool thickness (default thin)
let currentThickness = 2;
// Current sticker emoji when sticker tool selected
let currentSticker: string | null = null;

// Initialize tool selection UI
function selectTool(button: HTMLButtonElement, thickness: number) {
  // remove selected class from both
  thinButton.classList.remove("selected");
  thickButton.classList.remove("selected");
  button.classList.add("selected");
  currentThickness = thickness;
  currentTool = "marker";
  // deselect sticker buttons
  for (const sb of stickerButtons) sb.classList.remove("selected");
}

// Default selection: Thin
selectTool(thinButton, 2);

thinButton.addEventListener("click", () => selectTool(thinButton, 3));
thickButton.addEventListener("click", () => selectTool(thickButton, 6));

// Sticker selection
function selectSticker(button: HTMLButtonElement, emoji: string) {
  // deselect marker buttons
  thinButton.classList.remove("selected");
  thickButton.classList.remove("selected");
  // deselect all sticker buttons then select this one
  for (const sb of stickerButtons) sb.classList.remove("selected");
  button.classList.add("selected");
  currentTool = "sticker";
  currentSticker = emoji;
  // Fire a tool-moved event so UI can update preview
  const ev = new CustomEvent("tool-moved", { detail: { emoji } });
  canvas.dispatchEvent(ev);
}

stickerButtons.forEach((b, i) =>
  b.addEventListener("click", () => selectSticker(b, stickers[i]))
);
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
  // Draw tool preview if available
  if ((window as any).__toolPreview__) {
    (window as any).__toolPreview__.draw(ctx);
  }
});

function dispatchDrawingChanged() {
  const ev = new Event("drawing-changed");
  canvas.dispatchEvent(ev);
}

// Tool preview command (draws a circle matching the marker thickness)
class ToolPreview {
  x: number;
  y: number;
  thickness: number;
  constructor(x: number, y: number, thickness: number) {
    this.x = x;
    this.y = y;
    this.thickness = thickness;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.arc(this.x, this.y, this.thickness / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }
}

// Global nullable reference to preview (stored on window to keep simple)
// Global preview may be ToolPreview or StickerPreview
(window as any).__toolPreview__ = null as ToolPreview | null;

// Sticker preview draws the emoji at the cursor
class StickerPreview {
  x: number;
  y: number;
  emoji: string;
  size: number;
  constructor(x: number, y: number, emoji: string, size = 24) {
    this.x = x;
    this.y = y;
    this.emoji = emoji;
    this.size = size;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = `${this.size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

// When the tool moves, re-render (tool-moved event carries position in detail)
canvas.addEventListener("tool-moved", (e: Event) => {
  // simply trigger a redraw which will render the preview if present
  dispatchDrawingChanged();
});

// Sticker command placed into the display list. drag(x,y) repositions the sticker.
class StickerCommand {
  x: number;
  y: number;
  emoji: string;
  size: number;
  constructor(x: number, y: number, emoji: string, size = 24) {
    this.x = x;
    this.y = y;
    this.emoji = emoji;
    this.size = size;
  }
  drag(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  display(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = `${this.size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

function updateToolbarButtons() {
  undoButton.disabled = strokes.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  const p = getCanvasCoords(e);
  if (currentTool === "marker") {
    currentStroke = new MarkerLine({ x: p.x, y: p.y }, currentThickness);
    strokes.push(currentStroke);
    // When starting a new stroke, clear the redo stack
    redoStack = [];
    // remove any preview while drawing
    (window as any).__toolPreview__ = null;
    dispatchDrawingChanged();
    updateToolbarButtons();
  } else if (currentTool === "sticker" && currentSticker) {
    // Start a sticker command which can be dragged to position
    const size = Math.max(18, currentThickness * 6);
    const stickerCmd = new StickerCommand(p.x, p.y, currentSticker, size);
    currentStroke = stickerCmd;
    strokes.push(currentStroke);
    redoStack = [];
    // keep isDrawing true so mousemove will reposition the sticker until mouseup
    (window as any).__toolPreview__ = null;
    dispatchDrawingChanged();
    updateToolbarButtons();
  }
});

canvas.addEventListener("mousemove", (e) => {
  const p = getCanvasCoords(e);
  // Update preview first so redraw shows it
  if (!isDrawing || !currentStroke) {
    if (currentTool === "marker") {
      (window as any).__toolPreview__ = new ToolPreview(
        p.x,
        p.y,
        currentThickness,
      );
    } else if (currentTool === "sticker" && currentSticker) {
      const size = Math.max(18, currentThickness * 6);
      (window as any).__toolPreview__ = new StickerPreview(
        p.x,
        p.y,
        currentSticker,
        size,
      );
    }
    const toolEv = new CustomEvent("tool-moved", {
      detail: { x: p.x, y: p.y },
    });
    canvas.dispatchEvent(toolEv);
    return;
  }

  // When drawing, remove preview and add to current stroke
  (window as any).__toolPreview__ = null;
  // currentStroke may be MarkerLine or StickerCommand
  if (currentStroke) {
    (currentStroke as any).drag(p.x, p.y);
  }
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

// When mouse leaves canvas, remove preview and redraw
canvas.addEventListener("mouseleave", () => {
  (window as any).__toolPreview__ = null;
  dispatchDrawingChanged();
});

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

// Export handler: render all commands to a 1024x1024 canvas and download PNG
exportButton.addEventListener("click", () => {
  const SCALE = 4; // 256 -> 1024
  const out = document.createElement("canvas");
  out.width = 256 * SCALE;
  out.height = 256 * SCALE;
  const outCtx = out.getContext("2d");
  if (!outCtx) {
    alert("Export failed: unable to get canvas context");
    return;
  }
  // Scale so that drawing commands (which assume a 256x256 canvas) fill the larger canvas
  outCtx.save();
  outCtx.scale(SCALE, SCALE);

  // Optional: fill white background
  outCtx.fillStyle = "#fff";
  outCtx.fillRect(0, 0, out.width / SCALE, out.height / SCALE);

  // Execute all display commands (do NOT draw the preview)
  for (const cmd of strokes) {
    (cmd as any).display(outCtx);
  }

  outCtx.restore();

  // Trigger download
  const dataUrl = out.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "drawing.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
});
