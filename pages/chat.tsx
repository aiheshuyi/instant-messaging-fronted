import { useRouter } from "next/router"
import Image from "next/image"
import { MouseEvent, useCallback, useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"
import AiChatContent from "../components/AiChatContent"
import ChatContent from "../components/ChatContent"
import UserList from "../components/UserList"
import { changeName } from "../store/store"
import { routerBeforEach } from "../utils/router-beforEach"
import type { PresenceMap } from "../utils/presence"
import { isAiAssistant } from "../utils/aiAssistant"

export interface ChatMessage {
    id?: number
    sender: string
    content: string
    receiver: string
    createdAt?: string
}

function Chat() {
    const router = useRouter()
    const [isloading, setIsloading] = useState(true)
    const dispatch = useDispatch()
    const [currentUser, setCurrentUser] = useState('')
    const [currentUsername, setCurrentUsername] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [presenceMap, setPresenceMap] = useState<PresenceMap>({})
    const [sidebarWidth, setSidebarWidth] = useState(340)

    const startSidebarResize = useCallback((event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault()
        const startX = event.clientX
        const startWidth = sidebarWidth

        const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
            const nextWidth = Math.min(460, Math.max(280, startWidth + moveEvent.clientX - startX))
            setSidebarWidth(nextWidth)
        }

        const handleMouseUp = () => {
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }

        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }, [sidebarWidth])

    useEffect(() => {
        routerBeforEach(router)
        const username = localStorage.getItem('username')
        if (username) {
            setCurrentUsername(username)
            dispatch(changeName(username))
        }
    }, [dispatch, router])

    return (
        <Container>
            <div className="background" />
            <div className="brand">
                <span className="brandLogo">
                    <Image src="/favicon.ico" alt="Instant Messaging" width={28} height={28} />
                </span>
                <span>Instant Messaging</span>
            </div>
            <section className="chatScreen" style={{ gridTemplateColumns: `${sidebarWidth}px 6px minmax(0, 1fr)` }}>
                <UserList
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    presenceMap={presenceMap}
                    setPresenceMap={setPresenceMap}
                    currentUsername={currentUsername}
                />
                <div className="sidebarResizeHandle" onMouseDown={startSidebarResize} />
                {
                    isAiAssistant(currentUser) ?
                        <AiChatContent
                            currentUsername={currentUsername}
                            currentUserStatus="online"
                        />
                        :
                        <ChatContent
                            currentUser={currentUser}
                            setCurrentUser={setCurrentUser}
                            messages={messages}
                            setMessages={setMessages}
                            isloading={isloading}
                            setIsloading={setIsloading}
                            currentUserStatus={presenceMap[currentUser] || 'offline'}
                            currentUsername={currentUsername}
                        />
                }
            </section>
        </Container>
    )
}

const Container = styled.main`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 72px 28px 28px;
    overflow: hidden;
    background: #eef5f8;

    .background {
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
            linear-gradient(128deg, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0) 36%),
            linear-gradient(42deg, rgba(219, 242, 236, 0.76) 0%, rgba(219, 242, 236, 0) 42%),
            linear-gradient(156deg, rgba(227, 237, 252, 0.82) 0%, rgba(227, 237, 252, 0) 46%),
            linear-gradient(135deg, #edf5f7 0%, #f7fbfa 42%, #eef6f0 72%, #e9f1fb 100%);
    }

    .background::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
            linear-gradient(115deg, rgba(43, 91, 128, 0.055) 0 1px, transparent 1px 44px),
            linear-gradient(25deg, rgba(255, 255, 255, 0.62) 0 1px, transparent 1px 56px);
        background-size: 88px 88px, 112px 112px;
        opacity: 0.7;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.68), transparent 96%);
    }

    .background::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0) 34%),
            linear-gradient(0deg, rgba(68, 108, 135, 0.08), rgba(68, 108, 135, 0) 30%);
    }

    .brand {
        position: absolute;
        top: 24px;
        left: 28px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: #203650;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.72);
    }

    .brandLogo {
        width: 28px;
        height: 28px;
        display: inline-flex;
        overflow: hidden;
        border-radius: 8px;
        box-shadow: 0 10px 24px rgba(56, 85, 116, 0.18);
    }

    @media (max-width: 760px) {
        padding: 68px 16px 16px;

        .brand {
            top: 20px;
            left: 18px;
        }
    }

    .chatScreen {
        width: min(1180px, 100%);
        height: min(82vh, 800px);
        min-height: 560px;
        display: grid;
        overflow: hidden;
        border: 1px solid rgba(218, 232, 246, 0.82);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 28px 76px rgba(71, 101, 132, 0.18);
    }

    .sidebarResizeHandle {
        position: relative;
        z-index: 3;
        cursor: col-resize;
        background: #e2ebf5;
        transition: background 0.18s ease;
    }

    .sidebarResizeHandle:hover {
        background: #b7c9dd;
    }

    @media (max-width: 860px) {
        .chatScreen {
            height: auto;
            min-height: 0;
            grid-template-columns: 1fr !important;
        }

        .sidebarResizeHandle {
            display: none;
        }
    }
`

export default Chat
