import axios from 'axios'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import { Avatar, Dropdown, Empty, Menu, Popover } from 'antd'
import { httpHost } from '../network'
import { getSocket } from '../network/socket'
import { getStatusMeta, statusOptions, type PresenceMap, type UserStatus } from '../utils/presence'
import { AI_ASSISTANT_AVATAR, AI_ASSISTANT_NAME, isAiAssistant } from '../utils/aiAssistant'

interface ChatUser {
    username: string
    avatar?: string
}

interface UserListProps {
    currentUser: string
    setCurrentUser: (user: string) => void
    presenceMap: PresenceMap
    setPresenceMap: (presenceMap: PresenceMap) => void
    currentUsername: string
    unreadMap: Record<string, number>
    contactActivityMap: Record<string, number>
}

const statusOrder: Record<UserStatus, number> = {
    online: 0,
    busy: 1,
    dnd: 2,
    away: 3,
    offline: 4
}

const statusIconLabel: Record<UserStatus, string> = {
    online: '在线',
    busy: '忙',
    dnd: '',
    away: '离',
    offline: '离'
}

export default function UserList({
    currentUser,
    setCurrentUser,
    presenceMap,
    setPresenceMap,
    currentUsername,
    unreadMap,
    contactActivityMap
}: UserListProps) {
    const router = useRouter()
    const [users, setUsers] = useState<ChatUser[]>([])
    const [myStatus, setMyStatus] = useState<UserStatus>('online')
    const [isStatusPanelOpen, setIsStatusPanelOpen] = useState(false)

    const currentUserInfo = useMemo(
        () => users.find(user => user.username === currentUsername),
        [currentUsername, users]
    )

    const contacts = useMemo(
        () => [
            {
                username: AI_ASSISTANT_NAME,
                avatar: AI_ASSISTANT_AVATAR
            },
            ...users.filter(user => user.username !== currentUsername)
        ]
            .sort((a, b) => {
                const unreadA = unreadMap[a.username] || 0
                const unreadB = unreadMap[b.username] || 0
                if (unreadA !== unreadB) {
                    return unreadB - unreadA
                }

                const activityA = contactActivityMap[a.username] || 0
                const activityB = contactActivityMap[b.username] || 0
                if (activityA !== activityB) {
                    return activityB - activityA
                }

                if (isAiAssistant(a.username)) {
                    return -1
                }
                if (isAiAssistant(b.username)) {
                    return 1
                }

                const statusA = presenceMap[a.username] || 'offline'
                const statusB = presenceMap[b.username] || 'offline'
                return statusOrder[statusA] - statusOrder[statusB] || a.username.localeCompare(b.username)
            }),
        [contactActivityMap, currentUsername, presenceMap, unreadMap, users]
    )

    const getUserList = useCallback(async () => {
        const res = await axios.post(`${httpHost}user/all`)
        setUsers(res.data || [])
    }, [])

    const updateMyStatus = useCallback((status: UserStatus) => {
        setMyStatus(status)
        if (typeof window !== 'undefined') {
            localStorage.setItem('userStatus', status)
        }

        if (currentUsername) {
            getSocket().emit('presence:update', {
                username: currentUsername,
                status
            })
        }
    }, [currentUsername])

    const changeMyAvatar = useCallback(() => {
        router.replace('/avatar')
    }, [router])

    const logout = useCallback(() => {
        if (currentUsername) {
            getSocket().emit('presence:update', {
                username: currentUsername,
                status: 'offline'
            })
        }

        if (typeof window !== 'undefined') {
            localStorage.removeItem('token')
            localStorage.removeItem('username')
            localStorage.removeItem('userStatus')
        }
        router.replace('/')
    }, [currentUsername, router])

    const handleStatusChange = useCallback((status: UserStatus) => {
        updateMyStatus(status)
        setIsStatusPanelOpen(false)
    }, [updateMyStatus])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedStatus = localStorage.getItem('userStatus') as UserStatus | null
            if (savedStatus && statusOptions.some(option => option.value === savedStatus)) {
                setMyStatus(savedStatus)
            }
        }
    }, [])

    useEffect(() => {
        getUserList()
    }, [getUserList])

    useEffect(() => {
        if (currentUsername) {
            getSocket().emit('connection', { username: currentUsername, status: myStatus })
            getSocket().emit('presence:update', { username: currentUsername, status: myStatus })
            getSocket().emit('presence:request')
        }
    }, [currentUsername, myStatus])

    useEffect(() => {
        const socket = getSocket()
        socket.on('presence:list', (list: PresenceMap) => {
            setPresenceMap(list || {})
        })

        return () => {
            socket.off('presence:list')
        }
    }, [setPresenceMap])

    const myStatusMeta = getStatusMeta(myStatus)

    const profileMenu = (
        <Menu>
            <Menu.Item key="avatar" onClick={changeMyAvatar}>
                更换头像
            </Menu.Item>
            <Menu.Item key="logout" onClick={logout}>
                退出登录
            </Menu.Item>
        </Menu>
    )

    const statusPanel = (
        <div className="statusPanel">
            <div className="statusPanelCurrent">
                <i className={`statusPanelCurrentDot ${myStatusMeta.className}`} />
                <strong>{myStatusMeta.label}</strong>
            </div>
            <div className="statusPanelGrid">
                {
                    statusOptions.map(option => {
                        const optionMeta = getStatusMeta(option.value)
                        const active = option.value === myStatus
                        return (
                            <button
                                key={option.value}
                                type="button"
                                className={active ? 'statusOption active' : 'statusOption'}
                                onClick={() => handleStatusChange(option.value)}
                            >
                                <i className={`statusOptionIcon ${optionMeta.className}`}>
                                    {statusIconLabel[option.value]}
                                </i>
                                <span>{option.label}</span>
                            </button>
                        )
                    })
                }
            </div>
        </div>
    )

    return (
        <Container>
            <StatusPopoverStyles />
            <div className="listHeader">
                <div>
                    <h2>联系人</h2>
                </div>
            </div>

            <div className="contactList">
                {
                    contacts.length === 0 ?
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无联系人" />
                        :
                        contacts.map((user) => {
                            const active = user.username === currentUser
                            const status = isAiAssistant(user.username) ? 'online' : presenceMap[user.username] || 'offline'
                            const statusMeta = getStatusMeta(status)
                            const unreadCount = unreadMap[user.username] || 0
                            return (
                                <button
                                    type="button"
                                    className={active ? 'userCard active' : 'userCard'}
                                    data-unread-count={unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined}
                                    onClick={() => setCurrentUser(active ? '' : user.username)}
                                    key={user.username}
                                >
                                    <div className="avatarWrap">
                                        <Avatar className='avatar' src={user.avatar}>
                                            {user.username?.slice(0, 1).toUpperCase()}
                                        </Avatar>
                                        <i className={`statusDot ${statusMeta.className}`} />
                                    </div>
                                    <div className="userMeta">
                                        <p className='username'>{user.username}</p>
                                        <span className={`statusText ${statusMeta.className}`}>
                                            {isAiAssistant(user.username) ? 'AI 助手' : statusMeta.label}
                                        </span>
                                    </div>
                                </button>
                            )
                        })
                }
            </div>

            <div className="profile">
                <Dropdown overlay={profileMenu} trigger={['click']} placement="topLeft">
                    <button type="button" className="profileIdentity">
                        <div className="avatarWrap">
                            <Avatar className='myAvatar' src={currentUserInfo?.avatar}>
                                {currentUsername?.slice(0, 1).toUpperCase()}
                            </Avatar>
                            <i className={`statusDot ${myStatusMeta.className}`} />
                        </div>
                        <div className="profileName">
                            <p>{currentUsername || '未登录'}</p>
                        </div>
                    </button>
                </Dropdown>

                <div className="profileStatus">
                    <Popover
                        content={statusPanel}
                        trigger="click"
                        placement="topRight"
                        overlayClassName="profileStatusPopover"
                        visible={isStatusPanelOpen}
                        onVisibleChange={setIsStatusPanelOpen}
                    >
                        <button
                            type="button"
                            className={`statusTrigger ${myStatusMeta.className}`}
                        >
                            <i className={`profileStatusDot ${myStatusMeta.className}`} />
                            {myStatusMeta.label}
                        </button>
                    </Popover>
                </div>
            </div>
        </Container>
    )
}

