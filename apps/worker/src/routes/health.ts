export function getHealthResponse(): Response {
  return Response.json({
    ok: true,
    service: 'BUSHIRI'
  })
}
