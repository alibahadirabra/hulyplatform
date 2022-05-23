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

import core, {
  Class,
  Doc,
  DocumentQuery,
  Domain,
  DOMAIN_MODEL,
  DOMAIN_TX,
  escapeLikeForRegexp,
  FindOptions,
  FindResult,
  Hierarchy,
  isOperator,
  Lookup,
  Mixin,
  ModelDb,
  Ref,
  ReverseLookups,
  SortingOrder,
  SortingQuery,
  StorageIterator,
  toFindResult,
  Tx,
  TxCreateDoc,
  TxMixin,
  TxProcessor,
  TxPutBag,
  TxRemoveDoc,
  TxResult,
  TxUpdateDoc,
  WithLookup
} from '@anticrm/core'
import type { DbAdapter, TxAdapter } from '@anticrm/server-core'
import { Collection, Db, Document, Filter, MongoClient, Sort } from 'mongodb'
import { getMongoClient } from './utils'

import { createHash } from 'node:crypto'

function translateDoc (doc: Doc): Document {
  return doc as Document
}

function isLookupQuery<T extends Doc> (query: DocumentQuery<T>): boolean {
  for (const key in query) {
    if (key.includes('$lookup.')) return true
  }
  return false
}

function isLookupSort<T extends Doc> (sort: SortingQuery<T> | undefined): boolean {
  if (sort === undefined) return false
  for (const key in sort) {
    if (key.includes('$lookup.')) return true
  }
  return false
}

interface LookupStep {
  from: string
  localField: string
  foreignField: string
  as: string
}

abstract class MongoAdapterBase extends TxProcessor {
  constructor (
    protected readonly db: Db,
    protected readonly hierarchy: Hierarchy,
    protected readonly modelDb: ModelDb,
    protected readonly client: MongoClient
  ) {
    super()
  }

  async init (): Promise<void> {}

  async close (): Promise<void> {
    await this.client.close()
  }

