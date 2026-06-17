import { Avatar, Button, notification } from 'antd'
import axios from 'axios'
import { useRouter } from 'next/router'
import React, { ChangeEvent, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { httpHost } from '../network'
import { avatarPresets, getRandomPresetAvatar } from '../utils/avatarPresets'
import { routerBeforEach } from '../utils/router-beforEach'

export default function SetAvatar() {
    const router = useRouter()
    const fileInput = useRef<HTMLInputElement>(null)
    const [avatar, setAvatar] = useState('')
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    async function postAvatar(avatarSrc: string) {
        return axios.post(`${httpHost}user/avatar`, {
            username: localStorage.getItem('username'),
            avatar: avatarSrc
        })
    }

    async function submitAvatar() {
        if (!avatar) {
            notification.warning({
                message: '请选择头像',
                description: '可以选择系统头像，也可以上传自己的图片'
            })
            return
        }

        setSaving(true)
        try {
            const res = await postAvatar(avatar)
            if (String(res.data.code) === '200') {
                notification.success({
                    message: '头像已保存',
                    description: '现在可以进入聊天了'
                })
                router.push('/chat')
            }
        } finally {
            setSaving(false)
        }
    }

    function randomizeAvatar() {
        setAvatar(getRandomPresetAvatar())
    }

    async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        event.target.value = ''

        if (!file) {
            return
        }

        if (!file.type.startsWith('image/')) {
            notification.warning({
                message: '文件格式不正确',
                description: '请上传 JPG、PNG、WebP 等图片文件'
            })
            return
        }

        if (file.size > 3 * 1024 * 1024) {
            notification.warning({
                message: '图片过大',
                description: '请上传 3MB 以内的图片'
            })
            return
        }

        setUploading(true)
        try {
            const nextAvatar = await compressImage(file)
            setAvatar(nextAvatar)
        } catch (error) {
            notification.error({
                message: '上传失败',
                description: '图片解析失败，请换一张图片试试'
            })
        } finally {
            setUploading(false)
        }
    }

    useEffect(() => {
        routerBeforEach(router)
        setAvatar(getRandomPresetAvatar())
    }, [router])

    return (
        <Container>
            <section className="avatarPanel">
                <div className="intro">
                    <p className="eyebrow">Profile</p>
                    <h1>选择你的头像</h1>
                    <p>可以选择系统头像，也可以上传自己的图片。上传图片会自动压缩后保存。</p>
                </div>

                <Avatar shape="circle" size={128} src={avatar} className='avatar' alt='头像预览' />

                <div className="presetGrid" aria-label="系统头像">
                    {
                        avatarPresets.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                className={avatar === item.src ? 'preset active' : 'preset'}
                                onClick={() => setAvatar(item.src)}
                                aria-label="选择系统头像"
                            >
                                <Avatar src={item.src} size={54} />
                            </button>
                        ))
                    }
                </div>

                <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="fileInput"
                    onChange={handleUpload}
                />

                <div className="actions">
                    <Button onClick={randomizeAvatar} size='large'>
                        随机头像
                    </Button>
                    <Button onClick={() => fileInput.current?.click()} size='large' loading={uploading}>
                        上传头像
                    </Button>
                    <Button type="primary" size='large' onClick={submitAvatar} loading={saving}>
                        保存并进入聊天
                    </Button>
                </div>
            </section>
        </Container>
    )
}

function compressImage(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const image = new Image()
            image.onload = () => {
                const canvas = document.createElement('canvas')
                const size = 256
                const scale = Math.max(size / image.width, size / image.height)
                const width = image.width * scale
                const height = image.height * scale
                const x = (size - width) / 2
                const y = (size - height) / 2
                const context = canvas.getContext('2d')

                if (!context) {
                    reject(new Error('canvas context unavailable'))
                    return
                }

                canvas.width = size
                canvas.height = size
                context.fillStyle = '#f4f7fb'
                context.fillRect(0, 0, size, size)
                context.drawImage(image, x, y, width, height)
                resolve(canvas.toDataURL('image/jpeg', 0.82))
            }
            image.onerror = reject
            image.src = String(reader.result || '')
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

const Container = styled.main`
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 28px;
    background:
        linear-gradient(135deg, #eef5ff 0%, #f7fbf5 50%, #fff6ea 100%);

    .avatarPanel {
        width: min(560px, 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 22px;
        padding: 36px;
        border: 1px solid rgba(125, 143, 171, 0.24);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 20px 55px rgba(47, 64, 92, 0.14);
    }

    .intro {
        text-align: center;
    }

    .eyebrow {
        margin: 0 0 8px;
        color: #3f6da8;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        color: #132033;
        font-size: 30px;
        line-height: 1.25;
    }

    p {
        margin: 10px 0 0;
        color: #66758a;
        line-height: 1.7;
    }

    .avatar {
        border: 6px solid #ffffff;
        box-shadow: 0 12px 34px rgba(31, 47, 72, 0.18);
    }

    .presetGrid {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
    }

    .preset {
        height: 70px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #dce7f3;
        border-radius: 8px;
        background: #f8fbff;
        cursor: pointer;
        transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }

    .preset:hover,
    .preset.active {
        border-color: #2d73bd;
        background: #ffffff;
        box-shadow: 0 10px 24px rgba(45, 115, 189, 0.16);
    }

    .preset:hover {
        transform: translateY(-1px);
    }

    .fileInput {
        display: none;
    }

    .actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr 1.2fr;
        gap: 12px;
    }

    .actions button {
        border-radius: 6px;
        font-weight: 700;
    }

    @media (max-width: 560px) {
        padding: 18px;

        .avatarPanel {
            padding: 28px 20px;
        }

        .presetGrid {
            grid-template-columns: repeat(3, 1fr);
        }

        .actions {
            grid-template-columns: 1fr;
        }
    }
`