const StatusPopoverStyles = createGlobalStyle`
    .profileStatusPopover {
        z-index: 1100;
    }

    .profileStatusPopover .ant-popover-inner {
        overflow: hidden;
        border-radius: 18px;
        box-shadow: 0 18px 48px rgba(16, 30, 54, 0.2);
    }

    .profileStatusPopover .ant-popover-inner-content {
        padding: 0;
    }

    .profileStatusPopover .ant-popover-arrow-content {
        background: #eef6ff;
    }

    .statusPanel {
        width: 284px;
        overflow: hidden;
        background: #f5f8ff;
    }

    .statusPanelCurrent {
        height: 86px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: #eaf3ff;
        color: #101828;
    }

    .statusPanelCurrent strong {
        font-size: 18px;
        line-height: 1;
    }

    .statusPanelCurrentDot {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        box-shadow: 0 6px 14px rgba(31, 45, 70, 0.14);
    }

    .statusPanelGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        padding: 16px;
    }

    .statusOption {
        height: 76px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 0;
        border-radius: 12px;
        color: #1f2937;
        background: transparent;
        cursor: pointer;
        transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }

    .statusOption:hover {
        background: rgba(255, 255, 255, 0.88);
        transform: translateY(-1px);
    }

    .statusOption.active {
        color: #ffffff;
        background: #1890ff;
        box-shadow: 0 12px 26px rgba(24, 144, 255, 0.28);
    }

    .statusOptionIcon {
        width: 30px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: #ffffff;
        font-size: 11px;
        font-style: normal;
        font-weight: 800;
        line-height: 1;
    }

    .statusOption span {
        font-size: 13px;
        line-height: 1;
    }

    .statusOption.active .statusOptionIcon {
        box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35);
    }

    .statusOnline {
        color: #1d8c61;
        background: #20b87a;
    }

    .statusBusy {
        color: #c54747;
        background: #f15b5b;
    }

    .statusDnd {
        color: #e65f78;
        background: #ff7a95;
    }

    .statusOptionIcon.statusDnd {
        position: relative;
        color: transparent;
        background: #ffe5ec;
        box-shadow: inset 0 0 0 3px #ff6b8a;
    }

    .statusOptionIcon.statusDnd::after {
        content: '';
        position: absolute;
        width: 19px;
        height: 4px;
        border-radius: 99px;
        background: #ff6b8a;
        transform: rotate(45deg);
    }

    .statusAway {
        color: #6f7785;
        background: #9aa4b2;
    }

    .statusOffline {
        color: #7a8494;
        background: #c0c7d2;
    }
`