  private translateQuery<T extends Doc>(clazz: Ref<Class<T>>, query: DocumentQuery<T>): Filter<Document> {
    const translated: any = {}
    for (const key in query) {
      const value = (query as any)[key]

      const tkey = this.checkMixinKey(key, clazz)
      if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value)
        if (keys[0] === '$like') {
          const pattern = value.$like as string
          translated[tkey] = {
            $regex: `^${pattern
              .split('%')
              .map((it) => escapeLikeForRegexp(it))
              .join('.*')}$`,
            $options: 'i'
          }
          continue
        }
      }
      translated[tkey] = value
    }
    const baseClass = this.hierarchy.getBaseClass(clazz)
    const classes = this.hierarchy.getDescendants(baseClass)

    // Only replace if not specified
    if (translated._class?.$in === undefined) {
      translated._class = { $in: classes }
    }

    if (baseClass !== clazz) {
      // Add an mixin to be exists flag
      translated[clazz] = { $exists: true }
    }
    // return Object.assign({}, query, { _class: { $in: classes } })
    return translated
  }

  private async getLookupValue<T extends Doc>(lookup: Lookup<T>, result: LookupStep[], parent?: string): Promise<void> {
    for (const key in lookup) {
      if (key === '_id') {
        await this.getReverseLookupValue(lookup, result, parent)
        continue
      }
      const value = (lookup as any)[key]
      const fullKey = parent !== undefined ? parent + '.' + key : key
      if (Array.isArray(value)) {
        const [_class, nested] = value
        const domain = this.hierarchy.getDomain(_class)
        if (domain !== DOMAIN_MODEL) {
          result.push({
            from: domain,
            localField: fullKey,
            foreignField: '_id',
            as: fullKey.split('.').join('') + '_lookup'
          })
        }
        await this.getLookupValue(nested, result, fullKey + '_lookup')
      } else {
        const _class = value as Ref<Class<Doc>>
        const domain = this.hierarchy.getDomain(_class)
        if (domain !== DOMAIN_MODEL) {
          result.push({
            from: domain,
            localField: fullKey,
            foreignField: '_id',
            as: fullKey.split('.').join('') + '_lookup'
          })
        }
      }
    }
  }

  private async getReverseLookupValue (
    lookup: ReverseLookups,
    result: LookupStep[],
    parent?: string
  ): Promise<any | undefined> {
    const fullKey = parent !== undefined ? parent + '.' + '_id' : '_id'
    for (const key in lookup._id) {
      const as = parent !== undefined ? parent + key : key
      const value = lookup._id[key]

      let _class: Ref<Class<Doc>>
      let attr = 'attachedTo'

      if (Array.isArray(value)) {
        _class = value[0]
        attr = value[1]
      } else {
        _class = value
      }
      const domain = this.hierarchy.getDomain(_class)
      if (domain !== DOMAIN_MODEL) {
        const step = {
          from: domain,
          localField: fullKey,
          foreignField: attr,
          as: as.split('.').join('') + '_lookup'
        }
        result.push(step)
      }
    }
  }

  private async getLookups<T extends Doc>(lookup: Lookup<T> | undefined, parent?: string): Promise<LookupStep[]> {
    if (lookup === undefined) return []
    const result: [] = []
    await this.getLookupValue(lookup, result, parent)
    return result
  }

  private async fillLookup<T extends Doc>(
    _class: Ref<Class<T>>,
    object: any,
    key: string,
    fullKey: string,
    targetObject: any
  ): Promise<void> {
    if (targetObject.$lookup === undefined) {
      targetObject.$lookup = {}
    }
    const domain = this.hierarchy.getDomain(_class)
    if (domain !== DOMAIN_MODEL) {
      const arr = object[fullKey]
      if (arr !== undefined && Array.isArray(arr)) {
        if (arr.length === 1) {
          targetObject.$lookup[key] = arr[0]
        } else if (arr.length > 1) {
          targetObject.$lookup[key] = arr
        }
      }
    } else {
      targetObject.$lookup[key] = (await this.modelDb.findAll(_class, { _id: targetObject[key] }))[0]
    }
  }

  private async fillLookupValue<T extends Doc>(
    lookup: Lookup<T> | undefined,
    object: any,
    parent?: string,
    parentObject?: any
  ): Promise<void> {
    if (lookup === undefined) return
    for (const key in lookup) {
      if (key === '_id') {
        await this.fillReverseLookup(lookup, object, parent, parentObject)
        continue
      }
      const value = (lookup as any)[key]
      const fullKey = parent !== undefined ? parent + key + '_lookup' : key + '_lookup'
      const targetObject = parentObject ?? object
      if (Array.isArray(value)) {
        const [_class, nested] = value
        await this.fillLookup(_class, object, key, fullKey, targetObject)
        await this.fillLookupValue(nested, object, fullKey, targetObject.$lookup[key])
      } else {
        await this.fillLookup(value, object, key, fullKey, targetObject)
      }
    }
  }

  private async fillReverseLookup (
    lookup: ReverseLookups,
    object: any,
    parent?: string,
    parentObject?: any
  ): Promise<void> {
    const targetObject = parentObject ?? object
    if (targetObject.$lookup === undefined) {
      targetObject.$lookup = {}
    }
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
      const domain = this.hierarchy.getDomain(_class)
      const fullKey = parent !== undefined ? parent + key + '_lookup' : key + '_lookup'
      if (domain !== DOMAIN_MODEL) {
        const arr = object[fullKey]
        targetObject.$lookup[key] = arr
      } else {
        const arr = await this.modelDb.findAll(_class, { [attr]: targetObject._id })
        targetObject.$lookup[key] = arr
      }
    }
  }

  private async lookup<T extends Doc>(
    clazz: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options: FindOptions<T>
  ): Promise<FindResult<T>> {
    const pipeline = []
    const match = { $match: this.translateQuery(clazz, query) }
    const slowPipeline = isLookupQuery(query) || isLookupSort(options.sort)
    const steps = await this.getLookups(options.lookup)
    if (slowPipeline) {
      for (const step of steps) {
        pipeline.push({ $lookup: step })
      }
    }
    pipeline.push(match)
    const resultPipeline: any[] = []
    if (options.sort !== undefined) {
      const sort = {} as any
      for (const _key in options.sort) {
        let key: string = _key
        const arr = key.split('.').filter((p) => p)
        key = ''
        for (let i = 0; i < arr.length; i++) {
          const element = arr[i]
          if (element === '$lookup') {
            key += arr[++i] + '_lookup'
          } else {
            if (!key.endsWith('.') && i > 0) {
              key += '.'
            }
            key += arr[i]
            if (i !== arr.length - 1) {
              key += '.'
            }
          }
          // Check if key is belong to mixin class, we need to add prefix.
          key = this.checkMixinKey<T>(key, clazz)
        }
        sort[key] = options.sort[_key] === SortingOrder.Ascending ? 1 : -1
      }
      pipeline.push({ $sort: sort })
    }
    if (options.limit !== undefined) {
      resultPipeline.push({ $limit: options.limit })
    }
    if (!slowPipeline) {
      for (const step of steps) {
        resultPipeline.push({ $lookup: step })
      }
    }
    if (options?.projection !== undefined) {
      resultPipeline.push({ $project: options.projection })
    }
    pipeline.push({
      $facet: {
        results: resultPipeline,
        totalCount: [
          {
            $count: 'count'
          }
        ]
      }
    })
    const domain = this.hierarchy.getDomain(clazz)
    const cursor = this.db.collection(domain).aggregate(pipeline)
    const res = (await cursor.toArray())[0]
    const result = res.results as WithLookup<T>[]
    const total = res.totalCount?.shift()?.count
    for (const row of result) {
      row.$lookup = {}
      await this.fillLookupValue(options.lookup, row)
      this.clearExtraLookups(row)
    }
    return toFindResult(result, total)
  }

  private clearExtraLookups (row: any): void {
    for (const key in row) {
      if (key.endsWith('_lookup')) {
        // eslint-disable-next-line
        delete row[key]
      }
    }
  }

  private checkMixinKey<T extends Doc>(key: string, clazz: Ref<Class<T>>): string {
    if (!key.includes('.')) {
      try {
        const attr = this.hierarchy.getAttribute(clazz, key)
        if (this.hierarchy.isMixin(attr.attributeOf)) {
          // It is mixin
          key = attr.attributeOf + '.' + key
        }
      } catch (err: any) {
        // ignore, if
      }
    }
    return key
  }

  async findAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    // TODO: rework this
    if (options !== null && options !== undefined) {
      if (options.lookup !== undefined) {
        return await this.lookup(_class, query, options)
      }
    }
    const domain = this.hierarchy.getDomain(_class)
    const coll = this.db.collection(domain)
    let cursor = coll.find<T>(this.translateQuery(_class, query))

    if (options?.projection !== undefined) {
      cursor = cursor.project(options.projection)
    }
    let total: number | undefined
    if (options !== null && options !== undefined) {
      if (options.sort !== undefined) {
        const sort: Sort = {}
        for (const key in options.sort) {
          const ckey = this.checkMixinKey<T>(key, _class)
          const order = options.sort[key] === SortingOrder.Ascending ? 1 : -1
          sort[ckey] = order
        }
        cursor = cursor.sort(sort)
      }
      if (options.limit !== undefined) {
        total = await coll.estimatedDocumentCount()
        cursor = cursor.limit(options.limit)
      }
    }
    const res = await cursor.toArray()
    return toFindResult(res, total)
  }

  find (domain: Domain): StorageIterator {
    const coll = this.db.collection<Doc>(domain)
    const iterator = coll.find({}, {})

    return {
      next: async () => {
        const d = await iterator.next()
        if (d === null) {
          return undefined
        }
        const doc = JSON.stringify(d)
        const hash = createHash('sha256')
        hash.update(doc)
        const digest = hash.digest('base64')
        return {
          id: d._id,
          hash: digest,
          size: doc.length // Some approx size for document.
        }
      },
      close: async () => {
        await iterator.close()
      }
    }
  }

  async load (domain: Domain, docs: Ref<Doc>[]): Promise<Doc[]> {
    return await this.db
      .collection(domain)
      .find<Doc>({ _id: { $in: docs } })
      .toArray()
  }
}

