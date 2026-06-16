import { Avatar, Button, Input, notification } from 'antd'
import axios from 'axios'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { httpHost } from '../network'
import { routerBeforEach } from '../utils/router-beforEach'

const { Search } = Input

export default function SetAvatar() {
    const router = useRouter()
    const [avatar, setAvatar] = useState('')
    const [randomAvatar, setRandomAvatar] = useState('')
    const [saving, setSaving] = useState(false)

    function preview(qq: string) {
        const qqNumber = qq.trim()
        if (!qqNumber) {
            notification.warning({
                message: '请输入 QQ 号',
                description: '也可以直接使用系统生成的随机头像'
            })
            return
        }
        setAvatar(`https://q2.qlogo.cn/headimg_dl?dst_uin=${qqNumber}&spec=100`)
    }

    async function postAvatar(avatarSrc: string) {
        return axios.post(`${httpHost}user/avatar`, {
            username: localStorage.getItem('username'),
            avatar: avatarSrc
        })
    }

    async function submitAvatar() {
        setSaving(true)
        try {
            const res = avatar ? await postAvatar(avatar) : await postAvatar(randomAvatar)
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

    useEffect(() => {
        routerBeforEach(router)
        setRandomAvatar(`https://api.multiavatar.com/Binx%${Math.floor((Math.random() * 50000))}.png`)
    }, [router])

    return (
        <Container>
            <section className="avatarPanel">
                <div className="intro">
                    <p className="eyebrow">Profile</p>
                    <h1>挑一个头像</h1>
                    <p>用 QQ 号快速预览头像，或者直接采用系统生成的随机形象。</p>
                </div>

                <Avatar shape="circle" size={128} src={avatar || randomAvatar} className='avatar' alt='头像预览' />

                <Search
                    placeholder="输入 QQ 号预览头像"
                    allowClear
                    enterButton="预览"
                    size="large"
                    onSearch={preview}
                    className="preview"
                />

                <div className="actions">
                    <Button onClick={() => setAvatar('')} size='large'>
                        换随机头像
                    </Button>
                    <Button type="primary" size='large' onClick={submitAvatar} loading={saving}>
                        进入聊天
                    </Button>
                </div>
            </section>
        </Container>
    )
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
        width: min(520px, 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
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

    .preview {
        width: 100%;
    }

    .actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .actions button {
        border-radius: 6px;
        font-weight: 700;
    }

    @media (max-width: 520px) {
        padding: 18px;

        .avatarPanel {
            padding: 28px 20px;
        }

        .actions {
            grid-template-columns: 1fr;
        }
    }
`
