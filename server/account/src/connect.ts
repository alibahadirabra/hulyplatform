//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
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

import client from '@anticrm/client'
import clientResources from '@anticrm/client-resources'
import { Client } from '@anticrm/core'
import { getMetadata, setMetadata } from '@anticrm/platform'
import { encode } from 'jwt-simple'
import accountPlugin from '.'

// eslint-disable-next-line
const WebSocket = require('ws')

export async function connect (transactorUrl: string, workspace: string, email?: string): Promise<Client> {
  const token = encode(
    { email: email ?? 'anticrm@hc.engineering', workspace },
    getMetadata(accountPlugin.metadata.Secret) ?? 'secret'
  )

  // We need to override default factory with 'ws' one.
  setMetadata(client.metadata.ClientSocketFactory, (url) => new WebSocket(url))
  return await (await clientResources()).function.GetClient(token, transactorUrl)
}
