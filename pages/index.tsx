import type { NextPage } from 'next'
import Image from 'next/image'
import styled from 'styled-components'
import { Form, Input, Button, notification } from 'antd';
import picture from '../public/pictures/background.png'
import axios from 'axios';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { httpHost } from '../network';
import { getSocket } from '../network/socket';
import { getRandomPresetAvatar } from '../utils/avatarPresets';

interface FormData {
  username: string,
  password: string,
  confirmedPassword: string
}

const Home: NextPage = () => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  function passwordIsValid(formData: FormData) {
    return formData.password === formData.confirmedPassword
  }

  function hasAvatar(username: string) {
    return axios.post(`${httpHost}user/hasavatar`, {
      username
    })
  }

  async function register(values: FormData) {
    return axios.post(`${httpHost}auth/register`, {
      username: values.username,
      password: values.password,
      avatar: getRandomPresetAvatar()
    })
  }

  async function login(values: FormData) {
    const res = await axios.post(`${httpHost}auth/login`, {
      username: values.username,
      password: values.password
    })

    if (res?.data?.access_token !== undefined) {
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('username', values.username)
      localStorage.setItem('userStatus', 'online')
      getSocket().emit('connection', { username: values.username, status: 'online' })
      getSocket().emit('presence:update', { username: values.username, status: 'online' })

      notification.success({
        message: '登录成功',
        description: '欢迎回来，开始聊天吧',
        duration: 2
      })

      const avatarResult = await hasAvatar(values.username)
      router.push(avatarResult.data ? '/chat' : '/avatar')
      return
    }

    notification.error({
      message: '登录失败',
      description: res?.data?.msg || '请检查用户名和密码',
      duration: 2
    })
  }

  const onFinish = async (values: FormData) => {
    if (!passwordIsValid(values)) {
      notification.error({
        message: '请检查密码',
        description: '两次输入的密码不一致',
        duration: 2
      })
      return
    }

    setSubmitting(true)
    try {
      const registerRes = await register(values)
      const registerCode = String(registerRes.data?.code)

      if (registerCode === '200' || registerCode === '1001') {
        await login(values)
      } else {
        notification.error({
          message: '注册失败',
          description: registerRes.data?.msg || '请稍后再试',
          duration: 2
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container>
      <div className='background'>
        <Image src={picture} alt="" layout='fill' objectFit='cover' priority />
      </div>
      <div className='screenTint' />
      <section className='authPanel'>
        <p className='eyebrow'>Instant Messaging</p>
        <h1>开始一场实时对话</h1>
        <p className='subTitle'>输入用户名和密码即可登录，新用户会自动完成注册。</p>

        <Form
          name="login"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          className='form'
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder='例如：yang' size='large' />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder='请输入密码' size='large' />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmedPassword"
            dependencies={['password']}
            rules={[{ required: true, message: '请再次输入密码' }]}
          >
            <Input.Password placeholder='再次输入密码' size='large' />
          </Form.Item>

          <Button type="primary" htmlType="submit" className='submitBtn' loading={submitting} block size='large'>
            登录 / 自动注册
          </Button>
        </Form>
      </section>
    </Container>
  )
}

const Container = styled.main`
  min-height: 100vh;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32px;
  overflow: hidden;
  color: #182033;

  .background {
    position: absolute;
    inset: 0;
    z-index: -2;
  }

  .screenTint {
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(237, 243, 255, 0.72)),
      rgba(13, 25, 44, 0.08);
  }

  .authPanel {
    width: min(440px, 100%);
    padding: 34px;
    border: 1px solid rgba(129, 148, 181, 0.28);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 22px 65px rgba(30, 45, 73, 0.22);
    backdrop-filter: blur(14px);
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #4169a8;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: 32px;
    line-height: 1.25;
    color: #111827;
  }

  .subTitle {
    margin: 12px 0 26px;
    color: #5f6d80;
    line-height: 1.7;
  }

  .submitBtn {
    margin-top: 6px;
    height: 46px;
    border-radius: 6px;
    font-weight: 700;
  }

  @media (max-width: 560px) {
    padding: 18px;

    .authPanel {
      padding: 26px 20px;
    }

    h1 {
      font-size: 26px;
    }
  }
`

export default Home
