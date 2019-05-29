const socket = new WebSocket('ws://localhost:7000');

//TODO reload on message. 
socket.addEventListener('close', () => location.reload(true));