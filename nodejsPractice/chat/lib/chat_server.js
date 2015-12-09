/**
 * Created by hehui on 2015/12/8.
 *
 * 服务端的逻辑
 *
 */

var socketio = require('socket.io');
var io;
var guestNumber = 1; // 访客数
var nickNames = {}; // 存放用户昵称
var namesUsed = []; // 存放已经被占用的昵称
var currentRoom = {};

exports.listen = function(server) {
    // 启动Socket.IO服务器，允许它搭载在已有的HTTP 服务器上
    io = socketio.listen(server);
    io.set('log level', 1);
    // 定义每个用户连接的处理逻辑
    io.sockets.on('connection', function (socket) {
        // 在用户连接上来时赋予其一个访客名
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        // 在用户连接上来时把他放入聊天室Lobby里
        joinRoom(socket, 'Lobby');

        handleNameChangeAttempts(socket, nickNames, namesUsed); // 更名
        handleMessageBroadcasting(socket, nickNames); // 处理用户消息
        handleRoomJoining(socket); // 创建聊天室

        // 用户发出请求时，向其提供已经被占用的聊天室的列表
        socket.on('rooms', function() {
            socket.emit('rooms', io.sockets.manager.rooms);
        });
        // 定义用户断开连接后的清除逻辑
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
};

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber; // 生成新昵称
    nickNames[socket.id] = name; // 把用户昵称跟客户端连接ID关联上
    socket.emit('nameResult', { // 让用户知道他们的昵称
        success: true,
        name: name
    });
    namesUsed.push(name); // 存放已经被占用的昵称
    return guestNumber + 1;
}

// 与进入聊天室相关的逻辑
function joinRoom(socket, room) {
    socket.join(room); // 让用户进入房间
    currentRoom[socket.id] = room; // 记录用户的当前房间
    socket.emit('joinResult', {room: room});
    // 让房间里的其他用户知道有新用户进入了房间
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room + '.'
    });

    // 确定有哪些用户在这个房间里
    var usersInRoom = io.sockets.clients(room);
    // 如果不止一个用户在这个房间里，汇总下都是谁
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = 'Users currently in ' + room + ': ';
        for (var index in usersInRoom) {
            var userSocketId = usersInRoom[index].id;
            if (userSocketId != socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ', ';
                }
                usersInRoomSummary += nickNames[userSocketId];
            }
        }
        usersInRoomSummary += '.';
        // 将房间里其他用户的汇总发送给这个用户
        socket.emit('message', {text: usersInRoomSummary});
    }
}

// 更名请求的处理逻辑
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    // 添加nameAttempt事件的监听器
    socket.on('nameAttempt', function(name) {
        // 昵称不能以Guest开头
        if (name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: 'Names cannot begin with "Guest".'
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id] = name;
                delete namesUsed[previousNameIndex];
                socket.emit('nameResult', {
                    success: true,
                    name: name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                    text: previousName + ' is now known as ' + name + '.'
                });
            } else {
                socket.emit('nameResult', {
                    success: false,
                    message: 'That name is already in use.'
                });
            }
        }
    });
}

function handleMessageBroadcasting(socket) {
    socket.on('message', function (message) {
        socket.broadcast.to(message.room).emit('message', {
            text: nickNames[socket.id] + ': ' + message.text
        });
    });
}

function handleRoomJoining(socket) {
    socket.on('join', function(room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function() {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}
