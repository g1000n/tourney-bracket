// Keeps track of browsers that are watching for live updates.

const MAX_TOTAL = 500
const MAX_PER_ADDRESS = 6
const HEARTBEAT_MS = 25000

const clients = new Set()

export function subscribe(request, response, address) {
  const addressCount = [...clients]
    .filter((client) => client.address === address)
    .length

  if (clients.size >= MAX_TOTAL || addressCount >= MAX_PER_ADDRESS) {
    return response.status(429).json({
      error: 'Too many live connections.',
    })
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  response.write('retry: 5000\n\n')

  const client = {
    response,
    address,
  }

  clients.add(client)

  const heartbeat = setInterval(() => {
    response.write(': ping\n\n')
  }, HEARTBEAT_MS)

  request.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(client)
  })
}

export function broadcast(event) {
  const message = `data: ${JSON.stringify(event)}\n\n`

  for (const client of clients) {
    client.response.write(message)
  }
}