import { Server } from 'socket.io'

let io = null

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: [
                process.env.FRONTEND_URL || 'https://license.dangthanhson.com',
                'http://localhost:3000',
                'http://localhost:5173'
            ],
            methods: ['GET', 'POST'],
            credentials: true
        }
    })

    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id)

        // Join admin room if user is admin
        socket.on('join-admin', () => {
            socket.join('admins')
            console.log('👑 Admin joined:', socket.id)
        })

        // Join user room for personal notifications
        socket.on('join-user', (userId) => {
            if (userId) {
                socket.join(`user:${userId}`)
                console.log(`👤 User ${userId} joined their room:`, socket.id)
            }
        })

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id)
        })
    })

    console.log('✅ Socket.IO initialized')
    return io
}

export const getIO = () => {
    if (!io) {
        console.warn('Socket.IO not initialized yet')
    }
    return io
}

// Emit notification to all admins
export const emitToAdmins = (event, data) => {
    if (io) {
        io.to('admins').emit(event, data)
        console.log(`📤 Emitted ${event} to admins:`, data.title || data)
    }
}

// Emit notification to a specific user
export const emitToUser = (userId, event, data) => {
    if (io && userId) {
        io.to(`user:${userId}`).emit(event, data)
        console.log(`📤 Emitted ${event} to user ${userId}:`, data.title || data)
    }
}

export default { initSocket, getIO, emitToAdmins, emitToUser }

