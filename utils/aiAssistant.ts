export const AI_ASSISTANT_NAME = 'Deepseek'
export const AI_ASSISTANT_AVATAR = 'https://www.deepseek.com/favicon.ico'

export function isAiAssistant(username: string) {
    return username === AI_ASSISTANT_NAME
}
