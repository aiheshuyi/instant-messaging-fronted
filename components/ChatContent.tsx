import axios from 'axios'
import { KeyboardEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import Image from 'next/image'
import styled from 'styled-components'
import chatbgc from '../public/pictures/chat.png'
import { httpHost } from '../network/index'
import { Avatar, notification, Spin } from 'antd'
import { getSocket } from '../network/socket'
import type { ChatMessage } from '../pages/chat'
import { getStatusMeta, type UserStatus } from '../utils/presence'
import { AI_ASSISTANT_AVATAR, AI_ASSISTANT_NAME, isAiAssistant } from '../utils/aiAssistant'

interface ChatUser {
  username: string
  avatar?: string
}

interface ChatContentProps {
  currentUser: string
  setCurrentUser: (user: string) => void
  messages: ChatMessage[]
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  isloading: boolean
  setIsloading: (loading: boolean) => void
  currentUserStatus: UserStatus
  currentUsername: string
}

export default function ChatContent({
  currentUser,
  messages,
  setMessages,
  isloading,
  setIsloading,
  currentUserStatus,
  currentUsername
}: ChatContentProps) {
  const input = useRef<HTMLTextAreaElement>(null)
  const chatScreen = useRef<HTMLDivElement>(null)
  const chatContent = useRef<HTMLDivElement>(null)
  const shouldStickToBottom = useRef(false)
  const [sending, setSending] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [showNoMore, setShowNoMore] = useState(false)
  const [users, setUsers] = useState<ChatUser[]>([])
  const [editorHeight, setEditorHeight] = useState(156)
  const aiReplyIndex = useRef<number | null>(null)

  const scrollToBottom = useCallback(() => {
    if (chatScreen.current) {
      chatScreen.current.scrollTop = chatScreen.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    if (!shouldStickToBottom.current || isloading || loadingOlder) {
      return
    }

    shouldStickToBottom.current = false
    requestAnimationFrame(() => {
      scrollToBottom()
      window.setTimeout(scrollToBottom, 0)
    })
  }, [isloading, loadingOlder, messages, scrollToBottom])

  const loadMessages = useCallback(async (nextPage: number, mode: 'replace' | 'prepend') => {
    if (!currentUsername || !currentUser) {
      setMessages([])
      setHasMore(false)
      setIsloading(false)
      return
    }

    const chatElement = chatScreen.current
    const previousHeight = chatElement?.scrollHeight || 0

    if (mode === 'replace') {
      setIsloading(true)
    } else {
      setLoadingOlder(true)
    }

    try {
      const res = await axios.get(`${httpHost}messages`, {
        params: {
          sender: currentUsername,
          receiver: currentUser,
          page: nextPage,
          pageSize: 20
        }
      })
      const messageList = res.data?.data?.messageList || []

      setPage(nextPage)
      setHasMore(Boolean(res.data?.data?.hasMore))
      setShowNoMore(false)

      if (mode === 'prepend') {
        setMessages(prevMessages => [...messageList, ...prevMessages])
        window.setTimeout(() => {
          if (chatElement) {
            chatElement.scrollTop = chatElement.scrollHeight - previousHeight
          }
        }, 0)
      } else {
        shouldStickToBottom.current = true
        setMessages(messageList)
      }
    } finally {
      setIsloading(false)
      setLoadingOlder(false)
    }
  }, [currentUser, currentUsername, setIsloading, setMessages])

  useEffect(() => {
    axios.post(`${httpHost}user/all`).then(res => {
      setUsers(res.data || [])
    })
  }, [])

  useEffect(() => {
    setPage(1)
    setHasMore(false)
    setShowNoMore(false)
    if (currentUser && currentUsername) {
      loadMessages(1, 'replace')
    } else {
      setMessages([])
      setIsloading(false)
    }
  }, [currentUser, currentUsername, loadMessages, setIsloading, setMessages])

  useEffect(() => {
    const socket = getSocket()
    socket.on('showMessage', () => {
      if (currentUser && currentUsername) {
        loadMessages(1, 'replace')
      }
    })

    return () => {
      socket.off('showMessage')
    }
  }, [currentUser, currentUsername, loadMessages])

  async function sendMessage() {
    const message = input.current?.value.trim() || ''

    if (!currentUser) {
      notification.warning({
        message: '请选择联系人',
        description: '先在左侧选择一个聊天对象'
      })
      return
    }

    if (!currentUsername) {
      notification.warning({
        message: '登录状态异常',
        description: '请重新登录后再发送消息'
      })
      return
    }

    if (!message) {
      return
    }

    if (message.length > 200) {
      notification.warning({
        message: '消息过长',
        description: '单条消息不能超过 200 个字符'
      })
      return
    }

    setSending(true)
    try {
      if (isAiAssistant(currentUser)) {
        await sendAiMessage(message)
        return
      }

      await axios.post(`${httpHost}message/send`, {
        sender: currentUsername,
        content: message,
        receiver: currentUser
      })

      shouldStickToBottom.current = true
      setMessages(prevMessages => [
        ...prevMessages,
        {
          sender: currentUsername,
          receiver: currentUser,
          content: message,
          createdAt: new Date().toISOString()
        }
      ])
      getSocket().emit('sendMessage', {
        to: currentUser
      })
      if (input.current) {
        input.current.value = ''
      }
    } finally {
      setSending(false)
    }
  }

  async function sendAiMessage(message: string) {
    shouldStickToBottom.current = true
    aiReplyIndex.current = null
    setMessages(prevMessages => {
      const nextMessages = [
        ...prevMessages,
        {
          sender: currentUsername,
          receiver: AI_ASSISTANT_NAME,
          content: message,
          createdAt: new Date().toISOString()
        },
        {
          sender: AI_ASSISTANT_NAME,
          receiver: currentUsername,
          content: 'Deepseek 正在思考...',
          createdAt: new Date().toISOString()
        }
      ]
      aiReplyIndex.current = nextMessages.length - 1
      return nextMessages
    })

    if (input.current) {
      input.current.value = ''
    }

    const response = await fetch(`${httpHost}ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify({
        username: currentUsername,
        content: message
      })
    })

    if (!response.body) {
      updateAiReply('AI 回复失败，请稍后再试。', true)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let firstChunk = true

    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const eventText of events) {
        const eventName = eventText.match(/^event:\s*(.+)$/m)?.[1]
        const dataText = eventText.match(/^data:\s*(.+)$/m)?.[1]

        if (!eventName || !dataText) {
          continue
        }

        const data = JSON.parse(dataText)
        if (eventName === 'message') {
          updateAiReply(data, firstChunk)
          firstChunk = false
        }
        if (eventName === 'error') {
          updateAiReply(data, true)
        }
      }
    }
  }

  function updateAiReply(content: string, replace = false) {
    shouldStickToBottom.current = true
    setMessages(prevMessages => {
      const targetIndex = aiReplyIndex.current
      if (targetIndex === null || !prevMessages[targetIndex]) {
        return prevMessages
      }

      return prevMessages.map((message, index) => {
        if (index !== targetIndex) {
          return message
        }

        return {
          ...message,
          content: replace ? content : `${message.content}${content}`
        }
      })
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  function startEditorResize(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    const container = chatContent.current
    if (!container) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const nextHeight = Math.min(300, Math.max(112, containerRect.bottom - moveEvent.clientY))
      setEditorHeight(nextHeight)
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function handleMessageScroll() {
    if (!chatScreen.current || isloading || loadingOlder || messages.length === 0) {
      return
    }

    if (chatScreen.current.scrollTop <= 24) {
      if (hasMore) {
        loadMessages(page + 1, 'prepend')
      } else {
        setShowNoMore(true)
      }
    }
  }

  function formatTime(time?: string) {
    if (!time) {
      return ''
    }

    return new Date(time).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getUserAvatar(username: string) {
    if (isAiAssistant(username)) {
      return AI_ASSISTANT_AVATAR
    }

    return users.find(user => user.username === username)?.avatar
  }

  const currentStatusMeta = getStatusMeta(currentUserStatus)

  return (
    <Container>
      <div className='chatbgc'>
        <Image src={chatbgc} alt="" layout='fill' objectFit='cover' />
      </div>
      {
        currentUser === '' ?
          <div className='emptyState'>
            <div className='emptyLogo'>
              <Image src="/favicon.ico" alt="Instant Messaging" width={86} height={86} />
            </div>
          </div>
          :
          <div
            className='chatContent'
            ref={chatContent}
            style={{ gridTemplateRows: `auto minmax(0, 1fr) 6px ${editorHeight}px` }}
          >
            <div className='chatHeader'>
              <div className='chatTitleLine'>
                <h2>{currentUser}</h2>
                <p className={`statusLine ${currentStatusMeta.className}`}>
                  <i />
                  {currentStatusMeta.label}
                </p>
              </div>
            </div>

            <div className="content" ref={chatScreen} onScroll={handleMessageScroll}>
              {
                isloading ?
                  <Spin
                    size='large'
                    className='loading'
                    tip="正在加载对话..."
                  />
                  :
                  messages.length === 0 ?
                    <div className='noMessages'>还没有消息，发一句开场白吧。</div>
                    :
                    <>
                      {
                        loadingOlder ?
                          <div className='historyHint'>正在加载更早的消息...</div>
                          :
                          showNoMore ?
                            <div className='historyHint'>没有更早的消息了</div>
                            :
                            hasMore ?
                              <div className='historyHint'>向上滚动加载更多</div>
                              :
                              null
                      }
                      {
                        messages.map((message, index) => {
                          const isMine = message.sender === currentUsername
                          const avatar = getUserAvatar(message.sender)
                          return (
                            <div className={isMine ? 'messageRow mine' : 'messageRow'} key={message.id || `${message.sender}-${index}`}>
                              {
                                !isMine ?
                                  <Avatar className='messageAvatar' src={avatar}>
                                    {message.sender?.slice(0, 1).toUpperCase()}
                                  </Avatar>
                                  :
                                  null
                              }
                              <div className='bubble'>
                                <p>{message.content}</p>
                                <span>{formatTime(message.createdAt)}</span>
                              </div>
                              {
                                isMine ?
                                  <Avatar className='messageAvatar mineAvatar' src={avatar}>
                                    {message.sender?.slice(0, 1).toUpperCase()}
                                  </Avatar>
                                  :
                                  null
                              }
                            </div>
                          )
                        })
                      }
                    </>
              }
            </div>
            <div className="editorResizeHandle" onMouseDown={startEditorResize} />
            <div className="sender">
              <div className="composerBox">
                <textarea
                  ref={input}
                  className='input'
                  maxLength={200}
                  placeholder='输入消息，Enter 发送，Shift + Enter 换行'
                  onKeyDown={handleKeyDown}
                />
                <button
                  className='send'
                  onClick={() => { sendMessage() }}
                  disabled={sending}
                >
                  {sending ? '发送中' : '发送'}
                </button>
              </div>
            </div>
          </div>
      }
    </Container>
  )
}

const Container = styled.section`
  position: relative;
  min-width: 0;
  height: 100%;
  overflow: hidden;

  .chatbgc {
    position: absolute;
    inset: 0;
    z-index: 0;
    opacity: 0.16;
  }

  .emptyState {
    position: relative;
    z-index: 1;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at 50% 42%, rgba(70, 132, 210, 0.08), transparent 28%),
      linear-gradient(145deg, #f8fbff, #edf3f9);
  }

  .emptyLogo {
    width: 86px;
    height: 86px;
    display: inline-flex;
    overflow: hidden;
    border-radius: 18px;
    opacity: 0.16;
    filter: grayscale(1) saturate(0.35);
  }

  .chatContent {
    position: relative;
    z-index: 1;
    height: 100%;
    display: grid;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(245, 249, 252, 0.86));
  }

  .chatHeader {
    display: flex;
    justify-content: flex-start;
    gap: 16px;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid #e2ebf5;
    background: rgba(255, 255, 255, 0.92);
  }

  .chatHeader h2 {
    margin: 0;
    color: #132033;
    font-size: 22px;
    word-break: break-all;
  }

  .chatTitleLine {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .statusLine {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    min-width: 74px;
    height: 30px;
    justify-content: center;
    margin: 0;
    padding: 0 13px;
    border: 1px solid #d3edf0;
    border-radius: 999px;
    background: #f0fbfb;
    font-size: 14px;
    font-weight: 700;
  }

  .statusLine i {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: currentColor;
  }

  .statusOnline {
    color: #1d8c61;
    border-color: #d3edf0;
    background: #f0fbfb;
  }

  .statusBusy {
    color: #c54747;
    border-color: #f5d7d7;
    background: #fff5f5;
  }

  .statusDnd {
    color: #d84e6a;
    border-color: #ffd5df;
    background: #fff3f6;
  }

  .statusAway {
    color: #a66b14;
    border-color: #f3e4c4;
    background: #fff9ec;
  }

  .statusOffline {
    color: #7a8494;
    border-color: #dfe5ee;
    background: #f6f8fb;
  }

  .content {
    min-height: 0;
    padding: 18px 28px 26px;
    overflow-y: auto;
    overflow-x: hidden;
    overflow-anchor: none;
  }

  .content::-webkit-scrollbar {
    width: 4px;
  }

  .content::-webkit-scrollbar-thumb {
    background: #c4d1e3;
    border-radius: 99px;
  }

  .loading {
    width: 100%;
    margin-top: 18vh;
  }

  .historyHint,
  .noMessages {
    margin: 8px auto 18px;
    width: fit-content;
    max-width: 90%;
    padding: 8px 12px;
    border-radius: 999px;
    color: #68788e;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 8px 22px rgba(38, 54, 79, 0.08);
    font-size: 13px;
  }

  .noMessages {
    margin-top: 18vh;
    border-radius: 8px;
    padding: 14px 18px;
    font-size: 14px;
  }

  .messageRow {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    justify-content: flex-start;
    margin-bottom: 12px;
  }

  .messageRow.mine {
    justify-content: flex-end;
  }

  .messageAvatar {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    color: #315d95;
    background: #d9e6f7;
    font-weight: 800;
    box-shadow: 0 6px 16px rgba(36, 55, 84, 0.08);
  }

  .mineAvatar {
    color: #ffffff;
    background: #2f6db2;
  }

  .bubble {
    max-width: min(520px, 78%);
    padding: 12px 15px 8px;
    border-radius: 8px;
    color: #162034;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 24px rgba(36, 55, 84, 0.1);
  }

  .mine .bubble {
    color: #ffffff;
    background: linear-gradient(135deg, #2d73bd, #2f8fbc);
  }

  .bubble p {
    margin: 0;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .bubble span {
    display: block;
    min-height: 16px;
    margin-top: 4px;
    color: #8794a8;
    font-size: 12px;
    text-align: right;
  }

  .mine .bubble span {
    color: rgba(255, 255, 255, 0.72);
  }

  .sender {
    min-height: 0;
    padding: 14px 18px 18px;
    background: rgba(255, 255, 255, 0.94);
  }

  .editorResizeHandle {
    position: relative;
    z-index: 2;
    height: 6px;
    cursor: row-resize;
    background: #e2ebf5;
    transition: background 0.18s ease;
  }

  .editorResizeHandle:hover {
    background: #b7c9dd;
  }

  .composerBox {
    position: relative;
    height: 100%;
  }

  .input {
    width: 100%;
    height: 100%;
    resize: none;
    border: 1px solid #d5e1ee;
    border-radius: 8px;
    padding: 12px 124px 56px 14px;
    color: #162034;
    background: #fbfdff;
    line-height: 1.6;
  }

  .input:focus {
    outline: none;
    border-color: #2d6fb7;
    box-shadow: 0 0 0 3px rgba(45, 111, 183, 0.12);
  }

  .send {
    position: absolute;
    right: 14px;
    bottom: 14px;
    width: 88px;
    height: 44px;
    border: 0;
    border-radius: 8px;
    color: #ffffff;
    background: #2d73bd;
    font-weight: 700;
    cursor: pointer;
  }

  .send:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }

  @media (max-width: 860px) {
    min-height: 560px;

    .chatContent {
      grid-template-rows: auto 360px 6px 150px !important;
    }

    .send {
      width: 82px;
    }
  }
`
