import { notification } from 'antd';
import axios from 'axios';

axios.interceptors.request.use(request => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token')
        if (token && request.headers) {
            request.headers.Authorization = `Bearer ${token}`
        }
    }
    return request
})

axios.interceptors.response.use(response => {
    return response
}, error => {
    if (typeof window !== 'undefined') {
        notification.error({
            message: '请求失败',
            description: '服务器暂时不可用，请稍后再试'
        })
    }
    return Promise.reject(error)
}
)
