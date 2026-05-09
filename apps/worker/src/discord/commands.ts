export const BUSHIRI_COMMAND_PAYLOAD = {
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
} as const
