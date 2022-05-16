import asyncio
import websockets
import json
import os
import time
from os import path

from Model.Project import Project

tempProjects = {}
tempClean = {}


async def recv_msg(websocket):
    while True:
        recv_text = await websocket.recv()
        print(recv_text)
        obj = json.loads(recv_text)
        if (obj["type"] == "CREATE"):
            await handleCreate(websocket, obj)
        if (obj["type"] == "ADD"):
            handleAdd(websocket, obj)
        if (obj["type"] == "REC_C"):
            handleRecChange(websocket, obj)
        if (obj["type"] == "REC_C_A"):
            handleRecChange(websocket, obj)
        if (obj["type"] == "REC_D_A"):
            handleRecDelete(websocket, obj)
        if (obj["type"] == "JOIN"):
            await handleJoin(websocket, obj)
        if (obj["type"] == "SAVE"):
            await handleSave(websocket, obj)
        if (obj["type"] == "SYNC_ACK"):
            handleSyncAck(websocket, obj)
        await sending(obj)


async def handleSave(webSocket, obj):
    id = obj["id"]
    p = tempProjects[id]
    if p.freeze:
        return
    await p.saveProject(webSocket)


def handleSyncAck(webSocket, obj):
    id = obj["id"]
    p = tempProjects[id]
    p.freeze = False


async def handleCreate(websocket, obj):
    id = obj["id"]
    # print(os.getcwd())
    if os.path.exists(path.join(os.getcwd(), "Data", id + ".json")) or id in tempProjects:
        await websocket.send(json.dumps({"type": "FAIL_CREATE"}))
    else:
        p = Project(id)
        tempProjects[id] = p
        tempProjects[id].addUser(websocket)
        await websocket.send(json.dumps({"type": "ACK_CREATE", "id": id}))


async def handleJoin(websocket, obj):
    id = obj["id"]
    print(os.getcwd())
    if id in tempProjects:
        p = tempProjects[id]
        if p.freeze:
            return
        await p.syncProcess(websocket)
    elif (id + ".json") in os.listdir(path.join(os.getcwd(), "Data")):
        p = Project(id)
        tempProjects[id] = p
        await p.loadProject(websocket)
    else:
        await websocket.send(json.dumps({"type": "FAIL_JOIN"}))


def handleAdd(websocket, obj):
    id = obj["id"]
    p = tempProjects[id]
    if (p.freeze):
        return
    p.insertAddRecReq(websocket, obj)


def handleRecChange(websocket, obj):
    id = obj["id"]
    p = tempProjects[id]
    if (p.freeze):
        return
    p.insertChangeRecReq(websocket, obj)


def handleRecDelete(websocket, obj):
    id = obj["id"]
    p = tempProjects[id]
    if (p.freeze):
        return
    p.insertDeleteRecReq(websocket, obj)


async def sending(obj):
    id = obj["id"]
    if id in tempProjects:
        p = tempProjects[id]
        await p.handleSending()

'''
    schedule clean memory every 10 mins, temp memory will keep 1 hour 
'''


async def scheduleClean():
    for id in tempProjects:
        tempProjects[id].cleanClients()
        if (not tempProjects[id].webSocketGroup):
            if (not id in tempClean):
                tempClean[id] = asyncio.get_event_loop(
                ).call_later(60 * 60, delTemp, id)
        elif id in tempClean:
            tempClean[id].cancel()
            del tempClean[id]
    await asyncio.sleep(10 * 60)
    return (await scheduleClean())


def delTemp(id):
    print("del temp project", id)
    if (id in tempProjects and not tempProjects[id].webSocketGroup):
        tempProjects[id].saveProject(None)
        del tempProjects[id]


async def main_logic(websocket, path):
    try:
        await recv_msg(websocket)
    except Exception as e:
        print("client leaves in recv")
        for p in tempProjects.values():
            p.removeClient(websocket)

start_server = websockets.serve(main_logic, '0.0.0.0/ws', 9000)


asyncio.get_event_loop().run_until_complete(
    asyncio.gather(start_server, scheduleClean()))
asyncio.get_event_loop().run_forever()
