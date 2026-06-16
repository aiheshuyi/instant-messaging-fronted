import './interceptors/intercetptors'

function withTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}

const defaultHttpHost =
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000/' : 'http://101.43.191.122:3000/'
const defaultWsHost =
  process.env.NODE_ENV === 'development' ? 'http://localhost:2999/' : 'http://101.43.191.122:2999/'

export const httpHost = withTrailingSlash(process.env.NEXT_PUBLIC_HTTPHOST || defaultHttpHost)
export const wsHOST = withTrailingSlash(process.env.NEXT_PUBLIC_WSHOST || defaultWsHost)