class MongoAdapter extends MongoAdapterBase {
  protected override async txPutBag (tx: TxPutBag<any>): Promise<TxResult> {
    const domain = this.hierarchy.getDomain(tx.objectClass)
    await this.db.collection(domain).updateOne({ _id: tx.objectId }, { $set: { [tx.bag + '.' + tx.key]: tx.value } })
    return {}
  }

  protected override async txRemoveDoc (tx: TxRemoveDoc<Doc>): Promise<TxResult> {
    const domain = this.hierarchy.getDomain(tx.objectClass)
    await this.db.collection(domain).deleteOne({ _id: tx.objectId })
    return {}
  }

  protected async txMixin (tx: TxMixin<Doc, Doc>): Promise<TxResult> {
    const domain = this.hierarchy.getDomain(tx.objectClass)

    if (isOperator(tx.attributes)) {
      const operator = Object.keys(tx.attributes)[0]
      if (operator === '$move') {
        const keyval = (tx.attributes as any).$move
        const arr = tx.mixin + '.' + Object.keys(keyval)[0]
        const desc = keyval[arr]
        const ops = [
          {
            updateOne: {
              filter: { _id: tx.objectId },
              update: {
                $pull: {
                  [arr]: desc.$value
                }
              }
            }
          },
          {
            updateOne: {
              filter: { _id: tx.objectId },
              update: {
                $set: {
                  modifiedBy: tx.modifiedBy,
                  modifiedOn: tx.modifiedOn
                },
                $push: {
                  [arr]: {
                    $each: [desc.$value],
                    $position: desc.$position
                  }
                }
              }
            }
          }
        ]
        return await this.db.collection(domain).bulkWrite(ops as any)
      } else {
        return await this.db.collection(domain).updateOne(
          { _id: tx.objectId },
          {
            ...this.translateMixinAttrs(tx.mixin, tx.attributes),
            $set: {
              modifiedBy: tx.modifiedBy,
              modifiedOn: tx.modifiedOn
            }
          }
        )
      }
    } else {
      return await this.db.collection(domain).updateOne(
        { _id: tx.objectId },
        {
          $set: {
            ...this.translateMixinAttrs(tx.mixin, tx.attributes),
            modifiedBy: tx.modifiedBy,
            modifiedOn: tx.modifiedOn
          }
        }
      )
    }
  }

