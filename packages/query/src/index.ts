//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
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
  AttachedDoc,
  checkMixinKey,
  Class,
  Client,
  Doc,
  DocumentQuery,
  FindOptions,
  findProperty,
  FindResult,
  getObjectValue,
  Hierarchy,
  Lookup,
  LookupData,
  matchQuery,
  ModelDb,
  Ref,
  resultSort,
  ReverseLookups,
  SortingQuery,
  toFindResult,
  Tx,
  TxBulkWrite,
  TxCollectionCUD,
  TxCreateDoc,
  TxMixin,
  TxProcessor,
  TxPutBag,
  TxRemoveDoc,
  TxResult,
  TxUpdateDoc,
  WithLookup
} from '@anticrm/core'
import { deepEqual } from 'fast-equals'

const CACHE_SIZE = 20

type Callback = (result: FindResult<Doc>) => void

interface Query {
  _class: Ref<Class<Doc>>
  query: DocumentQuery<Doc>
  result: Doc[] | Promise<Doc[]>
  options?: FindOptions<Doc>
  total: number
  callbacks: Callback[]
}

/**
 * @public
 */
export class LiveQuery extends TxProcessor implements Client {
  private readonly client: Client
  private readonly queries: Map<Ref<Class<Doc>>, Query[]> = new Map<Ref<Class<Doc>>, Query[]>()
  private readonly queue: Query[] = []

  constructor (client: Client) {
    super()
    this.client = client
  }

  async close (): Promise<void> {
    return await this.client.close()
  }

  getHierarchy (): Hierarchy {
    return this.client.getHierarchy()
  }

  getModel (): ModelDb {
    return this.client.getModel()
  }

  private match (q: Query, doc: Doc): boolean {
    if (!this.getHierarchy().isDerived(doc._class, q._class)) {
      // Check if it is not a mixin and not match class
      const mixinClass = Hierarchy.mixinClass(doc)
      if (mixinClass === undefined || !this.getHierarchy().isDerived(mixinClass, q._class)) {
        return false
      }
    }
    const query = q.query
    for (const key in query) {
      if (key === '$search') continue
      const value = (query as any)[key]
      const result = findProperty([doc], key, value)
      if (result.length === 0) {
        return false
      }
    }
    return true
  }

