import axios from 'axios'
import { KeyboardEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Avatar, notification, Spin } from 'antd'
import { httpHost } from '../network'
import { AI_ASSISTANT_AVATAR, AI_ASSISTANT_NAME } from '../utils/aiAssistant'
import { getStatusMeta, type UserStatus } from '../utils/presence'

interface AiConversation {
  id: number
  title: string
  createdAt?: string
  updatedAt?: string
  lastMessageAt?: string
}

interface AiMessage {
  id?: number
  conversationId?: number
  username?: string
  sender: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

interface AiChatContentProps {
  currentUsername: string
  currentUserStatus: UserStatus
}

export default function AiChatContent({ currentUsername, currentUserStatus }: AiChatContentProps) {
  const input = useRef<HTMLTextAreaElement>(null)
  const chatScreen = useRef<HTMLDivElement>(null)
  const chatContent = useRef<HTMLDivElement>(null)
  const shouldStickToBottom = useRef(false)
  const aiReplyIndex = useRef<number | null>(null)
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [editorHeight, setEditorHeight] = useState(156)
  const [editingConversationId, setEditingConversationId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AiConversation | null>(null)
  const [deletingConversation, setDeletingConversation] = useState(false)

  const currentStatusMeta = getStatusMeta(currentUserStatus)

  const scrollToBottom = useCallback(() => {
    if (chatScreen.current) {
      chatScreen.current.scrollTop = chatScreen.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    if (!shouldStickToBottom.current || loadingMessages) {
      return
    }

    shouldStickToBottom.current = false
    requestAnimationFrame(() => {
      scrollToBottom()
      window.setTimeout(scrollToBottom, 0)
    })
  }, [loadingMessages, messages, scrollToBottom])

  const loadConversations = useCallback(async (preferredConversationId?: number) => {
    if (!currentUsername) {
      setConversations([])
      setActiveConversationId(null)
      return
    }

    setLoadingConversations(true)
    try {
      const res = await axios.get(`${httpHost}ai/conversations`, {
        params: { username: currentUsername }
      })
      const list: AiConversation[] = res.data?.data || []
      setConversations(list)

      const nextActive = preferredConversationId || list[0]?.id || null
      setActiveConversationId(nextActive)
    } finally {
      setLoadingConversations(false)
    }
  }, [currentUsername])

  const loadMessages = useCallback(async (conversationId: number | null) => {
    if (!currentUsername || !conversationId) {
      setMessages([])
      return
    }

    setLoadingMessages(true)
    try {
      const res = await axios.get(`${httpHost}ai/conversations/${conversationId}/messages`, {
        params: { username: currentUsername }
      })
      shouldStickToBottom.current = true
      setMessages(res.data?.data || [])
    } finally {
      setLoadingMessages(false)
    }
  }, [currentUsername])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    loadMessages(activeConversationId)
  }, [activeConversationId, loadMessages])

  async function createConversation() {
    if (!currentUsername) {
      notification.warning({
        message: '登录状态异常',
        description: '请重新登录后再新建 AI 对话'
      })
      return null
    }

    const res = await axios.post(`${httpHost}ai/conversations`, {
      username: currentUsername
    })
    const conversation: AiConversation | undefined = res.data?.data
    if (!conversation) {
      return null
    }

    setConversations(prevConversations => [conversation, ...prevConversations])
    setActiveConversationId(conversation.id)
    setMessages([])
    window.setTimeout(() => input.current?.focus(), 0)
    return conversation
  }

  async function startNewConversation() {
    await createConversation()
  }

  function deleteConversation(event: MouseEvent<HTMLButtonElement>, conversation: AiConversation) {
    event.stopPropagation()
    setDeleteTarget(conversation)
  }

  async function confirmDeleteConversation() {
    if (!deleteTarget) {
      return
    }

    setDeletingConversation(true)
    try {
      await axios.delete(`${httpHost}ai/conversations/${deleteTarget.id}`, {
        params: { username: currentUsername }
      })

      const nextConversations = conversations.filter(item => item.id !== deleteTarget.id)
      setConversations(nextConversations)

      if (deleteTarget.id === activeConversationId) {
        const nextActive = nextConversations[0]?.id || null
        setActiveConversationId(nextActive)
        if (!nextActive) {
          setMessages([])
        }
      }
      setDeleteTarget(null)
    } finally {
      setDeletingConversation(false)
    }
  }

  function startRename(event: MouseEvent<HTMLButtonElement>, conversation: AiConversation) {
    event.stopPropagation()
    setEditingConversationId(conversation.id)
    setEditingTitle(conversation.title || '新对话')
  }

  async function saveRename(conversation: AiConversation) {
    const nextTitle = editingTitle.trim()
    setEditingConversationId(null)

    if (!nextTitle || nextTitle === conversation.title) {
      return
    }

    const res = await axios.patch(`${httpHost}ai/conversations/${conversation.id}`, {
      username: currentUsername,
      title: nextTitle
    })
    const updatedTitle = res.data?.data?.title || nextTitle
    setConversations(prevConversations => prevConversations.map(item => {
      if (item.id !== conversation.id) {
        return item
      }

      return {
        ...item,
        title: updatedTitle
      }
    }))
  }

  async function sendMessage() {
    const message = input.current?.value.trim() || ''

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

    if (message.length > 1000) {
      notification.warning({
        message: '消息过长',
        description: '单条 AI 消息不能超过 1000 个字符'
      })
      return
    }

    let conversationId = activeConversationId
    if (!conversationId) {
      const conversation = await createConversation()
      conversationId = conversation?.id || null
    }

    if (!conversationId) {
      notification.error({
        message: '新建对话失败',
        description: '请稍后再试'
      })
      return
    }

    const targetConversationId = conversationId
    setSending(true)
    shouldStickToBottom.current = true
    aiReplyIndex.current = null
    const now = new Date().toISOString()
    setMessages(prevMessages => {
      const nextMessages: AiMessage[] = [
        ...prevMessages,
        {
          conversationId: targetConversationId,
          username: currentUsername,
          sender: currentUsername,
          role: 'user',
          content: message,
          createdAt: now
        },
        {
          conversationId: targetConversationId,
          username: currentUsername,
          sender: AI_ASSISTANT_NAME,
          role: 'assistant',
          content: 'Deepseek 正在思考...',
          createdAt: now
        }
      ]
      aiReplyIndex.current = nextMessages.length - 1
      return nextMessages
    })

    if (input.current) {
      input.current.value = ''
    }

    try {
      const response = await fetch(`${httpHost}ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          username: currentUsername,
          conversationId: targetConversationId,
          content: message
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        updateAiReply(errorText || `AI request failed: HTTP ${response.status}`, true)
        return
      }

      if (!response.body) {
        updateAiReply('AI 回复失败，请稍后再试', true)
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
          if (eventName === 'conversation') {
            updateConversation(data.id, data.title)
          }
          if (eventName === 'message') {
            updateAiReply(data, firstChunk)
            firstChunk = false
          }
          if (eventName === 'error') {
            updateAiReply(data, true)
          }
          if (eventName === 'done') {
            loadConversations(targetConversationId)
          }
        }
      }
    } catch (error) {
      updateAiReply('AI request failed. Please check backend logs and DeepSeek API settings.', true)
    } finally {
      setSending(false)
    }
  }

  function updateConversation(conversationId: number, title: string) {
    setActiveConversationId(conversationId)
    setConversations(prevConversations => prevConversations.map(conversation => {
      if (conversation.id !== conversationId) {
        return conversation
      }

      return {
        ...conversation,
        title
      }
    }))
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

  function formatTime(time?: string) {
    if (!time) {
      return ''
    }

    return new Date(time).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatConversationTime(time?: string) {
    if (!time) {
      return ''
    }

    return new Date(time).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  }

  return (
    <Container>
      <div
        className='aiChatContent'
        ref={chatContent}
        style={{ gridTemplateRows: `auto minmax(0, 1fr) 6px ${editorHeight}px` }}
      >
        <div className='aiHeader'>
        <div className='aiTitle'>
          <Avatar className='aiTitleAvatar' src={AI_ASSISTANT_AVATAR}>D</Avatar>
          <div>
            <div className='aiTitleLine'>
              <h2>{AI_ASSISTANT_NAME}</h2>
              <p className={`statusLine ${currentStatusMeta.className}`}>
                <i />
                {currentStatusMeta.label}
              </p>
            </div>
            <span>多会话上下文记忆已开启</span>
          </div>
        </div>
        <button type='button' className='newConversation' onClick={startNewConversation}>
          + 新对话
        </button>
      </div>

        <div className='aiBody'>
        <aside className='conversationList'>
          <div className='conversationListTitle'>历史对话</div>
          {
            loadingConversations ?
              <Spin className='conversationLoading' />
              :
              conversations.length === 0 ?
                <div className='emptyConversations'>还没有对话</div>
                :
                conversations.map(conversation => (
                  <div
                    key={conversation.id}
                    className={conversation.id === activeConversationId ? 'conversationItem active' : 'conversationItem'}
                  >
                    {
                      editingConversationId === conversation.id ?
                        <input
                          className='conversationRenameInput'
                          value={editingTitle}
                          maxLength={30}
                          autoFocus
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={() => saveRename(conversation)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                            if (event.key === 'Escape') {
                              setEditingConversationId(null)
                            }
                          }}
                        />
                        :
                        <button
                          type='button'
                          className='conversationSelect'
                          onClick={() => setActiveConversationId(conversation.id)}
                        >
                          <strong>{conversation.title || '新对话'}</strong>
                          <span>{formatConversationTime(conversation.lastMessageAt || conversation.updatedAt)}</span>
                        </button>
                    }
                    <button
                      type='button'
                      className='conversationRename'
                      aria-label='重命名对话'
                      onClick={(event) => startRename(event, conversation)}
                    >
                      ✎
                    </button>
                    <button
                      type='button'
                      className='conversationDelete'
                      aria-label='删除对话'
                      onClick={(event) => deleteConversation(event, conversation)}
                    >
                      ×
                    </button>
                  </div>
                ))
          }
        </aside>

        <div className='messagePanel'>
          <div className='content' ref={chatScreen}>
            {
              loadingMessages ?
                <Spin size='large' className='loading' tip='正在加载对话...' />
                :
                messages.length === 0 ?
                  <div className='aiEmpty'>
                    <Avatar className='aiEmptyAvatar' src={AI_ASSISTANT_AVATAR}>D</Avatar>
                    <h3>开启一段新的学习对话</h3>
                    <p>Deepseek 会记住当前对话最近 20 条消息，适合连续追问。</p>
                  </div>
                  :
                  messages.map((message, index) => {
                    const isMine = message.role === 'user'
                    return (
                      <div className={isMine ? 'messageRow mine' : 'messageRow'} key={message.id || `${message.role}-${index}`}>
                        {
                          !isMine ?
                            <Avatar className='messageAvatar' src={AI_ASSISTANT_AVATAR}>D</Avatar>
                            :
                            null
                        }
                        <div className='bubble'>
                          <p>{message.content}</p>
                          <span>{formatTime(message.createdAt)}</span>
                        </div>
                        {
                          isMine ?
                            <Avatar className='messageAvatar mineAvatar'>
                              {currentUsername?.slice(0, 1).toUpperCase()}
                            </Avatar>
                            :
                            null
                        }
                      </div>
                    )
                  })
            }
          </div>
        </div>
        </div>

        <div className='editorResizeHandle' onMouseDown={startEditorResize} />
        <div className='sender'>
          <div className='composerBox'>
            <textarea
              ref={input}
              className='input'
              maxLength={1000}
              placeholder='输入问题，Enter 发送，Shift + Enter 换行'
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
      {
        deleteTarget ?
          <div className='deleteDialogMask' role='presentation' onClick={() => setDeleteTarget(null)}>
            <div className='deleteDialog' role='dialog' aria-modal='true' aria-labelledby='deleteDialogTitle' onClick={(event) => event.stopPropagation()}>
              <div className='deleteDialogIcon'>×</div>
              <div className='deleteDialogContent'>
                <h3 id='deleteDialogTitle'>删除历史对话</h3>
                <p>删除后，这段 Deepseek 对话和其中的消息记录都会被移除。</p>
                <strong>{deleteTarget.title || '新对话'}</strong>
              </div>
              <div className='deleteDialogActions'>
                <button type='button' className='deleteDialogCancel' onClick={() => setDeleteTarget(null)}>
                  取消
                </button>
                <button type='button' className='deleteDialogConfirm' onClick={confirmDeleteConversation} disabled={deletingConversation}>
                  {deletingConversation ? '删除中' : '删除'}
                </button>
              </div>
            </div>
          </div>
          :
          null
      }
    </Container>
  )
}

const Container = styled.section`
  position: relative;
  min-width: 0;
  height: 100%;
  overflow: hidden;

  .aiChatContent {
    min-width: 0;
    height: 100%;
    display: grid;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 249, 252, 0.88));
  }

  .aiHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 24px;
    border-bottom: 1px solid #e2ebf5;
    background: rgba(255, 255, 255, 0.94);
  }

  .aiTitle {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .aiTitleAvatar {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    background: #dbeafe;
  }

  .aiTitleLine {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .aiTitle h2 {
    margin: 0;
    color: #132033;
    font-size: 22px;
    line-height: 1.2;
  }

  .aiTitle span {
    display: inline-flex;
    margin-top: 5px;
    color: #72839a;
    font-size: 13px;
  }

  .statusLine {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 74px;
    height: 30px;
    margin: 0;
    padding: 0 13px;
    border: 1px solid #d3edf0;
    border-radius: 999px;
    color: #1d8c61;
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

  .newConversation {
    height: 36px;
    flex: 0 0 auto;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    color: #ffffff;
    background: #2d73bd;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 10px 22px rgba(45, 115, 189, 0.18);
  }

  .aiBody {
    min-height: 0;
    display: grid;
    grid-template-columns: 226px minmax(0, 1fr);
    overflow: hidden;
  }

  .conversationList {
    min-height: 0;
    padding: 16px 12px;
    overflow-y: auto;
    border-right: 1px solid #e2ebf5;
    background: linear-gradient(180deg, rgba(250, 253, 255, 0.96), rgba(241, 247, 252, 0.92));
  }

  .conversationListTitle {
    margin: 0 6px 10px;
    color: #607187;
    font-size: 13px;
    font-weight: 800;
  }

  .conversationLoading {
    width: 100%;
    margin-top: 24px;
  }

  .emptyConversations {
    margin: 16px 6px;
    color: #8a98aa;
    font-size: 13px;
  }

  .conversationItem {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 26px 26px;
    align-items: center;
    gap: 4px;
    padding: 7px 7px 7px 12px;
    margin-bottom: 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    color: inherit;
    background: transparent;
    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .conversationItem:hover,
  .conversationItem.active {
    border-color: #d6e3f2;
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(45, 74, 112, 0.08);
  }

  .conversationItem.active {
    border-color: #9ec2eb;
  }

  .conversationSelect {
    min-width: 0;
    padding: 4px 0;
    border: 0;
    color: inherit;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .conversationRenameInput {
    min-width: 0;
    height: 34px;
    padding: 0 8px;
    border: 1px solid #b9d2ee;
    border-radius: 6px;
    color: #182237;
    background: #ffffff;
    font-size: 14px;
    font-weight: 700;
  }

  .conversationRenameInput:focus {
    outline: none;
    border-color: #2d73bd;
    box-shadow: 0 0 0 3px rgba(45, 115, 189, 0.12);
  }

  .conversationItem strong {
    display: block;
    overflow: hidden;
    color: #182237;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversationItem span {
    display: block;
    margin-top: 5px;
    color: #8a98aa;
    font-size: 12px;
  }

  .conversationRename,
  .conversationDelete {
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 999px;
    color: #8a98aa;
    background: transparent;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.18s ease, background 0.18s ease, color 0.18s ease;
  }

  .conversationItem:hover .conversationRename,
  .conversationItem:hover .conversationDelete {
    opacity: 1;
  }

  .conversationRename:hover {
    color: #2d73bd;
    background: #edf6ff;
  }

  .conversationDelete:hover {
    color: #c54747;
    background: #fff1f1;
  }

  .deleteDialogMask {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(20, 32, 48, 0.28);
    backdrop-filter: blur(4px);
  }

  .deleteDialog {
    width: min(420px, 100%);
    padding: 22px;
    border: 1px solid rgba(224, 232, 242, 0.92);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 24px 70px rgba(28, 45, 68, 0.24);
  }

  .deleteDialogIcon {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: #c54747;
    background: #fff1f1;
    font-size: 26px;
    line-height: 1;
  }

  .deleteDialogContent h3 {
    margin: 16px 0 8px;
    color: #162034;
    font-size: 20px;
  }

  .deleteDialogContent p {
    margin: 0;
    color: #6c7c90;
    line-height: 1.7;
  }

  .deleteDialogContent strong {
    display: block;
    margin-top: 12px;
    padding: 10px 12px;
    overflow: hidden;
    border-radius: 8px;
    color: #172033;
    background: #f4f8fc;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .deleteDialogActions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 22px;
  }

  .deleteDialogCancel,
  .deleteDialogConfirm {
    min-width: 78px;
    height: 38px;
    border: 0;
    border-radius: 8px;
    font-weight: 800;
    cursor: pointer;
  }

  .deleteDialogCancel {
    color: #516176;
    background: #edf3f8;
  }

  .deleteDialogConfirm {
    color: #ffffff;
    background: #d94d4d;
    box-shadow: 0 10px 22px rgba(217, 77, 77, 0.22);
  }

  .deleteDialogConfirm:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }

  .messagePanel {
    min-width: 0;
    min-height: 0;
    position: relative;
    overflow: hidden;
  }

  .content {
    min-height: 0;
    height: 100%;
    padding: 18px 28px 26px;
    overflow-y: auto;
    overflow-x: hidden;
    overflow-anchor: none;
  }

  .content::-webkit-scrollbar,
  .conversationList::-webkit-scrollbar {
    width: 4px;
  }

  .content::-webkit-scrollbar-thumb,
  .conversationList::-webkit-scrollbar-thumb {
    background: #c4d1e3;
    border-radius: 99px;
  }

  .loading {
    width: 100%;
    margin-top: 18vh;
  }

  .aiEmpty {
    height: 100%;
    min-height: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #6b7b91;
    text-align: center;
  }

  .aiEmptyAvatar {
    width: 78px;
    height: 78px;
    margin-bottom: 18px;
    background: #dbeafe;
    opacity: 0.72;
  }

  .aiEmpty h3 {
    margin: 0 0 8px;
    color: #172033;
    font-size: 20px;
  }

  .aiEmpty p {
    margin: 0;
    max-width: 360px;
    line-height: 1.7;
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
    max-width: min(580px, 78%);
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

  .sender {
    min-height: 0;
    padding: 14px 18px 18px;
    background: rgba(255, 255, 255, 0.94);
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
    grid-template-rows: auto minmax(0, 1fr) 6px 150px !important;
    min-height: 640px;

    .aiBody {
      grid-template-columns: 1fr;
      grid-template-rows: 126px minmax(0, 1fr);
    }

    .conversationList {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      overflow-y: hidden;
      border-right: 0;
      border-bottom: 1px solid #e2ebf5;
    }

    .conversationListTitle,
    .emptyConversations {
      flex: 0 0 auto;
    }

    .conversationItem {
      flex: 0 0 180px;
      margin-bottom: 0;
    }
  }
`
