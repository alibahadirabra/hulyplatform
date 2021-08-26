//
// Copyright © 2020 Anticrm Platform Contributors.
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

import type { Tx, Storage, Ref, Doc, Class, DocumentQuery, FindResult, FindOptions, TxHander, ServerStorage } from '@anticrm/core'
import { DOMAIN_TX } from '@anticrm/core'
import { createInMemoryAdapter, createInMemoryTxAdapter } from '@anticrm/dev-storage'
import { createServerStorage } from '@anticrm/server-core'
import type { DbConfiguration } from '@anticrm/server-core'

class ServerStorageWrapper implements Storage {
  constructor (private readonly storage: ServerStorage, private readonly handler: TxHander) {}

  findAll <T extends Doc>(_class: Ref<Class<T>>, query: DocumentQuery<T>, options?: FindOptions<T>): Promise<FindResult<T>> {
    return this.storage.findAll(_class, query, options)
  }

  async tx (tx: Tx): Promise<void> {
    const derived = await this.storage.tx(tx)
    for (const tx of derived) { this.handler(tx) }
  }
}

export async function connect (handler: (tx: Tx) => void): Promise<Storage> {
  const conf: DbConfiguration = {
    domains: {
      [DOMAIN_TX]: 'InMemoryTx'
    },
    defaultAdapter: 'InMemory',
    adapters: {
      InMemoryTx: {
        factory: createInMemoryTxAdapter,
        url: ''
      },
      InMemory: {
        factory: createInMemoryAdapter,
        url: ''
      }
    },
    workspace: ''
  }
  const serverStorage = await createServerStorage(conf)
  return new ServerStorageWrapper(serverStorage, handler)
}
