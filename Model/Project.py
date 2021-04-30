import asyncio
import websockets
import json
import os
from os import path


class Project():
    '''
      webSocket as client key for requests
    '''

    def __init__(self, id):
        self.id = id
        self.rectList = []
        self.webSocketGroup = set()
        self.tempAddReqs = {}
        self.tempChangeReqs = {}
        self.tempDeleteReqs = {}
        self.clientsToRemove = set()
        self.freeze = False
        self.shouldClean = False

    def addUser(self, websocket):
        self.webSocketGroup.add(websocket)
        self.tempAddReqs[websocket] = []
        self.tempChangeReqs[websocket] = []
        self.tempDeleteReqs[websocket] = []

    async def sendMsg(self, websocket, message):
        try:
            await websocket.send(message)
        except Exception:
            print("client leaves in send")
            self.clientsToRemove.add(websocket)

    def removeClient(self, websocket):
        if websocket in self.webSocketGroup:
            self.clientsToRemove.add(websocket)

    def insertAddRecReq(self, websocket, obj):
        self.tempAddReqs[websocket].append(obj)

    def insertChangeRecReq(self, webSocket, obj):
        self.tempChangeReqs[webSocket].append(obj)

    def insertDeleteRecReq(self, websocket, obj):
        self.tempDeleteReqs[websocket].append(obj)

    async def handleDeleteReqs(self):
        for ws in self.tempDeleteReqs:
            for obj in self.tempDeleteReqs[ws]:
                data = self.transDelete(obj)
                if (data[0] < len(self.rectList)):
                    self.rectList[data[0]] = None
                for ws2 in self.tempDeleteReqs:
                    if (ws2 == ws):
                        await self.sendMsg(ws2, json.dumps(data[1]))
                    else:
                        await self.sendMsg(ws2, json.dumps(data[2]))
            self.tempDeleteReqs[ws] = []

    async def handleInsertReqs(self):
        start = len(self.rectList)
        for ws in self.tempAddReqs:
            for obj in self.tempAddReqs[ws]:
                obj["ack_index"] = start
                data = self.transAdd(obj)
                self.rectList.append(data[0])
                for ws2 in self.tempAddReqs:
                    if (ws2 == ws):
                        await self.sendMsg(ws2, json.dumps(data[1]))
                    else:
                        await self.sendMsg(ws2, json.dumps(data[2]))
                start = start + 1
            self.tempAddReqs[ws] = []

    async def handleChangeReqs(self):
        for ws in self.tempChangeReqs:
            for obj in self.tempChangeReqs[ws]:
                if (self.rectList[obj["index"]] != None):
                    data = self.transChange(obj)
                    self.rectList[obj["index"]] = data[0]
                    for ws2 in self.tempAddReqs:
                        if (ws2 == ws and obj["type"] == "REC_C_A"):
                            await self.sendMsg(ws2, json.dumps(data[1]))
                        elif ws2 != ws:
                            await self.sendMsg(ws2, json.dumps(data[2]))
            self.tempChangeReqs[ws] = []

    async def sendLen(self):
        for ws in self.webSocketGroup:
            await self.sendMsg(ws, json.dumps(
                {"type": "CK_L", "L": len(self.rectList)}))

    async def handleSending(self):
        await self.handleDeleteReqs()
        await self.handleInsertReqs()
        await self.handleChangeReqs()
        # await self.sendLen()
        self.cleanClients()

    def cleanClients(self):
        for websocket in self.clientsToRemove:
            self.webSocketGroup.remove(websocket)
            del self.tempAddReqs[websocket]
            del self.tempChangeReqs[websocket]
            del self.tempDeleteReqs[websocket]
        self.clientsToRemove = set()

    async def saveProject(self, websocket):
        try:
            file = open(path.join(os.getcwd(),
                                  "Data", self.id + ".json"), 'w')
            file.write(json.dumps(self.rectList))
            if (websocket != None):
                await self.sendMsg(websocket, json.dumps({"type": "ACK_SAVE"}))
        except FileNotFoundError as fe:
            print(fe)
        except OSError as oe:
            print(oe)
        except PermissionError as pe:
            print(pe)

    async def loadProject(self, websocket):
        try:
            file = open(path.join(os.getcwd(),
                                  "Data", self.id + ".json"), 'r')
            str = file.read()
            self.rectList = json.loads(str)
            await self.syncProcess(websocket)
        except FileNotFoundError as fe:
            print(fe)
        except OSError as oe:
            print(oe)
        except PermissionError as pe:
            print(pe)

    async def syncProcess(self, websocket):
        self.addUser(websocket)
        await self.sendMsg(websocket, json.dumps({"type": "SYNC", "id": self.id, "data": self.rectList}))
        self.freeze = True
        # Freeze when waiting for SYNC_ACK, 3S timeout
        asyncio.get_event_loop().call_later(3, self.unFreeze)

    def unFreeze(self):
        self.freeze = False

    def transAdd(self, obj):
        newObj = {}
        self.copyAttributesAdd(newObj, obj)
        ackMsg = {}
        ackMsg["type"] = "ACK_ADD"
        ackMsg["origin"] = obj["index"]
        ackMsg["ack"] = obj["ack_index"]
        addMsg = {}
        addMsg["type"] = "REC_S"
        self.copyAttributesAdd(addMsg, obj)
        return [newObj, ackMsg, addMsg]

    def transChange(self, obj):
        newObj = {}
        self.copyAttributes(newObj, obj)
        ackMsg = {}
        ackMsg["type"] = "ACK_CHANGE"
        ackMsg["ack"] = obj["index"]
        cMsg = {}
        cMsg["type"] = "REC_S"
        self.copyAttributes(cMsg, obj)
        return [newObj, ackMsg, cMsg]

    def transDelete(self, obj):
        delIndex = obj["index"]
        ackMsg = {"type": "ACK_DELETE", "index": delIndex}
        dMsg = {"type": "DELETE", "index": delIndex}
        return [delIndex, ackMsg, dMsg]

    def copyAttributesAdd(self, newObj, obj):
        newObj["index"] = obj["ack_index"]
        newObj["startX"] = obj["startX"]
        newObj["startY"] = obj["startY"]
        newObj["endX"] = obj["startX"]
        newObj["endY"] = obj["startY"]
        newObj["color"] = obj["color"]

    def copyAttributes(self, newObj, obj):
        newObj["index"] = obj["index"]
        newObj["startX"] = obj["startX"]
        newObj["startY"] = obj["startY"]
        newObj["endX"] = obj["endX"]
        newObj["endY"] = obj["endY"]
        newObj["color"] = obj["color"]
