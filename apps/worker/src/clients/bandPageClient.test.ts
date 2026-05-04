import { describe, expect, it } from 'vitest'
import { BandPageError, createBandPageClient, parseBandPageIdentifier } from './bandPageClient'

describe('parseBandPageIdentifier', () => {
  it('accepts page prefixes, plain ids, and BAND Page URLs', () => {
    expect(parseBandPageIdentifier('page:96034341')).toMatchObject({
      pageId: '96034341',
      postId: null,
      publicUrl: 'https://www.band.us/page/96034341/post'
    })

    expect(parseBandPageIdentifier('96034341')).toMatchObject({
      pageId: '96034341',
      postId: null
    })

    expect(parseBandPageIdentifier('https://www.band.us/page/96034341/post/1795')).toMatchObject({
      pageId: '96034341',
      postId: '1795',
      publicUrl: 'https://www.band.us/page/96034341/post/1795'
    })
  })
})

describe('createBandPageClient', () => {
  it('reads and hydrates BAND Page posts with a web cookie', async () => {
    const requestedUrls: string[] = []
    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(String(input))
      requestedUrls.push(url.toString())

      if (url.pathname.endsWith('/search_for_posts_with_page')) {
        return Response.json({
          result_code: 1,
          result_data: {
            items: [
              {
                post_no: 1795,
                title: '오늘 시세표',
                content: '요약 본문',
                created_at: Date.UTC(2026, 4, 4, 1, 0, 0)
              }
            ]
          }
        })
      }

      if (url.pathname.endsWith('/find_posts_item')) {
        return Response.json({
          result_code: 1,
          result_data: {
            post: {
              post_no: 1795,
              title: '오늘 시세표',
              content: '참조은수산 전체 가격 본문',
              created_at: Date.UTC(2026, 4, 4, 1, 0, 0)
            }
          }
        })
      }

      return Response.json({ result_code: 1, result_data: {} })
    }

    const client = createBandPageClient(fakeFetch)
    const posts = await client.getPosts({
      pageIdOrUrl: 'page:96034341',
      cookie: 'NID_AUT=sample',
      limit: 3
    })

    expect(posts).toEqual([
      {
        postKey: '1795',
        pageId: '96034341',
        content: '참조은수산 전체 가격 본문',
        createdAt: Date.UTC(2026, 4, 4, 1, 0, 0),
        url: 'https://www.band.us/page/96034341/post/1795',
        title: '오늘 시세표',
        isPartial: false
      }
    ])
    expect(requestedUrls.some((url) => url.includes('search_for_posts_with_page'))).toBe(true)
    expect(requestedUrls.some((url) => url.includes('find_posts_item'))).toBe(true)
  })

  it('reports that a page list requires a web cookie', async () => {
    const fakeFetch: typeof fetch = async () => Response.json({})
    const client = createBandPageClient(fakeFetch)

    await expect(client.getPosts({ pageIdOrUrl: 'page:96034341' })).rejects.toMatchObject({
      reason: 'page_cookie_missing'
    })
  })

  it('maps BAND web unauthorized responses to page_unauthorized', async () => {
    const fakeFetch: typeof fetch = async () =>
      Response.json({
        result_code: 200,
        result_data: {
          message: 'You are not authorized.'
        }
      })
    const client = createBandPageClient(fakeFetch)

    await expect(client.getPosts({ pageIdOrUrl: 'page:96034341', cookie: 'expired=true' })).rejects.toBeInstanceOf(
      BandPageError
    )
    await expect(client.getPosts({ pageIdOrUrl: 'page:96034341', cookie: 'expired=true' })).rejects.toMatchObject({
      reason: 'page_unauthorized'
    })
  })
})
