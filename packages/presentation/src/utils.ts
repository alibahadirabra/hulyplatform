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
} from '@hcengineering/core'
import login from '@hcengineering/login'
import { getMetadata } from '@hcengineering/platform'
import { LiveQuery as LQ } from '@hcengineering/query'
import { onDestroy } from 'svelte'
import { deepEqual } from 'fast-equals'
import { IconSize, DropdownIntlItem } from '@hcengineering/ui'
import contact from '@hcengineering/contact'

let liveQuery: LQ
let client: TxOperations

const txListeners: Array<(tx: Tx) => void> = []

/**
 * @public
 */
export function addTxListener (l: (tx: Tx) => void): void {
  txListeners.push(l)
}

/**
 * @public
 */
export function removeTxListener (l: (tx: Tx) => void): void {
  const pos = txListeners.findIndex((it) => it === l)
  if (pos !== -1) {
    txListeners.splice(pos, 1)
  }
}

class UIClient extends TxOperations implements Client {
  constructor (client: Client, private readonly liveQuery: LQ) {
    super(client, getCurrentAccount()._id)
  }

  override async tx (tx: Tx): Promise<TxResult> {
    return await super.tx(tx)
  }
}

/**
 * @public
 */
export function getClient (): TxOperations {
  return client
}

/**
 * @public
 */
export function setClient (_client: Client): void {
  liveQuery = new LQ(_client)
  client = new UIClient(_client, liveQuery)
  _client.notify = (tx: Tx) => {
    liveQuery.tx(tx).catch((err) => console.log(err))

    txListeners.forEach((it) => it(tx))
  }
}

/**
 * @public
 */
export class LiveQuery {
  private oldClass: Ref<Class<Doc>> | undefined
  private oldQuery: DocumentQuery<Doc> | undefined
  private oldOptions: FindOptions<Doc> | undefined
  private oldCallback: ((result: FindResult<any>) => void) | undefined
  unsubscribe = () => {}

  constructor (dontDestroy: boolean = false) {
    if (!dontDestroy) {
      onDestroy(() => {
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
    if (!this.needUpdate(_class, query, callback, options)) {
      return false
    }
    this.unsubscribe()
    this.oldCallback = callback
    this.oldClass = _class
    this.oldOptions = options
    this.oldQuery = query
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

/**
 * @public
 */
export function createQuery (dontDestroy?: boolean): LiveQuery {
  return new LiveQuery(dontDestroy)
}

/**
 * @public
 */
export function getFileUrl (file: string, size: IconSize = 'full'): string {
  const uploadUrl = getMetadata(login.metadata.UploadUrl)
  const token = getMetadata(login.metadata.LoginToken)
  const url = `${uploadUrl as string}?file=${file}&token=${token as string}&size=${size as string}`
  return url
}

/**
 * @public
 */
export async function getBlobURL (blob: Blob): Promise<string> {
  return await new Promise((resolve) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => resolve(reader.result as string), false)
    reader.readAsDataURL(blob)
  })
}

/**
 * @public
 */
export async function copyTextToClipboard (text: string): Promise<void> {
  try {
    // Safari specific behavior
    // see https://bugs.webkit.org/show_bug.cgi?id=222262
    const clipboardItem = new ClipboardItem({
      'text/plain': Promise.resolve(text)
    })
    await navigator.clipboard.write([clipboardItem])
  } catch {
    // Fallback to default clipboard API implementation
    await navigator.clipboard.writeText(text)
  }
}

/**
 * @public
 */
export type AttributeCategory = 'attribute' | 'inplace' | 'collection' | 'array'

/**
 * @public
 */
export const AttributeCategoryOrder = { attribute: 0, inplace: 1, collection: 2, array: 2 }

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
  if (hierarchy.isDerived(attrClass, core.class.TypeMarkup)) {
    category = 'inplace'
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

export const avatarTypeDropdownItems: DropdownIntlItem[] = [
  {
    id: 'color',
    label: contact.string.UseColor
  },
  {
    id: 'image',
    label: contact.string.UseImage
  },
  {
    id: 'gravatar',
    label: contact.string.UseGravatar
  }
]
