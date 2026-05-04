const DROP_KEYWORDS = ['주문 방법', '배송 안내', '계좌 안내', '영업시간', '손질 비용', '위치', '카카오톡', '전화번호']

export function extractMarketText(rawContent: string): string {
  return rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !DROP_KEYWORDS.some((keyword) => line.includes(keyword)))
    .join('\n')
}
