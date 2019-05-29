const socket = new WebSocket('ws://localhost:7000');
socket.addEventListener('close', () => location.reload(true));