const Container = styled.aside`
    min-height: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    background:
        linear-gradient(180deg, #fbfdff 0%, #f2f7fb 100%);
    border-right: 1px solid #e2ebf5;

    .listHeader {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        padding: 26px 22px 20px;
    }

    .listHeader h2 {
        margin: 0;
        color: #132033;
        font-size: 22px;
        line-height: 1.25;
    }

    .contactList {
        flex: 1;
        min-height: 0;
        padding: 0 12px 14px;
        overflow-y: auto;
    }

    .contactList::-webkit-scrollbar {
        width: 4px;
    }

    .contactList::-webkit-scrollbar-thumb {
        background: #c4d1e3;
        border-radius: 99px;
    }

    .userCard {
        width: 100%;
        min-height: 78px;
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 12px;
        margin-bottom: 9px;
        border: 1px solid transparent;
        border-radius: 8px;
        color: inherit;
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
    }

    .userCard[data-unread-count]::after {
        content: attr(data-unread-count);
        min-width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 7px;
        border-radius: 999px;
        color: #ffffff;
        background: #f04438;
        font-size: 12px;
        font-weight: 800;
        line-height: 1;
        box-shadow: 0 8px 18px rgba(240, 68, 56, 0.24);
    }

    .userCard:hover,
    .userCard.active {
        background: #ffffff;
        border-color: #d6e3f2;
        box-shadow: 0 12px 26px rgba(45, 74, 112, 0.1);
    }

    .userCard:hover {
        transform: translateY(-1px);
    }

    .userCard.active {
        border-color: #9ec2eb;
        transform: none;
    }

    .avatarWrap {
        position: relative;
        width: 54px;
        height: 54px;
        flex: 0 0 54px;
    }

    .avatar {
        width: 54px;
        height: 54px;
        background: #d9e6f7;
        color: #315d95;
        font-weight: 800;
    }

    .statusDot {
        position: absolute;
        right: 1px;
        bottom: 1px;
        width: 13px;
        height: 13px;
        border: 2px solid #ffffff;
        border-radius: 999px;
        background: #98a2b3;
    }

    .statusOnline {
        color: #1d8c61;
        background: #20b87a;
    }

    .statusBusy {
        color: #c54747;
        background: #f15b5b;
    }

    .statusDnd {
        color: #e65f78;
        background: #ff7a95;
    }

    .statusAway {
        color: #6f7785;
        background: #9aa4b2;
    }

    .statusOffline {
        color: #7a8494;
        background: #c0c7d2;
    }

    .userMeta {
        min-width: 0;
    }

    .username {
        margin: 0;
        color: #172033;
        font-size: 16px;
        font-weight: 800;
        word-break: break-all;
    }

    .statusText {
        display: inline-flex;
        margin-top: 5px;
        font-size: 13px;
        background: transparent;
    }

    .profile {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        border-top: 1px solid #e2ebf5;
        background: rgba(255, 255, 255, 0.92);
    }

    .profileIdentity {
        min-width: 0;
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        padding: 0;
        border: 0;
        color: inherit;
        background: transparent;
        text-align: left;
        cursor: pointer;
    }

    .profileIdentity:hover .profileName p {
        color: #1f6db5;
    }

    .myAvatar {
        width: 54px;
        height: 54px;
        background: #2f6db2;
        color: #ffffff;
        font-weight: 800;
    }

    .profileName {
        min-width: 0;
    }

    .profileName p {
        margin: 0;
        color: #172033;
        font-weight: 800;
        word-break: break-all;
        transition: color 0.18s ease;
    }

    .profileStatus {
        display: flex;
        justify-content: flex-end;
    }

    .statusTrigger {
        min-width: 72px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 0 10px;
        border: 1px solid #dbe7f4;
        border-radius: 999px;
        color: #526173;
        background: #ffffff;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
    }

    .statusTrigger:hover {
        border-color: #9ec2eb;
        background: #f6fbff;
    }

    .statusTrigger.statusOnline {
        color: #1d8c61;
        background: rgba(32, 184, 122, 0.08);
    }

    .statusTrigger.statusBusy {
        color: #c54747;
        background: rgba(241, 91, 91, 0.08);
    }

    .statusTrigger.statusDnd {
        color: #d84e6a;
        background: rgba(255, 107, 138, 0.1);
    }

    .statusTrigger.statusAway {
        color: #6f7785;
        background: rgba(154, 164, 178, 0.12);
    }

    .statusTrigger.statusOffline {
        color: #7a8494;
        background: rgba(192, 199, 210, 0.18);
    }

    .profileStatusDot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        flex: 0 0 8px;
    }

    @media (max-width: 860px) {
        height: 300px;
        border-right: 0;
        border-bottom: 1px solid #e2ebf5;
    }
`
