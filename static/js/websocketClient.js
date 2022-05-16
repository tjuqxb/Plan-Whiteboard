let ws = new WebSocket('wss://Plan-Whiteboard.tjuqxb.repl.co');
function WebSocketTest() {
  if ('WebSocket' in window) {
    alert('support WebSocket!');
    ws.onopen = function () {
      console.log('opened');
    };
    ws.onclose = function () {
      alert('Please refresh page and rejoin.');
    };
    ws.onerror = function () {
      alert('Please refresh page and rejoin.');
    };
  } else {
    alert('not support WebSocket!');
  }
}

ws.onmessage = function (evt) {
  var received_msg = evt.data;
  //console.log(received_msg);
  let msg = JSON.parse(received_msg);
  console.log(msg);
  switch (msg.type) {
    case 'ACK_ADD':
      handleAckAdd(msg);
      break;
    case 'ACK_CHANGE':
      handleAckChange(msg);
      break;
    case 'ACK_DELETE':
      handleAckDelete(msg);
      break;
    case 'DELETE':
      handleDelete(msg);
      break;
    case 'FAIL_CREATE':
      alert('Create project failed, try a diffrent name');
      break;
    case 'FAIL_JOIN':
      alert('Join/retrieve project failed, please try again');
      break;
    case 'SYNC':
      handleSync(msg);
      break;
    case 'ACK_CREATE':
      handleAckCreate(msg);
      break;
    case 'CK_L':
      serverLen = msg.L;
      break;
    case 'REC_S':
      handleChangeRec(msg);
      break;
    case 'ACK_SAVE':
      alert('Save success!');
      break;
  }
};

ws.onclose = function () {
  alert('Please refresh page and rejoin.');
};
ws.onerror = function () {
  alert('Please refresh page and rejoin.');
};

function handleSync(msg) {
  rectList = msg.data;
  console.log('SYNC_ACK');
  ws.send(JSON.stringify({ type: 'SYNC_ACK', id: msg.id }));
  for (let i = 0; i < rectList.length; i++) {
    if (rectList[i]) {
      rectList[i].added = true;
    }
  }
  handleAckCreate(msg);
}

function handleAckChange(msg) {
  delete repeatRequests[msg.ack.toString()];
}

function handleAckDelete(msg) {
  delete repeatRequests[msg.index.toString()];
}

function handleDelete(msg) {
  if (msg.index < rectList.length) {
    rectList[msg.index] = null;
  }
}

function handleAckAdd(msg) {
  rectDictTemp[msg.origin.toString()].added = true;
  let rect = rectDictTemp[msg.origin.toString()];
  delete rectDictTemp[msg.origin.toString()];
  delete repeatRequests[msg.origin.toString()];
  if (msg.origin !== msg.ack) {
    rect.index = msg.ack;
  }
  addToRectList(rect);
}

function addToRectList(rect) {
  let index = rect.index;
  if (rectList.length - 1 >= index) {
    rectList[index] = rect;
  } else {
    for (let i = rectList.length; i < index; i++) {
      rectList.push(null);
    }
    rectList[index] = rect;
  }
}

function handleChangeRec(msg) {
  let rec = {};
  rec.index = msg.index;
  rec.startX = msg.startX;
  rec.endX = msg.endX;
  rec.startY = msg.startY;
  rec.endY = msg.endY;
  rec.color = msg.color;
  rec.added = true;
  addToRectList(rec);
}

function create() {
  let name = document.querySelector('#project-name').value;
  if (name === '') {
    alert('Please input a name');
  } else {
    ws.send(JSON.stringify({ type: 'CREATE', id: name }));
  }
}

function handleAckCreate(msg) {
  lock = false;
  hasCreated = true;
  projectID = msg.id;
  document.querySelector('#project-name').value = projectID;
  document.querySelector('#project-name').setAttribute('disabled', 'true');
  document.querySelector('#save').disabled = false;
  alert('Create/join success!');
}

function save() {
  ws.send(JSON.stringify({ type: 'SAVE', id: projectID }));
}

function sendCommands() {
  for (let request of Object.values(repeatRequests)) {
    ws.send(JSON.stringify(request));
  }
  for (let request of Object.values(requests)) {
    ws.send(JSON.stringify(request));
  }
  requests = {};
}

function join() {
  let name = document.querySelector('#project-name').value;
  if (name === '') {
    alert('Please input a name');
  } else {
    ws.send(JSON.stringify({ type: 'JOIN', id: name }));
  }
}

//Interval and send
setInterval(() => sendCommands(), 200);
