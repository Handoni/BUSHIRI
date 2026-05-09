const commandPayloads = [
  {
    name: '관심',
    description: 'BUSHIRI 관심 품목을 관리합니다',
    type: 1,
    integration_types: [0],
    contexts: [0],
    options: [
      {
        name: '추가',
        description: '관심 품목을 추가합니다',
        type: 1,
        options: [
          {
            name: '품목',
            description: '관심 목록에 추가할 품목',
            type: 3,
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: '제거',
        description: '관심 품목을 제거합니다',
        type: 1,
        options: [
          {
            name: '품목',
            description: '관심 목록에서 제거할 품목',
            type: 3,
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: '목록',
        description: '관심 품목 목록을 봅니다',
        type: 1
      }
    ]
  },
  {
    name: '채널',
    description: 'BUSHIRI 알림 채널을 관리합니다',
    type: 1,
    integration_types: [0],
    contexts: [0],
    options: [
      {
        name: '설정',
        description: '현재 채널을 BUSHIRI 알림방으로 설정합니다',
        type: 1
      },
      {
        name: '확인',
        description: '현재 BUSHIRI 알림방을 확인합니다',
        type: 1
      }
    ]
  }
]

const applicationId = process.env.DISCORD_APPLICATION_ID
const botToken = process.env.DISCORD_BOT_TOKEN
const apiBaseUrl = (process.env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10').replace(/\/$/, '')

if (!applicationId || !botToken) {
  console.error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required.')
  process.exit(1)
}

const response = await fetch(`${apiBaseUrl}/applications/${encodeURIComponent(applicationId)}/commands`, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(commandPayloads)
})

const body = await response.text()

if (!response.ok) {
  console.error(`Discord command registration failed with ${response.status}: ${body}`)
  process.exit(1)
}

console.log(`Registered ${commandPayloads.length} global BUSHIRI commands.`)
console.log(body)
