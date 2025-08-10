export const DID_USER_CLICK_LANDING_PAGE_PROMPT = 'DID_USER_CLICK_LANDING_PAGE_PROMPT'

export function keyForDocsJsonFormLocalStorage({ chatId }: { chatId: string }) {
    return `fumabase.jsonc-${chatId}`
}
