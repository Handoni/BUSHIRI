const commandPayload = {
  name: 'bushiri',
  description: 'Manage BUSHIRI seafood market alerts',
  type: 1,
  integration_types: [0],
  contexts: [0],
  options: [
    {
      name: 'watch',
      description: 'Manage watched seafood species',
      type: 2,
      options: [
        {
          name: 'add',
          description: 'Add a species to the watchlist',
          type: 1,
          options: [
            {
              name: 'species',
              description: 'Species name to watch',
              type: 3,
              required: true,
              autocomplete: true
            }
          ]
        },
        {
          name: 'remove',
          description: 'Remove a species from the watchlist',
          type: 1,
          options: [
            {
              name: 'species',
              description: 'Species name to stop watching',
              type: 3,
              required: true,
              autocomplete: true
            }
          ]
        },
        {
          name: 'list',
          description: 'Show watched species',
          type: 1
        }
      ]
    },
    {
      name: 'channel',
      description: 'Manage the Discord alert channel',
      type: 2,
      options: [
        {
          name: 'set',
          description: 'Use this channel for BUSHIRI daily alerts',
          type: 1
        },
        {
          name: 'current',
          description: 'Show the current BUSHIRI daily alert channel',
          type: 1
        }
      ]
    }
  ]
}

const applicationId = process.env.DISCORD_APPLICATION_ID
const botToken = process.env.DISCORD_BOT_TOKEN
const apiBaseUrl = (process.env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10').replace(/\/$/, '')

if (!applicationId || !botToken) {
  console.error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required.')
  process.exit(1)
}

const response = await fetch(`${apiBaseUrl}/applications/${encodeURIComponent(applicationId)}/commands`, {
  method: 'POST',
  headers: {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(commandPayload)
})

const body = await response.text()

if (!response.ok) {
  console.error(`Discord command registration failed with ${response.status}: ${body}`)
  process.exit(1)
}

console.log(`Registered global /${commandPayload.name} command.`)
console.log(body)
