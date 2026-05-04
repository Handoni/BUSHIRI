const BANK_NAMES = [
  '국민은행',
  '신한은행',
  '농협',
  '하나은행',
  '우리은행',
  '기업은행',
  '수협',
  '카카오뱅크',
  '토스뱅크',
  '우체국',
  '새마을금고'
]

const bankPattern = new RegExp(`(${BANK_NAMES.join('|')})\\s*(\\d{10,16})`, 'g')
const phonePattern = /\b(01[0-9])[-\s]?(\d{3,4})[-\s]?(\d{4})\b/g
const urlPattern = /https?:\/\/[^\s]+/g

export function maskSensitive(input: string): string {
  return input
    .replace(phonePattern, (_match, prefix: string, _middle: string, suffix: string) => `${prefix}-****-${suffix}`)
    .replace(bankPattern, (_match, bankName: string, accountNumber: string) => `${bankName} ****${accountNumber.slice(-4)}`)
    .replace(urlPattern, '[URL]')
}
