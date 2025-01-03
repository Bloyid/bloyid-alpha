const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('.'));
app.use(express.json());

// in-memory storage
const users = new Set();
const messages = [];
const dmMessages = new Map(); // format: user1:user2 => messages[]

function getDmKey(user1, user2) {
    return [user1, user2].sort().join(':');
}

io.on('connection', (socket) => {
    console.log('A user connected');

    // login handler
    socket.on('login', (username) => {
        if (users.has(username)) {
            socket.emit('loginError');
        } else {
            users.add(username);
            socket.username = username;
            socket.emit('loginSuccess', username);
            
            // send previous messages
            if (messages.length > 0) {
                socket.emit('previousMessages', messages);
            }
            
            io.emit('updateUserList', Array.from(users));
            console.log(`${username} joined the chat`);
        }
    });

    // public chat message handlers
    socket.on('chatMessage', (data) => {
        messages.push(data);
        if (messages.length > 50) {
            messages.shift(); // keep last 50 (can be increased/decreased)
        }
        console.log(`Message from ${data.username}: ${data.message}`);
        io.emit('message', data);
    });

    // 
    // dm message handler
    socket.on('dmMessage', (data) => {
        const sender = socket.username;
        const receiver = data.to;
        
        if (sender && receiver) {
            const dmKey = getDmKey(sender, receiver);
            
            // Store message
            if (!dmMessages.has(dmKey)) {
                dmMessages.set(dmKey, []);
            }
            
            const messageData = {
                sender,
                receiver,
                message: data.message,
                timestamp: data.timestamp
            };
            
            dmMessages.get(dmKey).push(messageData);
            
            // limit stored messages
            if (dmMessages.get(dmKey).length > 50) {
                dmMessages.get(dmKey).shift();
            }
            
            const receiverSocket = Array.from(io.sockets.sockets.values())
                .find(s => s.username === receiver);
                
            if (receiverSocket && receiverSocket.id !== socket.id) {
                receiverSocket.emit('dmMessage', messageData);
            }

            if (sender !== receiver) {
                socket.emit('dmMessage', messageData);
            }
        }
    });

    // get dm history handler
    socket.on('getDmHistory', (data) => {
        const dmKey = getDmKey(socket.username, data.recipient);
        const history = dmMessages.get(dmKey) || [];
        socket.emit('dmHistory', history);
    });

    // disconnect handler
    socket.on('disconnect', () => {
        if (socket.username) {
            users.delete(socket.username);
            io.emit('updateUserList', Array.from(users));
            console.log(`${socket.username} left the chat`);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});