interface AvatarPreset {
  id: string
  src: string
}

function createAvatarPreset(id: string, primary: string, secondary: string, accent: string, mark: string): AvatarPreset {
  const svg = `
    <svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-${id}" x1="20" y1="18" x2="142" y2="148" gradientUnits="userSpaceOnUse">
          <stop stop-color="${primary}"/>
          <stop offset="1" stop-color="${secondary}"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="44" fill="url(#bg-${id})"/>
      <circle cx="112" cy="42" r="24" fill="rgba(255,255,255,0.22)"/>
      <circle cx="48" cy="120" r="32" fill="rgba(255,255,255,0.16)"/>
      <circle cx="80" cy="68" r="30" fill="rgba(255,255,255,0.92)"/>
      <path d="M42 132c8-24 28-38 38-38s30 14 38 38" fill="rgba(255,255,255,0.92)"/>
      <circle cx="68" cy="68" r="5" fill="#23334d"/>
      <circle cx="92" cy="68" r="5" fill="#23334d"/>
      <path d="M68 82c8 8 16 8 24 0" stroke="#23334d" stroke-width="5" stroke-linecap="round" fill="none"/>
      <circle cx="116" cy="114" r="18" fill="${accent}"/>
      <text x="116" y="121" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#fff">${mark}</text>
    </svg>
  `

  return {
    id,
    src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  }
}

export const avatarPresets = [
  createAvatarPreset('blue', '#4f8cff', '#6ad7ff', '#2563eb', 'A'),
  createAvatarPreset('green', '#20c997', '#8be37a', '#159a6b', 'B'),
  createAvatarPreset('pink', '#ff7ab6', '#ffb86c', '#e84d8a', 'C'),
  createAvatarPreset('purple', '#8b5cf6', '#67e8f9', '#6d28d9', 'D'),
  createAvatarPreset('orange', '#ff9f43', '#ffd166', '#f97316', 'E'),
  createAvatarPreset('slate', '#64748b', '#94a3b8', '#334155', 'F')
]

export function getRandomPresetAvatar() {
  const index = Math.floor(Math.random() * avatarPresets.length)
  return avatarPresets[index].src
}
