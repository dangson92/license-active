import { io, Socket } from 'socket.io-client';
import { config } from '../config';

let socket: Socket | null = null;

export const initSocket = (): Socket => {
    if (socket) return socket;

    // Connect to the API server with Socket.IO
    const socketUrl = config.apiUrl.replace('/api', '').replace('http://', 'ws://').replace('https://', 'wss://');

    socket = io(config.apiUrl.replace('/api', ''), {
        transports: ['websocket', 'polling'],
        autoConnect: true,
    });

    socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket?.id);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('🔌 Socket connection error:', error.message);
    });

    return socket;
};

export const getSocket = (): Socket | null => {
    return socket;
};

export const joinAdminRoom = (): void => {
    if (socket && socket.connected) {
        socket.emit('join-admin');
        console.log('👑 Joining admin room');
    }
};

export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export default { initSocket, getSocket, joinAdminRoom, disconnectSocket };
