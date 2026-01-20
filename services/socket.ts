import { io, Socket } from 'socket.io-client';
import { config } from '../config';

let socket: Socket | null = null;

export const initSocket = (): Socket => {
    if (socket) return socket;

    // Connect to the API server with Socket.IO
    // Get the base URL (without /api path if present)
    let baseUrl = config.apiUrl;
    if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
    }

    console.log('🔌 Connecting to socket:', baseUrl);

    // Socket.io-client handles ws/wss protocol automatically
    socket = io(baseUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
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
    if (!socket) {
        console.warn('👑 Cannot join admin room: socket not initialized');
        return;
    }

    if (!socket.connected) {
        console.warn('👑 Socket not connected yet, will join admin room when connected');
        // Socket will auto-join when connected via 'connect' event handler
        return;
    }

    socket.emit('join-admin');
    console.log('👑 Joined admin room, socket id:', socket.id);
};

export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const joinUserRoom = (userId: number): void => {
    if (!socket) {
        console.warn('👤 Cannot join user room: socket not initialized');
        return;
    }

    if (!socket.connected) {
        console.warn('👤 Socket not connected yet, will join user room when connected');
        return;
    }

    socket.emit('join-user', userId);
    console.log(`👤 Joined user room ${userId}, socket id:`, socket.id);
};

export default { initSocket, getSocket, joinAdminRoom, joinUserRoom, disconnectSocket };
