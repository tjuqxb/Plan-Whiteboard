// Drawing rectangles method reference: https://github.com/Maleficentt/canvas-demo
// 1. Fixing one bug in mouseDown() and create a pull request for the above repo
// 2. Altering code for simplification(e.g, 1. startX, endX, startY, endY for testing coordinates in the range of one rectangle)
// 3. Implementing synchorinization with server(rendering interval, defining actions and sending)
// 4. Implementing selection and deletion
// Touch function reference: https://bencentra.com/code/2014/12/05/html5-canvas-touch-events.html

let projectID;
let lock = true;
let hasCreated = false;
let watchMode = false;
let rectList = []; //Sync array
let serverLen = 0;
let rectDictTemp = {};
let requests = {};
let repeatRequests = {};

function Rect(index, startX, startY, endX, endY, color, added) {
  this.index = index;
  this.startX = startX;
  this.startY = startY;
  this.endX = endX;
  this.endY = endY;
  this.color = color;
  this.added = added;
}

let canvas;
let context;

window.onload = (function () {
  addLisntners();
})();

function addLisntners() {
  canvas = document.getElementById('canvas');
  context = canvas.getContext('2d');
  canvas.onmousedown = mouseDownV;
  canvas.onmousemove = mouseMoveV;
  canvas.onmouseup = mouseUpV;
  canvas.addEventListener(
    'touchstart',
    function (e) {
      mousePos = getTouchPos(canvas, e);
      var touch = e.touches[0];
      var mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      canvas.dispatchEvent(mouseEvent);
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchend',
    function (e) {
      var mouseEvent = new MouseEvent('mouseup', {});
      canvas.dispatchEvent(mouseEvent);
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchmove',
    function (e) {
      var touch = e.touches[0];
      var mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      canvas.dispatchEvent(mouseEvent);
    },
    { passive: false }
  );

  // Prevent scrolling when touching the canvas
  document.body.addEventListener(
    'touchstart',
    function (e) {
      if (e.target == canvas) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
  document.body.addEventListener(
    'touchend',
    function (e) {
      if (e.target == canvas) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
  document.body.addEventListener(
    'touchmove',
    function (e) {
      if (e.target == canvas) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

let startX;
let startY;
let endX;
let endY;

let width = 0;
let height = 0;

let isDrawing = false;
let isDragging = false;
let createRec = false;

let currentRect;

const colors = [
  'green',
  'blue',
  'red',
  'yellow',
  'magenta',
  'orange',
  'brown',
  'purple',
  'pink',
];
let color;

function mouseDownV(e) {
  if (!lock) {
    mouseDown(e);
  } else {
    displayAlertType0();
  }
}

function mouseMoveV(e) {
  if (!lock) {
    mouseMove(e);
  }
}

function mouseUpV(e) {
  if (!lock) {
    mouseUp(e);
  } else {
    displayAlertType0();
  }
}

// Get the position of a touch relative to the canvas
function getTouchPos(canvasDom, touchEvent) {
  var rect = canvasDom.getBoundingClientRect();
  return {
    x: touchEvent.touches[0].clientX - rect.left,
    y: touchEvent.touches[0].clientY - rect.top,
  };
}

function displayAlertType0() {
  if (!hasCreated) {
    alert('Please create/join/sync a project.');
  } else {
    alert('Please wait for synchronization.');
  }
}

function isInRect(startX, startY, item) {
  if (item === null) {
    return false;
  }
  let inRangeX = startX > item.startX && startX < item.endX;
  let inRangeY = startY > item.startY && startY < item.endY;
  return inRangeX && inRangeY;
}

function mouseDown(e) {
  startX = e.offsetX;
  startY = e.offsetY;
  let rectIndex = -1;
  for (let i = rectList.length - 1; i >= 0; i--) {
    if (isInRect(startX, startY, rectList[i])) {
      rectIndex = i;
      break;
    }
  }
  if (rectIndex != -1) {
    currentRect = rectList[rectIndex];
    isDragging = true;
    return;
  }
  for (let item in Object.values(rectDictTemp)) {
    if (isInRect(startX, startY, item)) {
      currentRect = item;
      isDragging = true;
      return;
    }
  }
  isDrawing = true;
}

function mouseMove(e) {
  endX = e.offsetX;
  endY = e.offsetY;
  const w = endX - startX;
  const h = endY - startY;
  if (isDragging) {
    startX = endX;
    startY = endY;
    currentRect.startX += w;
    currentRect.endX += w;
    currentRect.startY += h;
    currentRect.endY += h;
  } else if (isDrawing) {
    if (Math.abs(w) > 0 && Math.abs(h) > 0 && !createRec) {
      let index = rectList.length + Object.keys(rectDictTemp).length;
      let color = colors[randomFromTo(0, 8)];
      let sX = startX < endX ? startX : endX;
      let eX = startX < endX ? endX : startX;
      let sY = startY < endY ? startY : endY;
      let eY = startY < endY ? endY : startY;
      currentRect = new Rect(index, sX, eX, sX, eX, color, false);
      rectDictTemp[index.toString()] = currentRect;
      repeatRequests[index.toString()] = {
        id: projectID,
        index: index,
        type: 'ADD',
        index: index,
        startX: startX,
        startY: startY,
        color: color,
      };
      createRec = true;
    } else if (createRec) {
      currentRect.startX = startX < endX ? startX : endX;
      currentRect.endX = startX < endX ? endX : startX;
      currentRect.startY = startY < endY ? startY : endY;
      currentRect.endY = startY < endY ? endY : startY;
    }
  }
  if (currentRect && currentRect.added && (isDragging || isDrawing)) {
    requests[currentRect.index.toString()] = {
      id: projectID,
      index: currentRect.index,
      type: 'REC_C',
      startX: currentRect.startX,
      endX: currentRect.endX,
      startY: currentRect.startY,
      endY: currentRect.endY,
      color: currentRect.color,
    };
  }
}

function mouseUp(e) {
  if (currentRect && currentRect.added) {
    repeatRequests[currentRect.index.toString()] = {
      id: projectID,
      index: currentRect.index,
      type: 'REC_C_A',
      startX: currentRect.startX,
      endX: currentRect.endX,
      startY: currentRect.startY,
      endY: currentRect.endY,
      color: currentRect.color,
    };
  }
  if (isDrawing && !createRec) {
    currentRect = null;
  }
  isDrawing = false;
  isDragging = false;
  createRec = false;
}

function deleteRect() {
  if (currentRect) {
    let index = currentRect.index;
    if (index < rectList.length) {
      rectList[index] = null;
    } else {
      delete rectDictTemp[index.toString()];
    }
    repeatRequests[currentRect.index.toString()] = {
      id: projectID,
      index: currentRect.index,
      type: 'REC_D_A',
    };
    currentRect = null;
  }
}

function drawRects() {
  clearCanvas();
  for (let rect of Object.values(rectDictTemp)) {
    if (rect) {
      drawRect(rect);
    }
  }
  for (let i = rectList.length - 1; i >= 0; i--) {
    let rect = rectList[i];
    if (rect) {
      drawRect(rect);
    }
  }
  window.requestAnimationFrame(drawRects);
}

function drawRect(rect) {
  context.globalAlpha = 0.3;
  context.beginPath();
  context.moveTo(rect.startX, rect.startY);
  context.lineTo(rect.endX, rect.startY);
  context.lineTo(rect.endX, rect.endY);
  context.lineTo(rect.startX, rect.endY);
  context.lineTo(rect.startX, rect.startY);
  context.fillStyle = rect.color;
  context.fill();
  if (rect === currentRect) {
    context.strokeStyle = 'black';
    context.stroke();
  }
}

function randomFromTo(from, to) {
  return Math.floor(Math.random() * (to - from + 1) + from);
}

function clearCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

// //Interval and render
// setInterval(() => {
//   drawRects();
// }, 15);

window.requestAnimationFrame(drawRects);