  async findAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    return await this.client.findAll(_class, query, options)
  }

  async findOne<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<WithLookup<T> | undefined> {
    return await this.client.findOne(_class, query, options)
  }

  private findQuery<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Query | undefined {
    const queries = this.queries.get(_class)
    if (queries === undefined) return
    for (const q of queries) {
      if (!deepEqual(query, q.query) || !deepEqual(options, q.options)) continue
      return q
    }
  }

  private removeFromQueue (q: Query): void {
    if (q.callbacks.length === 0) {
      const queueIndex = this.queue.indexOf(q)
      if (queueIndex !== -1) {
        this.queue.splice(queueIndex, 1)
      }
    }
  }

  private pushCallback (q: Query, callback: (result: Doc[]) => void): void {
    q.callbacks.push(callback)
    setTimeout(async () => {
      if (q !== undefined) {
        await this.callback(q)
      }
    }, 0)
  }

  private getQuery<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    callback: (result: Doc[]) => void,
    options?: FindOptions<T>
  ): Query | undefined {
    const current = this.findQuery(_class, query, options)
    if (current !== undefined) {
      this.removeFromQueue(current)
      this.pushCallback(current, callback)

      return current
    }
  }

  private createQuery<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    callback: (result: FindResult<T>) => void,
    options?: FindOptions<T>
  ): Query {
    const queries = this.queries.get(_class) ?? []
    const result = this.client.findAll(_class, query, options)
    const q: Query = {
      _class,
      query,
      result,
      total: 0,
      options: options as FindOptions<Doc>,
      callbacks: [callback as (result: Doc[]) => void]
    }
    queries.push(q)
    result
      .then(async (result) => {
        q.total = result.total
        await this.callback(q)
      })
      .catch((err) => {
        console.log('failed to update Live Query: ', err)
      })

    this.queries.set(_class, queries)
    while (this.queue.length > CACHE_SIZE) {
      this.remove()
    }
    return q
  }

  private remove (): void {
    const q = this.queue.shift()
    if (q === undefined) return
    const queries = this.queries.get(q._class)
    queries?.splice(queries.indexOf(q), 1)
    if (queries?.length === 0) {
      this.queries.delete(q._class)
    }
  }

  query<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    callback: (result: FindResult<T>) => void,
    options?: FindOptions<T>
  ): () => void {
    const q =
      this.getQuery(_class, query, callback as (result: Doc[]) => void, options) ??
      this.createQuery(_class, query, callback, options)

    return () => {
      const index = q.callbacks.indexOf(callback as (result: Doc[]) => void)
      if (index !== -1) {
        q.callbacks.splice(index, 1)
      }
      if (q.callbacks.length === 0) {
        this.queue.push(q)
      }
    }
  }

  protected override async txPutBag (tx: TxPutBag<any>): Promise<TxResult> {
    for (const queries of this.queries.values()) {
      for (const q of queries) {
        if (q.result instanceof Promise) {
          q.result = await q.result
        }
        const updatedDoc = q.result.find((p) => p._id === tx.objectId)
        if (updatedDoc !== undefined) {
          const doc = updatedDoc as any
          let bag = doc[tx.bag]
          if (bag === undefined) {
            doc[tx.bag] = bag = {}
          }
          bag[tx.key] = tx.value
          await this.updatedDocCallback(updatedDoc, q)
        }
      }
    }
    return {}
  }

  protected override async txMixin (tx: TxMixin<Doc, Doc>): Promise<TxResult> {
    const hierarchy = this.client.getHierarchy()
    for (const queries of this.queries) {
      const isTx = hierarchy.isDerived(queries[0], core.class.Tx)
      const isMixin = hierarchy.isDerived(tx.mixin, queries[0])
      for (const q of queries[1]) {
        if (isTx) {
          // handle add since Txes are immutable
          await this.handleDocAdd(q, tx)
          continue
        }
        if (q.result instanceof Promise) {
          q.result = await q.result
        }
        let updatedDoc = q.result.find((p) => p._id === tx.objectId)
        if (updatedDoc !== undefined) {
          // Create or apply mixin value
          updatedDoc = TxProcessor.updateMixin4Doc(updatedDoc, tx)
          await this.__updateLookup(q, updatedDoc, tx.attributes)
          await this.updatedDocCallback(updatedDoc, q)
        } else if (isMixin) {
          // Mixin potentially added to object we doesn't have in out results
          const doc = await this.findOne(q._class, { _id: tx.objectId }, q.options)
          if (doc !== undefined) {
            await this.handleDocAdd(q, doc, false)
          }
        }
      }
    }
    return {}
  }

  protected async txCollectionCUD (tx: TxCollectionCUD<Doc, AttachedDoc>): Promise<TxResult> {
    for (const queries of this.queries) {
      const isTx = this.client.getHierarchy().isDerived(queries[0], core.class.Tx)
      for (const q of queries[1]) {
        if (isTx) {
          // handle add since Txes are immutable
          await this.handleDocAdd(q, tx)
          continue
        }

        if (tx.tx._class === core.class.TxCreateDoc) {
          const createTx = tx.tx as TxCreateDoc<AttachedDoc>
          const d: TxCreateDoc<AttachedDoc> = {
            ...createTx,
            attributes: {
              ...createTx.attributes,
              attachedTo: tx.objectId,
              attachedToClass: tx.objectClass,
              collection: tx.collection
            }
          }
          await this.handleDocAdd(q, TxProcessor.createDoc2Doc(d))
        } else if (tx.tx._class === core.class.TxUpdateDoc) {
          await this.handleDocUpdate(q, tx.tx as unknown as TxUpdateDoc<Doc>)
        } else if (tx.tx._class === core.class.TxRemoveDoc) {
          await this.handleDocRemove(q, tx.tx as unknown as TxRemoveDoc<Doc>)
        }
      }
    }
    return {}
  }

  protected async txUpdateDoc (tx: TxUpdateDoc<Doc>): Promise<TxResult> {
    for (const queries of this.queries) {
      const isTx = this.client.getHierarchy().isDerived(queries[0], core.class.Tx)
      for (const q of queries[1]) {
        if (isTx) {
          // handle add since Txes are immutable
          await this.handleDocAdd(q, tx)
          continue
        }
        await this.handleDocUpdate(q, tx)
      }
    }
    return {}
  }

  private async handleDocUpdate (q: Query, tx: TxUpdateDoc<Doc>): Promise<void> {
    if (q.result instanceof Promise) {
      q.result = await q.result
    }
    const pos = q.result.findIndex((p) => p._id === tx.objectId)
    if (pos !== -1) {
      // If query contains search we must check use fulltext
      if (q.query.$search != null && q.query.$search.length > 0) {
        const match = await this.findOne(q._class, { $search: q.query.$search, _id: tx.objectId }, q.options)
        if (match === undefined) {
          q.result.splice(pos, 1)
          q.total--
        } else {
          q.result[pos] = match
        }
      } else {
        const updatedDoc = q.result[pos]
        if (updatedDoc.modifiedOn > tx.modifiedOn) return
        if (updatedDoc.modifiedOn === tx.modifiedOn) {
          const current = await this.findOne(q._class, { _id: updatedDoc._id }, q.options)
          if (current !== undefined) {
            q.result[pos] = current
          } else {
            q.result.splice(pos, 1)
            q.total--
          }
        } else {
          await this.__updateDoc(q, updatedDoc, tx)
          if (!this.match(q, updatedDoc)) {
            q.result.splice(pos, 1)
            q.total--
          } else {
            q.result[pos] = updatedDoc
          }
        }
      }
      this.sort(q, tx)
      await this.updatedDocCallback(q.result[pos], q)
    } else if (await this.matchQuery(q, tx)) {
      this.sort(q, tx)
      await this.updatedDocCallback(q.result[pos], q)
    }
    await this.handleDocUpdateLookup(q, tx)
  }

  private async handleDocUpdateLookup (q: Query, tx: TxUpdateDoc<Doc>): Promise<void> {
    if (q.options?.lookup === undefined) return
    const lookup = q.options.lookup
    if (q.result instanceof Promise) {
      q.result = await q.result
    }
    let needCallback = false
    needCallback = await this.proccesLookupUpdateDoc(q.result, lookup, tx)

    if (needCallback) {
      if (q.options?.sort !== undefined) {
        resultSort(q.result, q.options?.sort, q._class, this.getHierarchy())
      }
      await this.callback(q)
    }
  }

  private async proccesLookupUpdateDoc (docs: Doc[], lookup: Lookup<Doc>, tx: TxUpdateDoc<Doc>): Promise<boolean> {
    let needCallback = false
    const lookupWays = this.getLookupWays(lookup, tx.objectClass)
    for (const lookupWay of lookupWays) {
      const [objWay, key, reverseLookupKey] = lookupWay
      for (const resDoc of docs) {
        const obj = getObjectValue(objWay, resDoc)
        if (obj === undefined) continue
        const value = getObjectValue('$lookup.' + key, obj)
        if (Array.isArray(value)) {
          let index = value.findIndex((p) => p._id === tx.objectId)
          if (this.client.getHierarchy().isDerived(tx.objectClass, core.class.AttachedDoc)) {
            if (reverseLookupKey !== undefined) {
              const reverseLookupValue = (tx.operations as any)[reverseLookupKey]
              if (index !== -1 && reverseLookupValue !== obj._id) {
                value.splice(index, 1)
                index = -1
                needCallback = true
              } else if (index === -1 && reverseLookupValue === obj._id) {
                const doc = await this.client.findOne(tx.objectClass, { _id: tx.objectId })
                value.push(doc)
                index = value.length - 1
                needCallback = true
              }
            }
          }
          if (index !== -1) {
            TxProcessor.updateDoc2Doc(value[index], tx)
            needCallback = true
          }
        } else {
          if (obj[key] === tx.objectId) {
            TxProcessor.updateDoc2Doc(obj.$lookup[key], tx)
            needCallback = true
          }
        }
      }
    }
    return needCallback
  }

  /**
   * Clone document with respect to mixin inner document cloning.
   */
  private clone<T extends Doc>(results: T[]): T[] {
    return this.getHierarchy().clone(results) as T[]
  }

  private async refresh (q: Query): Promise<void> {
    const res = await this.client.findAll(q._class, q.query, q.options)
    q.result = res
    q.total = res.total
    await this.callback(q)
  }

  // Check if query is partially matched.
  private async matchQuery (q: Query, tx: TxUpdateDoc<Doc>): Promise<boolean> {
    if (!this.client.getHierarchy().isDerived(tx.objectClass, q._class)) {
      return false
    }

    const doc: Doc = {
      _id: tx.objectId,
      _class: tx.objectClass,
      modifiedBy: tx.modifiedBy,
      modifiedOn: tx.modifiedOn,
      space: tx.objectSpace
    }

    TxProcessor.updateDoc2Doc(doc, tx)

    let matched = false
    for (const key in q.query) {
      const value = (q.query as any)[key]
      const tkey = checkMixinKey(key, q._class, this.client.getHierarchy())
      if ((doc as any)[tkey] === undefined) continue
      const res = findProperty([doc], tkey, value)
      if (res.length === 0) {
        return false
      } else {
        matched = true
      }
    }

    if (matched) {
      const realDoc = await this.client.findOne(q._class, { _id: doc._id }, q.options)
      if (realDoc === undefined) return false
      const res = matchQuery([realDoc], q.query, q._class, this.client.getHierarchy())
      if (res.length === 1) {
        if (q.result instanceof Promise) {
          q.result = await q.result
        }
        q.result.push(res[0])
        return true
      }
    }
    return false
  }

  private async getLookupValue<T extends Doc>(
    _class: Ref<Class<T>>,
    doc: T,
    lookup: Lookup<T>,
    result: LookupData<T>
  ): Promise<void> {
    for (const key in lookup) {
      if (key === '_id') {
        await this.getReverseLookupValue(doc, lookup, result)
        continue
      }
      const value = (lookup as any)[key]
      const tkey = checkMixinKey(key, _class, this.client.getHierarchy())
      if (Array.isArray(value)) {
        const [_class, nested] = value
        const objects = await this.findAll(_class, { _id: getObjectValue(tkey, doc) })
        ;(result as any)[key] = objects[0]
        const nestedResult = {}
        const parent = (result as any)[key]
        await this.getLookupValue(_class, parent, nested, nestedResult)
        Object.assign(parent, {
          $lookup: nestedResult
        })
      } else {
        const objects = await this.findAll(value, { _id: getObjectValue(tkey, doc) })
        ;(result as any)[key] = objects[0]
      }
    }
  }

  private async getReverseLookupValue<T extends Doc>(
    doc: T,
    lookup: ReverseLookups,
    result: LookupData<T>
  ): Promise<void> {
    for (const key in lookup._id) {
      const value = lookup._id[key]

      let _class: Ref<Class<Doc>>
      let attr = 'attachedTo'

      if (Array.isArray(value)) {
        _class = value[0]
        attr = value[1]
      } else {
        _class = value
      }
      const objects = await this.findAll(_class, { [attr]: doc._id })
      ;(result as any)[key] = objects
    }
  }

  private async lookup<T extends Doc>(_class: Ref<Class<T>>, doc: T, lookup: Lookup<T>): Promise<void> {
    const result: LookupData<Doc> = {}
    await this.getLookupValue(_class, doc, lookup, result)
    ;(doc as WithLookup<Doc>).$lookup = result
  }

  protected async txCreateDoc (tx: TxCreateDoc<Doc>): Promise<TxResult> {
    const docTx = TxProcessor.createDoc2Doc(tx)
    for (const queries of this.queries) {
      const doc = this.client.getHierarchy().isDerived(queries[0], core.class.Tx) ? tx : docTx
      for (const q of queries[1]) {
        await this.handleDocAdd(q, doc)
      }
    }
    return {}
  }

  private async handleDocAdd (q: Query, doc: Doc, handleLookup = true): Promise<void> {
    if (this.match(q, doc)) {
      if (q.result instanceof Promise) {
        q.result = await q.result
      }

      if (q.options?.lookup !== undefined && handleLookup) {
        await this.lookup(q._class, doc, q.options.lookup)
      }
      // We could already have document inside results, if query is created during processing of document create transaction and not yet handled on client.
      const pos = q.result.findIndex((p) => p._id === doc._id)
      if (pos >= 0) {
        // No need to update, document already in results.
        return
      }

      // If query contains search we must check use fulltext
      if (q.query.$search != null && q.query.$search.length > 0) {
        const match = await this.findOne(q._class, { $search: q.query.$search, _id: doc._id }, q.options)
        if (match === undefined) return
      }
      q.result.push(doc)
      q.total++

      if (q.options?.sort !== undefined) {
        resultSort(q.result, q.options?.sort, q._class, this.getHierarchy())
      }

      if (q.options?.limit !== undefined && q.result.length > q.options.limit) {
        if (q.result.pop()?._id !== doc._id) {
          await this.callback(q)
        }
      } else {
        await this.callback(q)
      }
    }

    await this.handleDocAddLookup(q, doc)
  }

  private async callback (q: Query): Promise<void> {
    if (q.result instanceof Promise) {
      q.result = await q.result
    }
    const result = q.result
    q.callbacks.forEach((callback) => {
      callback(toFindResult(this.clone(result), q.total))
    })
  }

  private async handleDocAddLookup (q: Query, doc: Doc): Promise<void> {
    if (q.options?.lookup === undefined) return
    const lookup = q.options.lookup
    if (q.result instanceof Promise) {
      q.result = await q.result
    }
    let needCallback = false
    needCallback = this.proccesLookupAddDoc(q.result, lookup, doc)

    if (needCallback) {
      if (q.options?.sort !== undefined) {
        resultSort(q.result, q.options?.sort, q._class, this.getHierarchy())
      }
      await this.callback(q)
    }
  }

  private proccesLookupAddDoc (docs: Doc[], lookup: Lookup<Doc>, doc: Doc): boolean {
    let needCallback = false
    const lookupWays = this.getLookupWays(lookup, doc._class)
    for (const lookupWay of lookupWays) {
      const [objWay, key, reverseLookupKey] = lookupWay
      for (const resDoc of docs) {
        const obj = getObjectValue(objWay, resDoc)
        if (obj === undefined) continue
        const value = getObjectValue('$lookup.' + key, obj)
        if (Array.isArray(value)) {
          if (this.client.getHierarchy().isDerived(doc._class, core.class.AttachedDoc)) {
            if (reverseLookupKey !== undefined && (doc as any)[reverseLookupKey] === obj._id) {
              value.push(doc)
              needCallback = true
            }
          }
        } else {
          if (obj[key] === doc._id) {
            obj.$lookup[key] = doc
            needCallback = true
          }
        }
      }
    }
    return needCallback
  }

  protected async txRemoveDoc (tx: TxRemoveDoc<Doc>): Promise<TxResult> {
    for (const queries of this.queries) {
      const isTx = this.client.getHierarchy().isDerived(queries[0], core.class.Tx)
      for (const q of queries[1]) {
        if (isTx) {
          // handle add since Txes are immutable
          await this.handleDocAdd(q, tx)
          continue
        }
        await this.handleDocRemove(q, tx)
      }
    }
    return {}
  }

  private async handleDocRemove (q: Query, tx: TxRemoveDoc<Doc>): Promise<void> {
    if (q.result instanceof Promise) {
      q.result = await q.result
    }
    if (
      q.options?.limit !== undefined &&
      q.options.limit === q.result.length &&
      this.client.getHierarchy().isDerived(q._class, tx.objectClass)
    ) {
      return await this.refresh(q)
    }
    const index = q.result.findIndex((p) => p._id === tx.objectId)
    if (index > -1) {
      q.result.splice(index, 1)
      q.total--
      await this.callback(q)
    }
    await this.handleDocRemoveLookup(q, tx)
  }

  private async handleDocRemoveLookup (q: Query, tx: TxRemoveDoc<Doc>): Promise<void> {
    if (q.options?.lookup === undefined) return
    let needCallback = false
    const lookupWays = this.getLookupWays(q.options.lookup, tx.objectClass)
    if (lookupWays.length === 0) return
    if (q.result instanceof Promise) {
      q.result = await q.result
    }
    for (const lookupWay of lookupWays) {
      const [objWay, key] = lookupWay
      const docs = q.result
      for (const doc of docs) {
        const obj = getObjectValue(objWay, doc)
        if (obj === undefined) continue
        const value = getObjectValue('$lookup.' + key, obj)
        if (value === undefined) continue
        if (Array.isArray(value)) {
          const index = value.findIndex((p) => p._id === tx.objectId)
          if (index !== -1) {
            value.splice(index, 1)
            needCallback = true
          }
        } else {
          if (value._id === tx.objectId) {
            obj.$lookup[key] = undefined
            needCallback = true
          }
        }
      }
    }
    if (needCallback) {
      if (q.options?.sort !== undefined) {
        resultSort(q.result, q.options?.sort, q._class, this.getHierarchy())
      }
      await this.callback(q)
    }
  }

  private getLookupWays (
    lookup: Lookup<Doc>,
    _class: Ref<Class<Doc>>,
    parent: string = ''
  ): [string, string, string?][] {
    const result: [string, string, string?][] = []
    const hierarchy = this.client.getHierarchy()
    if (lookup._id !== undefined) {
      for (const key in lookup._id) {
        const value = (lookup._id as any)[key]
        const [valueClass, reverseLookupKey] = Array.isArray(value) ? value : [value, 'attachedTo']
        const clazz = hierarchy.isMixin(valueClass) ? hierarchy.getBaseClass(valueClass) : valueClass
        if (hierarchy.isDerived(_class, clazz)) {
          result.push([parent, key, reverseLookupKey])
        }
      }
    }
    for (const key in lookup) {
      if (key === '_id') continue
      const value = (lookup as any)[key]
      if (Array.isArray(value)) {
        const clazz = hierarchy.isMixin(value[0]) ? hierarchy.getBaseClass(value[0]) : value[0]
        if (hierarchy.isDerived(_class, clazz)) {
          result.push([parent, key])
        }
        const lookupKey = '$lookup.' + key
        const newParent = parent.length > 0 ? parent + '.' + lookupKey : lookupKey
        const nested = this.getLookupWays(value[1], _class, newParent)
        if (nested.length > 0) {
          result.push(...nested)
        }
      } else {
        const clazz = hierarchy.isMixin(value) ? hierarchy.getBaseClass(value) : value
        if (hierarchy.isDerived(_class, clazz)) {
          result.push([parent, key])
        }
      }
    }
    return result
  }

  protected override async txBulkWrite (tx: TxBulkWrite): Promise<TxResult> {
    return await super.txBulkWrite(tx)
  }

  async tx (tx: Tx): Promise<TxResult> {
    return await super.tx(tx)
  }

  private async __updateLookup (q: Query, updatedDoc: WithLookup<Doc>, ops: any): Promise<void> {
    for (const key in ops) {
      if (!key.startsWith('$')) {
        if (q.options !== undefined) {
          const lookup = (q.options.lookup as any)?.[key]
          if (lookup !== undefined) {
            const lookupClass = getLookupClass(lookup)
            const nestedLookup = getNestedLookup(lookup)
            if (Array.isArray(ops[key])) {
              ;(updatedDoc.$lookup as any)[key] = await this.client.findAll(
                lookupClass,
                { _id: { $in: ops[key] } },
                { lookup: nestedLookup }
              )
            } else {
              ;(updatedDoc.$lookup as any)[key] = await this.client.findOne(
                lookupClass,
                { _id: ops[key] },
                { lookup: nestedLookup }
              )
            }
          }
        }
      } else {
        if (key === '$push') {
          const pops = ops[key] ?? {}
          for (const pkey of Object.keys(pops)) {
            if (q.options !== undefined) {
              const lookup = (q.options.lookup as any)?.[pkey]
              if (lookup !== undefined) {
                const lookupClass = getLookupClass(lookup)
                const nestedLookup = getNestedLookup(lookup)
                const pp = updatedDoc.$lookup as any
                if (pp[pkey] === undefined) {
                  pp[pkey] = []
                }
                if (Array.isArray(pops[pkey])) {
                  const pushData = await this.client.findAll(
                    lookupClass,
                    { _id: { $in: pops[pkey] } },
                    { lookup: nestedLookup }
                  )
                  pp[pkey].push(...pushData)
                } else {
                  pp[pkey].push(await this.client.findOne(lookupClass, { _id: pops[pkey] }, { lookup: nestedLookup }))
                }
              }
            }
          }
        } else if (key === '$pull') {
          const pops = ops[key] ?? {}
          for (const pkey of Object.keys(pops)) {
            if (q.options !== undefined) {
              const lookup = (q.options.lookup as any)?.[pkey]
              if (lookup !== undefined) {
                const pid = pops[pkey]
                const pp = updatedDoc.$lookup as any
                if (pp[pkey] === undefined) {
                  pp[pkey] = []
                }
                if (Array.isArray(pid)) {
                  pp[pkey] = pp[pkey].filter((it: Doc) => !pid.includes(it._id))
                } else {
                  pp[pkey] = pp[pkey].filter((it: Doc) => it._id !== pid)
                }
              }
            }
          }
        }
      }
    }
  }

  private async __updateDoc (q: Query, updatedDoc: WithLookup<Doc>, tx: TxUpdateDoc<Doc>): Promise<void> {
    TxProcessor.updateDoc2Doc(updatedDoc, tx)

    const ops = {
      ...tx.operations,
      modifiedBy: tx.modifiedBy,
      modifiedOn: tx.modifiedOn
    }
    await this.__updateLookup(q, updatedDoc, ops)
  }

  private sort (q: Query, tx: TxUpdateDoc<Doc>): void {
    const sort = q.options?.sort
    if (sort === undefined) return
    let needSort = sort.modifiedBy !== undefined || sort.modifiedOn !== undefined
    if (!needSort) needSort = this.checkNeedSort(sort, tx)

    if (needSort) resultSort(q.result as Doc[], sort, q._class, this.getHierarchy())
  }

  private checkNeedSort (sort: SortingQuery<Doc>, tx: TxUpdateDoc<Doc>): boolean {
    const ops = tx.operations as any
    for (const key in ops) {
      if (key.startsWith('$')) {
        for (const opKey in ops[key]) {
          if (opKey in sort) return true
        }
      } else {
        if (key in sort) return true
      }
    }
    return false
  }

  private async updatedDocCallback (updatedDoc: Doc, q: Query): Promise<void> {
    q.result = q.result as Doc[]

    if (q.options?.limit !== undefined && q.result.length > q.options.limit) {
      if (q.result[q.options?.limit]._id === updatedDoc._id) {
        return await this.refresh(q)
      }
      if (q.result.pop()?._id !== updatedDoc._id) {
        await this.callback(q)
      }
    } else {
      await this.callback(q)
    }
  }
}

function getNestedLookup (lookup: Ref<Class<Doc>> | [Ref<Class<Doc>>, Lookup<Doc>]): Lookup<Doc> | undefined {
  return Array.isArray(lookup) ? lookup[1] : undefined
}

function getLookupClass (lookup: Ref<Class<Doc>> | [Ref<Class<Doc>>, Lookup<Doc>]): Ref<Class<Doc>> {
  return Array.isArray(lookup) ? lookup[0] : lookup
}