  private translateMixinAttrs (mixin: Ref<Mixin<Doc>>, attributes: Record<string, any>): Record<string, any> {
    const attrs: Record<string, any> = {}
    let count = 0
    for (const [k, v] of Object.entries(attributes)) {
      if (k.startsWith('$')) {
        attrs[k] = this.translateMixinAttrs(mixin, v)
      } else {
        attrs[mixin + '.' + k] = v
      }
      count++
    }

    if (count === 0) {
      // We need at least one attribute, to be inside for first time,
      // for mongo to create embedded object, if we don't want to get object first.
      attrs[mixin + '.' + '__mixin'] = 'true'
    }
    return attrs
  }

  protected override async txCreateDoc (tx: TxCreateDoc<Doc>): Promise<TxResult> {
    const doc = TxProcessor.createDoc2Doc(tx)
    const domain = this.hierarchy.getDomain(doc._class)
    await this.db.collection(domain).insertOne(translateDoc(doc))
    return {}
  }

  protected override async txUpdateDoc (tx: TxUpdateDoc<Doc>): Promise<TxResult> {
    const domain = this.hierarchy.getDomain(tx.objectClass)
    if (isOperator(tx.operations)) {
      const operator = Object.keys(tx.operations)[0]
      if (operator === '$move') {
        const keyval = (tx.operations as any).$move
        const arr = Object.keys(keyval)[0]
        const desc = keyval[arr]
        const ops = [
          {
            updateOne: {
              filter: { _id: tx.objectId },
              update: {
                $pull: {
                  [arr]: desc.$value
                }
              }
            }
          },
          {
            updateOne: {
              filter: { _id: tx.objectId },
              update: {
                $set: {
                  modifiedBy: tx.modifiedBy,
                  modifiedOn: tx.modifiedOn
                },
                $push: {
                  [arr]: {
                    $each: [desc.$value],
                    $position: desc.$position
                  }
                }
              }
            }
          }
        ]
        return await this.db.collection(domain).bulkWrite(ops as any)
      } else {
        if (tx.retrieve === true) {
          const result = await this.db.collection(domain).findOneAndUpdate(
            { _id: tx.objectId },
            {
              ...tx.operations,
              $set: {
                modifiedBy: tx.modifiedBy,
                modifiedOn: tx.modifiedOn
              }
            },
            { returnDocument: 'after' }
          )
          return { object: result.value }
        } else {
          return await this.db.collection(domain).updateOne(
            { _id: tx.objectId },
            {
              ...tx.operations,
              $set: {
                modifiedBy: tx.modifiedBy,
                modifiedOn: tx.modifiedOn
              }
            }
          )
        }
      }
    } else {
      if (tx.retrieve === true) {
        const result = await this.db
          .collection(domain)
          .findOneAndUpdate(
            { _id: tx.objectId },
            { $set: { ...tx.operations, modifiedBy: tx.modifiedBy, modifiedOn: tx.modifiedOn } },
            { returnDocument: 'after' }
          )
        return { object: result.value }
      } else {
        return await this.db
          .collection(domain)
          .updateOne(
            { _id: tx.objectId },
            { $set: { ...tx.operations, modifiedBy: tx.modifiedBy, modifiedOn: tx.modifiedOn } }
          )
      }
    }
  }
}

