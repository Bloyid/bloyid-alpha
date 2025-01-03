const socket = io();

const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const usernameInput = document.getElementById('username-input');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');
const userListContainer = document.getElementById('user-list');
const pingSound = new Audio('sounds/ping.mp3');

const dmContainer = document.getElementById('dm-container');
const dmRecipient = document.getElementById('dm-recipient');
const closeDmButton = document.getElementById('close-dm');
const dmMessageInput = document.getElementById('dm-message-input');
const dmSendButton = document.getElementById('dm-send-button');
const dmMessagesContainer = document.getElementById('dm-messages');

let username = '';
let currentDmRecipient = '';

chatContainer.style.display = 'none';
dmContainer.style.display = 'none';

// login handlers
loginButton.addEventListener('click', handleLogin);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});

function handleLogin() {
    const desiredUsername = usernameInput.value.trim();
    if (desiredUsername !== '') {
        socket.emit('login', desiredUsername);
    }
}

socket.on('loginSuccess', (user) => {
    username = user;
    loginContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    messageInput.focus();
});

socket.on('loginError', () => {
    loginError.style.display = 'block';
});

function checkForMentions(message) {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(message)) !== null) {
        mentions.push(match[1]);
    }
    
    return mentions;
}

// chat message handlers
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});


function sendMessage() {
    const message = messageInput.value.trim();
    if (message !== '') {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const mentions = checkForMentions(message);
        
        socket.emit('chatMessage', { 
            username, 
            message, 
            timestamp,
            mentions 
        });
        
        messageInput.value = '';
    }
}

socket.on('message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    const isMentioned = data.mentions && data.mentions.includes(username);
    
    if (isMentioned) {
        messageElement.classList.add('mentioned');
        if (data.username !== username) {
            pingSound.play().catch(err => console.log('Error playing sound:', err));
        }
    }
    
    let formattedMessage = data.message.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    
    messageElement.innerHTML = `
        <div class="message-header">
            <strong>${data.username}</strong> • <span>${data.timestamp}</span>
        </div>
        <div class="message-content ${isMentioned ? 'mentioned' : ''}">${formattedMessage}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// user list handlers
socket.on('updateUserList', (users) => {
    userListContainer.innerHTML = '';
    users.forEach(user => {
        if (user !== username) {  // this will prevent from you showing up in the list
            const userElement = document.createElement('div');
            userElement.textContent = user;
            userElement.addEventListener('click', () => openDmChat(user));
            userListContainer.appendChild(userElement);
        }
    });
});

// dm handlers
function openDmChat(recipient) {
    currentDmRecipient = recipient;
    dmRecipient.textContent = recipient;
    chatContainer.style.display = 'none';
    dmContainer.style.display = 'flex';
    dmMessagesContainer.innerHTML = '';
    socket.emit('getDmHistory', { recipient });
    dmMessageInput.focus();
}

closeDmButton.addEventListener('click', () => {
    dmContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    currentDmRecipient = '';
    messageInput.focus();
});

dmSendButton.addEventListener('click', sendDmMessage);
dmMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendDmMessage();
    }
});

function sendDmMessage() {
    const message = dmMessageInput.value.trim();
    if (message !== '' && currentDmRecipient) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        socket.emit('dmMessage', {
            to: currentDmRecipient,
            message,
            timestamp
        });
        
        dmMessageInput.value = '';
    }
}

socket.on('dmMessage', (data) => {
    if ((data.sender === currentDmRecipient) || (data.receiver === currentDmRecipient)) {
        addDmMessage(data, data.sender === username);
    }
});

function addDmMessage(data, isSent) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('dm-message', isSent ? 'sent' : 'received');
    messageElement.innerHTML = `
        <div class="message-header">
            <strong>${isSent ? 'You' : data.sender}</strong> • <span>${data.timestamp}</span>
        </div>
        <div class="message-content">${data.message}</div>
    `;
    dmMessagesContainer.appendChild(messageElement);
    dmMessagesContainer.scrollTop = dmMessagesContainer.scrollHeight;
}

socket.on('dmHistory', (messages) => {
    dmMessagesContainer.innerHTML = '';
    messages.forEach(msg => {
        addDmMessage(msg, msg.sender === username);
    });
});

socket.on('previousMessages', (messages) => {
    messages.forEach(data => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.innerHTML = `
            <div class="message-header">
                <strong>${data.username}</strong> • <span>${data.timestamp}</span>
            </div>
            <div class="message-content">${data.message}</div>
        `;
        messagesContainer.appendChild(messageElement);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});