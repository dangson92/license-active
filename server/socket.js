import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

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

        // Join admin room if user is admin - WITH JWT VERIFICATION
        socket.on('join-admin', (token) => {
            try {
                if (!token) {
                    console.warn('⚠️ Admin join attempt without token:', socket.id)
                    return
                }
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                if (decoded.role === 'admin') {
                    socket.join('admins')
                    console.log('👑 Admin joined:', socket.id, decoded.email)
                } else {
                    console.warn('⚠️ Non-admin tried to join admin room:', socket.id, decoded.email)
                }
            } catch (e) {
                console.warn('⚠️ Invalid token for admin join:', socket.id, e.message)
            }
        })

        // Join user room for personal notifications - WITH JWT VERIFICATION
        socket.on('join-user', (token) => {
            try {
                if (!token) {
                    console.warn('⚠️ User join attempt without token:', socket.id)
                    return
                }
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                if (decoded.id) {
                    socket.join(`user:${decoded.id}`)
                    console.log(`👤 User ${decoded.id} joined their room:`, socket.id)
                }
            } catch (e) {
                console.warn('⚠️ Invalid token for user join:', socket.id, e.message)
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

