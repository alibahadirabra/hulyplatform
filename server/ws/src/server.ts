//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { readRequest, serialize, Response } from '@anticrm/platform'
import { createServer, IncomingMessage } from 'http'
import WebSocket, { Server } from 'ws'
import { decode } from 'jwt-simple'

/**
 * @internal
 */
export interface _Token {
  workspace: string
}

async function handleRequest<S> (service: S, ws: WebSocket, msg: string): Promise<void> {
  const request = readRequest(msg)
  const f = (service as any)[request.method]
  const result = await f.apply(service, request.params)
  const resp = { id: request.id, result }
  ws.send(serialize(resp))
}

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Session {}

/**
 * @public
 */
export interface JsonRpcServer {
  broadcast: (from: Session, resp: Response<any>) => void
}

/**
 * @public
 * @param sessionFactory -
 * @param port -
 * @param host -
 */
export function start (sessionFactory: (server: JsonRpcServer) => Session, port: number, host?: string): void {
  console.log(`starting server on port ${port} ...`)

  const sessions: [Session, WebSocket][] = []

  const jsonServer: JsonRpcServer = {
    broadcast (from: Session, resp: Response<[]>) {
      console.log('server broadcasting', resp)
      const msg = serialize(resp)
      for (const session of sessions) {
        if (session[0] !== from) { session[1].send(msg) }
      }
    }
  }

  const wss = new Server({ noServer: true })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  wss.on('connection', (ws: WebSocket, request: any, token: _Token) => {
    const service = sessionFactory(jsonServer)
    sessions.push([service, ws])
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    ws.on('message', async (msg: string) => await handleRequest(service, ws, msg))
  })

  const server = createServer()
  server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const token = request.url?.substring(1) // remove leading '/'
    try {
      const payload = decode(token ?? '', 'secret', false)
      console.log('client connected with payload', payload)
      wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request, payload))
    } catch (err) {
      console.log('unauthorized')
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  })

  server.listen(port, host)
}
