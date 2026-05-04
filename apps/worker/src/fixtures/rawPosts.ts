export const rawPostFixtures = [
  {
    id: 'fixture-seongjeon',
    vendorName: '성전물산',
    rawContent: [
      '오늘 시세표',
      '국내산 광어 2~3kg kg 4.8',
      '일본산 참돔 1.5~2kg 32,000원',
      '주문 방법 카톡 문의',
      '계좌 안내 국민은행 54270201236744'
    ].join('\n')
  },
  {
    id: 'fixture-chamjoeun',
    vendorName: '참조은수산',
    rawContent: [
      '시세표',
      '제주광어 2.2-2.5kg 25,000원',
      '자연산참돔 3k 20,000원',
      '배송 안내 당일 발송'
    ].join('\n')
  },
  {
    id: 'fixture-yunho',
    vendorName: '윤호수산',
    rawContent: [
      '가격알림',
      '능성어 3~4k 45000',
      '시마아지 1.5~2kg 38000',
      '영업시간 오전 8시'
    ].join('\n')
  },
  {
    id: 'fixture-julpo',
    vendorName: '줄포상회',
    rawContent: [
      '갑각류 시세표',
      '블루 킹크랩 kg 46,000원',
      '마가단 대게 28,000원',
      '위치 노량진'
    ].join('\n')
  }
] as const
