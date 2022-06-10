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

import core, {
  AnyAttribute,
  ArrOf,
  AttachedDoc,
  Class,
  Client,
  Collection,
  Doc,
  DocumentQuery,
  FindOptions,
  FindResult,
  getCurrentAccount,
  Hierarchy,
  Ref,
  RefTo,
  Tx,
  TxOperations,
  TxResult
} from '@anticrm/core'
import login from '@anticrm/login'
import { getMetadata } from '@anticrm/platform'
import { LiveQuery as LQ } from '@anticrm/query'
import { onDestroy } from 'svelte'
import { deepEqual } from 'fast-equals'

let liveQuery: LQ
let client: TxOperations

const txListeners: Array<(tx: Tx) => void> = []

export function addTxListener (l: (tx: Tx) => void): void {
  txListeners.push(l)
}

class UIClient extends TxOperations implements Client {
  constructor (client: Client, private readonly liveQuery: LQ) {
    super(client, getCurrentAccount()._id)
  }

  override async tx (tx: Tx): Promise<TxResult> {
    return await super.tx(tx)
  }
}

export function getClient (): TxOperations {
  return client
}

export function setClient (_client: Client): void {
  liveQuery = new LQ(_client)
  client = new UIClient(_client, liveQuery)
  _client.notify = (tx: Tx) => {
    liveQuery.tx(tx).catch((err) => console.log(err))

    txListeners.forEach((it) => it(tx))
  }
}

export class LiveQuery {
  private oldClass: Ref<Class<Doc>> | undefined
  private oldQuery: DocumentQuery<Doc> | undefined
  private oldOptions: FindOptions<Doc> | undefined
  private oldCallback: ((result: FindResult<any>) => void) | undefined
  unsubscribe = () => {}

  constructor (dontDestroy: boolean = false) {
    if (!dontDestroy) {
      onDestroy(() => {
        console.log('onDestroy query')
        this.unsubscribe()
      })
    }
  }

  query<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    callback: (result: FindResult<T>) => void,
    options?: FindOptions<T>
  ): boolean {
    console.log(_class, query, callback, options)
    if (!this.needUpdate(_class, query, callback, options)) {
      console.log('matched')
      return false
    }
    this.oldCallback = callback
    this.oldClass = _class
    this.oldOptions = options
    this.oldQuery = query
    this.unsubscribe()
    const unsub = liveQuery.query(_class, query, callback, options)
    this.unsubscribe = () => {
      unsub()
      this.oldCallback = undefined
      this.oldClass = undefined
      this.oldOptions = undefined
      this.oldQuery = undefined
      this.unsubscribe = () => {}
    }
    return true
  }

  private needUpdate<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    callback: (result: FindResult<T>) => void,
    options?: FindOptions<T>
  ): boolean {
    if (!deepEqual(_class, this.oldClass)) return true
    if (!deepEqual(query, this.oldQuery)) return true
    if (!deepEqual(callback.toString(), this.oldCallback?.toString())) return true
    if (!deepEqual(options, this.oldOptions)) return true
    return false
  }
}

export function createQuery (dontDestroy?: boolean): LiveQuery {
  return new LiveQuery(dontDestroy)
}

export function getFileUrl (file: string): string {
  const uploadUrl = getMetadata(login.metadata.UploadUrl)
  const token = getMetadata(login.metadata.LoginToken)
  const url = `${uploadUrl as string}?file=${file}&token=${token as string}`
  return url
}

export async function getBlobURL (blob: Blob): Promise<string> {
  return await new Promise((resolve) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => resolve(reader.result as string), false)
    reader.readAsDataURL(blob)
  })
}

export type AttributeCategory = 'attribute' | 'collection' | 'array'
/**
 * @public
 */
export function getAttributePresenterClass (
  hierarchy: Hierarchy,
  attribute: AnyAttribute
): { attrClass: Ref<Class<Doc>>, category: AttributeCategory } {
  let attrClass = attribute.type._class
  let category: AttributeCategory = 'attribute'
  if (hierarchy.isDerived(attrClass, core.class.RefTo)) {
    attrClass = (attribute.type as RefTo<Doc>).to
    category = 'attribute'
  }
  if (hierarchy.isDerived(attrClass, core.class.Collection)) {
    attrClass = (attribute.type as Collection<AttachedDoc>).of
    category = 'collection'
  }
  if (hierarchy.isDerived(attrClass, core.class.ArrOf)) {
    const of = (attribute.type as ArrOf<AttachedDoc>).of
    attrClass = of._class === core.class.RefTo ? (of as RefTo<Doc>).to : of._class
    category = 'array'
  }
  return { attrClass, category }
}