class MongoTxAdapter extends MongoAdapterBase implements TxAdapter {
  txColl: Collection | undefined
  protected txCreateDoc (tx: TxCreateDoc<Doc>): Promise<TxResult> {
    throw new Error('Method not implemented.')
  }

  protected txPutBag (tx: TxPutBag<any>): Promise<TxResult> {
    throw new Error('Method not implemented.')
  }

  protected txUpdateDoc (tx: TxUpdateDoc<Doc>): Promise<TxResult> {
    throw new Error('Method not implemented.')
  }

  protected txRemoveDoc (tx: TxRemoveDoc<Doc>): Promise<TxResult> {
    throw new Error('Method not implemented.')
  }

  protected txMixin (tx: TxMixin<Doc, Doc>): Promise<TxResult> {
    throw new Error('Method not implemented.')
  }

  override async tx (tx: Tx, user: string): Promise<TxResult>
  override async tx (tx: Tx): Promise<TxResult>

  override async tx (tx: Tx, user?: string): Promise<TxResult> {
    await this.txCollection().insertOne(translateDoc(tx))
    return {}
  }

  private txCollection (): Collection {
    if (this.txColl !== undefined) {
      return this.txColl
    }
    this.txColl = this.db.collection(DOMAIN_TX)
    return this.txColl
  }

  async getModel (): Promise<Tx[]> {
    const model = await this.db
      .collection(DOMAIN_TX)
      .find<Tx>({ objectSpace: core.space.Model })
      .sort({ _id: 1 })
      .toArray()
    // We need to put all core.account.System transactions first
    const systemTr: Tx[] = []
    const userTx: Tx[] = []

    model.forEach((tx) => (tx.modifiedBy === core.account.System ? systemTr : userTx).push(tx))

    return systemTr.concat(userTx)
  }
}

/**
 * @public
 */
export async function createMongoAdapter (
  hierarchy: Hierarchy,
  url: string,
  dbName: string,
  modelDb: ModelDb
): Promise<DbAdapter> {
  const client = await getMongoClient(url)
  const db = client.db(dbName)
  return new MongoAdapter(db, hierarchy, modelDb, client)
}

/**
 * @public
 */
export async function createMongoTxAdapter (
  hierarchy: Hierarchy,
  url: string,
  dbName: string,
  modelDb: ModelDb
): Promise<TxAdapter> {
  const client = await getMongoClient(url)
  const db = client.db(dbName)
  return new MongoTxAdapter(db, hierarchy, modelDb, client)
}
