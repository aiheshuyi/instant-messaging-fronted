import { io, Socket } from 'socket.io-client'
import { wsHOST } from './index'

let socket: Socket | null = null

export function getSocket() {
    if (!socket) {
        socket = io(wsHOST, {
            autoConnect: true,
        })
    }

    return socket
}
