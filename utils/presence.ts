export type UserStatus = 'online' | 'busy' | 'dnd' | 'away' | 'offline'

export type PresenceMap = Record<string, UserStatus>

export const statusOptions: Array<{ value: UserStatus; label: string }> = [
    { value: 'online', label: '在线' },
    { value: 'busy', label: '忙碌' },
    { value: 'dnd', label: '请勿打扰' },
    { value: 'away', label: '离开' }
]

export const statusMeta: Record<UserStatus, { label: string; className: string }> = {
    online: { label: '在线', className: 'statusOnline' },
    busy: { label: '忙碌', className: 'statusBusy' },
    dnd: { label: '请勿打扰', className: 'statusDnd' },
    away: { label: '离开', className: 'statusAway' },
    offline: { label: '离线', className: 'statusOffline' }
}

export function getStatusMeta(status?: UserStatus) {
    return statusMeta[status || 'offline']
}
