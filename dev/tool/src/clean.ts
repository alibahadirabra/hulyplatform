//
// Copyright © 2023 Hardcore Engineering Inc.
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

import { getAccountDB, listWorkspacesRaw } from '@hcengineering/account'
import calendar from '@hcengineering/calendar'
import { loadCollaborativeDoc, saveCollaborativeDoc, yDocToBuffer } from '@hcengineering/collaboration'
import contact from '@hcengineering/contact'
import core, {
  type ArrOf,
  type AttachedDoc,
  type BackupClient,
  type CollaborativeDoc,
  type Client as CoreClient,
  DOMAIN_BENCHMARK,
  DOMAIN_DOC_INDEX_STATE,
  DOMAIN_MIGRATION,
  DOMAIN_MODEL,
  DOMAIN_TX,
  type Doc,
  type DocumentUpdate,
  type Hierarchy,
  type Markup,
  type MeasureContext,
  type MigrationState,
  type Ref,
  type RefTo,
  type RelatedDocument,
  SortingOrder,
  type Tx,
  type TxCUD,
  type TxCollectionCUD,
  TxOperations,
  type TxRemoveDoc,
  type WorkspaceId,
  generateId,
  getWorkspaceId,
  systemAccountEmail,
  updateAttribute
} from '@hcengineering/core'
import activity from '@hcengineering/model-activity'
import { DOMAIN_SPACE } from '@hcengineering/model-core'
import { getMongoClient, getWorkspaceMongoDB } from '@hcengineering/mongo'
import recruit from '@hcengineering/recruit'
import { getTransactorEndpoint } from '@hcengineering/server-client'
import { type StorageAdapter } from '@hcengineering/server-core'
import { generateToken } from '@hcengineering/server-token'
import { connect } from '@hcengineering/server-tool'
import { updateYDocContent } from '@hcengineering/text'
import tracker from '@hcengineering/tracker'
import { deepEqual } from 'fast-equals'
import { type Db } from 'mongodb'

export async function cleanWorkspace (
  ctx: MeasureContext,
  mongoUrl: string,
  workspaceId: WorkspaceId,
  storageAdapter: StorageAdapter,
  elasticUrl: string,
  transactorUrl: string,
  opt: { recruit: boolean, tracker: boolean, removedTx: boolean }
): Promise<void> {
  const connection = (await connect(transactorUrl, workspaceId, undefined, {
    mode: 'backup',
    model: 'upgrade'
  })) as unknown as CoreClient & BackupClient
  try {
    const ops = new TxOperations(connection, core.account.System)

    const hierarchy = ops.getHierarchy()

    if (opt.recruit) {
      const contacts = await ops.findAll(recruit.mixin.Candidate, {})
      console.log('removing Talents', contacts.length)
      const filter = contacts.filter((it) => !hierarchy.isDerived(it._class, contact.mixin.Employee))

      while (filter.length > 0) {
        const part = filter.splice(0, 100)
        const op = ops.apply()
        for (const c of part) {
          await op.remove(c)
        }
        const t = Date.now()
        console.log('remove:', part.map((it) => it.name).join(', '))
        await op.commit()
        const t2 = Date.now()
        console.log('remove time:', t2 - t, filter.length)
      }
    }

    if (opt.tracker) {
      const issues = await ops.findAll(tracker.class.Issue, {})
      console.log('removing Issues', issues.length)

      while (issues.length > 0) {
        const part = issues.splice(0, 5)
        const op = ops.apply()
        for (const c of part) {
          await op.remove(c)
        }
        const t = Date.now()
        await op.commit()
        const t2 = Date.now()
        console.log('remove time:', t2 - t, issues.length)
      }
    }

    const client = getMongoClient(mongoUrl)
    try {
      const _client = await client.getClient()
      const db = getWorkspaceMongoDB(_client, workspaceId)

      if (opt.removedTx) {
        let processed = 0
        const iterator = db.collection(DOMAIN_TX).find({})
        while (true) {
          const txes: Tx[] = []

          const doc = await iterator.next()
          if (doc == null) {
            break
          }
          txes.push(doc as unknown as Tx)
          if (iterator.bufferedCount() > 0) {
            txes.push(...(iterator.readBufferedDocuments() as unknown as Tx[]))
          }

          for (const tx of txes) {
            if (tx._class === core.class.TxRemoveDoc) {
              // We need to remove all update and create operations for document
              await db.collection(DOMAIN_TX).deleteMany({ objectId: (tx as TxRemoveDoc<Doc>).objectId })
              processed++
            }
            if (
              tx._class === core.class.TxCollectionCUD &&
              (tx as TxCollectionCUD<Doc, AttachedDoc>).tx._class === core.class.TxRemoveDoc
            ) {
              // We need to remove all update and create operations for document
              await db.collection(DOMAIN_TX).deleteMany({
                'tx.objectId': ((tx as TxCollectionCUD<Doc, AttachedDoc>).tx as TxRemoveDoc<Doc>).objectId
              })
              processed++
            }
          }
          if (processed % 1000 === 0) {
            console.log('processed', processed)
          }
        }
      }
    } finally {
      client.close()
    }
  } catch (err: any) {
    console.trace(err)
  } finally {
    await connection.close()
  }
}

export async function fixMinioBW (
  ctx: MeasureContext,
  workspaceId: WorkspaceId,
  storageService: StorageAdapter
): Promise<void> {
  console.log('try clean bw miniature for ', workspaceId.name)
  const from = new Date(new Date().setDate(new Date().getDate() - 7)).getTime()
  const list = await storageService.listStream(ctx, workspaceId)
  let removed = 0
  while (true) {
    const objs = await list.next()
    if (objs.length === 0) {
      break
    }
    for (const obj of objs) {
      if (obj.modifiedOn < from) continue
      if ((obj._id as string).includes('%preview%')) {
        await storageService.remove(ctx, workspaceId, [obj._id])
        removed++
        if (removed % 100 === 0) {
          console.log('removed: ', removed)
        }
      }
    }
  }
  console.log('FINISH, removed: ', removed)
}

export async function cleanRemovedTransactions (workspaceId: WorkspaceId, transactorUrl: string): Promise<void> {
  const connection = (await connect(transactorUrl, workspaceId, undefined, {
    mode: 'backup'
  })) as unknown as CoreClient & BackupClient
  try {
    let count = 0
    while (true) {
      const removedDocs = await connection.findAll(
        core.class.TxCollectionCUD,
        { 'tx._class': core.class.TxRemoveDoc },
        { limit: 1000 }
      )
      if (removedDocs.length === 0) {
        break
      }

      const toRemove = await connection.findAll(core.class.TxCollectionCUD, {
        'tx._class': { $in: [core.class.TxCreateDoc, core.class.TxRemoveDoc, core.class.TxUpdateDoc] },
        'tx.objectId': { $in: removedDocs.map((it) => it.tx.objectId) }
      })
      await connection.clean(
        DOMAIN_TX,
        toRemove.map((it) => it._id)
      )

      count += toRemove.length
      console.log('processed', count)
    }

    console.log('total docs with remove', count)
  } catch (err: any) {
    console.trace(err)
  } finally {
    await connection.close()
  }
}

export async function optimizeModel (workspaceId: WorkspaceId, transactorUrl: string): Promise<void> {
  const connection = (await connect(transactorUrl, workspaceId, undefined, {
    mode: 'backup',
    model: 'upgrade'
  })) as unknown as CoreClient & BackupClient
  try {
    let count = 0

    const model = connection.getModel()

    const updateTransactions = await connection.findAll(
      core.class.TxUpdateDoc,
      {
        objectSpace: core.space.Model,
        _class: core.class.TxUpdateDoc
      },
      { sort: { _id: SortingOrder.Ascending, modifiedOn: SortingOrder.Ascending }, limit: 5000 }
    )

    const toRemove: Ref<Doc>[] = []

    let i = 0
    for (const tx of updateTransactions) {
      try {
        const doc = model.findObject(tx.objectId)
        if (doc === undefined) {
          // Document is removed, we could remove update transaction at all
          toRemove.push(tx._id)
          console.log('marking update tx to remove', tx)
          continue
        }
        const opt: any = { ...tx.operations }
        const adoc = doc as any

        let uDoc: any = {}

        // Find next update operations for same doc
        for (const ops of updateTransactions.slice(i + 1).filter((it) => it.objectId === tx.objectId)) {
          uDoc = { ...uDoc, ...ops.operations }
        }

        for (const [k, v] of Object.entries(opt)) {
          // If value is same as in document or we have more transactions with same value updated.
          if (!k.startsWith('$') && (!deepEqual(adoc[k], v) || uDoc[k] !== undefined)) {
            // Current value is not we modify
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete opt[k]
          }
        }
        if (Object.keys(opt).length === 0) {
          // No operations pending, remove update tx.
          toRemove.push(tx._id)
          console.log('marking update tx to remove, since not real update is performed', tx)
        }
      } finally {
        i++
      }
    }

    await connection.clean(DOMAIN_TX, toRemove)

    count += toRemove.length
    console.log('processed', count)

    console.log('total docs with remove', count)
  } catch (err: any) {
    console.trace(err)
  } finally {
    await connection.close()
  }
}
export async function cleanArchivedSpaces (workspaceId: WorkspaceId, transactorUrl: string): Promise<void> {
  const connection = (await connect(transactorUrl, workspaceId, undefined, {
    mode: 'backup'
  })) as unknown as CoreClient & BackupClient
  try {
    const count = 0
    const ops = new TxOperations(connection, core.account.System)
    while (true) {
      const spaces = await connection.findAll(core.class.Space, { archived: true }, { limit: 1000 })
      if (spaces.length === 0) {
        break
      }

      const h = connection.getHierarchy()
      const withDomain = h
        .getDescendants(core.class.Doc)
        .filter((it) => h.findDomain(it) !== undefined)
        .filter((it) => !h.isMixin(it))
      for (const c of withDomain) {
        while (true) {
          const docs = await connection.findAll(c, { space: { $in: spaces.map((it) => it._id) } })
          if (docs.length === 0) {
            break
          }
          console.log('removing:', c, docs.length)
          for (const d of docs) {
            await ops.remove(d)
          }
        }
      }
      for (const s of spaces) {
        await ops.remove(s)
      }
    }

    console.log('total docs with remove', count)
  } catch (err: any) {
    console.trace(err)
  } finally {
    await connection.close()
  }
}

export async function removeDuplicateIds (
  ctx: MeasureContext,
  mongodbUri: string,
  storageAdapter: StorageAdapter,
  accountsUrl: string,
  initWorkspacesStr: string
): Promise<void> {
  const state = 'REMOVE_DUPLICATE_IDS'
  const [accountsDb, closeAccountsDb] = await getAccountDB(mongodbUri)
  const mongoClient = getMongoClient(mongodbUri)
  const _client = await mongoClient.getClient()
  // disable spaces while change hardocded ids
  const skippedDomains: string[] = [DOMAIN_DOC_INDEX_STATE, DOMAIN_BENCHMARK, DOMAIN_TX, DOMAIN_SPACE]
  try {
    const workspaces = await listWorkspacesRaw(accountsDb)
    workspaces.sort((a, b) => b.lastVisit - a.lastVisit)
    const initWorkspaces = initWorkspacesStr.split(';')
    const initWS = workspaces.filter((p) => initWorkspaces.includes(p.workspace))
    const ids = new Map<string, RelatedDocument[]>()
    for (const workspace of initWS) {
      const workspaceId = getWorkspaceId(workspace.workspace)
      const db = getWorkspaceMongoDB(_client, workspaceId)

      const txex = await db.collection(DOMAIN_TX).find<TxCUD<Doc>>({}).toArray()
      const txesArr = []
      for (const obj of txex) {
        if (obj.objectSpace === core.space.Model && !isPersonAccount(obj)) {
          continue
        }
        txesArr.push({ _id: obj._id, _class: obj._class })
      }
      txesArr.filter((it, idx, array) => array.findIndex((pt) => pt._id === it._id) === idx)
      ids.set(DOMAIN_TX, txesArr)

      const colls = await db.collections()
      for (const coll of colls) {
        if (skippedDomains.includes(coll.collectionName)) continue
        const arr = ids.get(coll.collectionName) ?? []
        const data = await coll.find<RelatedDocument>({}, { projection: { _id: 1, _class: 1 } }).toArray()
        for (const obj of data) {
          arr.push(obj)
        }
        ids.set(coll.collectionName, arr)
      }

      const arr = ids.get(DOMAIN_MODEL) ?? []
      const data = await db
        .collection(DOMAIN_TX)
        .find<TxCUD<Doc>>(
        { objectSpace: core.space.Model },
        { projection: { objectId: 1, objectClass: 1, modifiedBy: 1 } }
      )
        .toArray()
      for (const obj of data) {
        if (
          (obj.modifiedBy === core.account.ConfigUser || obj.modifiedBy === core.account.System) &&
          !isPersonAccount(obj)
        ) {
          continue
        }
        if (obj.objectId === core.account.ConfigUser || obj.objectId === core.account.System) continue
        arr.push({ _id: obj.objectId, _class: obj.objectClass })
      }
      arr.filter((it, idx, array) => array.findIndex((pt) => pt._id === it._id) === idx)
      ids.set(DOMAIN_MODEL, arr)
    }

    for (let index = 0; index < workspaces.length; index++) {
      const workspace = workspaces[index]
      // we should skip init workspace first time, for case if something went wrong
      if (initWorkspaces.includes(workspace.workspace)) continue

      ctx.info(`Processing workspace ${workspace.workspaceName ?? workspace.workspace}`)
      const workspaceId = getWorkspaceId(workspace.workspace)
      const db = getWorkspaceMongoDB(_client, workspaceId)
      const check = await db.collection(DOMAIN_MIGRATION).findOne({ state, plugin: workspace.workspace })
      if (check != null) continue

      const endpoint = await getTransactorEndpoint(generateToken(systemAccountEmail, workspaceId))
      const wsClient = (await connect(endpoint, workspaceId, undefined, {
        model: 'upgrade'
      })) as CoreClient & BackupClient
      for (const set of ids) {
        if (set[1].length === 0) continue
        for (const doc of set[1]) {
          await updateId(ctx, wsClient, db, storageAdapter, workspaceId, doc)
        }
      }
      await wsClient.sendForceClose()
      await wsClient.close()
      await db.collection<MigrationState>(DOMAIN_MIGRATION).insertOne({
        _id: generateId(),
        state,
        plugin: workspace.workspace,
        space: core.space.Configuration,
        modifiedOn: Date.now(),
        modifiedBy: core.account.System,
        _class: core.class.MigrationState
      })
      ctx.info(`Done ${index} / ${workspaces.length - initWorkspaces.length}`)
    }
  } catch (err: any) {
    console.trace(err)
  } finally {
    mongoClient.close()
    closeAccountsDb()
  }
}

function isPersonAccount (tx: TxCUD<Doc>): boolean {
  return tx.objectClass === contact.class.PersonAccount
}

async function update<T extends Doc> (h: Hierarchy, db: Db, doc: T, update: DocumentUpdate<T>): Promise<void> {
  await db.collection(h.getDomain(doc._class)).updateOne({ _id: doc._id }, { $set: { ...update, '%hash%': null } })
}

async function updateId (
  ctx: MeasureContext,
  client: CoreClient & BackupClient,
  db: Db,
  storage: StorageAdapter,
  workspaceId: WorkspaceId,
  docRef: RelatedDocument
): Promise<void> {
  const h = client.getHierarchy()
  const txop = new TxOperations(client, core.account.System)
  try {
    // chech the doc exists
    const doc = await client.findOne(docRef._class, { _id: docRef._id })
    if (doc === undefined) return
    const domain = h.getDomain(doc._class)
    const newId = generateId()

    // update txes
    await db.collection(DOMAIN_TX).updateMany({ objectId: doc._id }, { $set: { objectId: newId, '%hash%': null } })

    // update nested txes
    await db
      .collection(DOMAIN_TX)
      .updateMany({ 'tx.objectId': doc._id }, { $set: { 'tx.objectId': newId, '%hash%': null } })

    // we have generated ids for calendar, let's update in
    if (h.isDerived(doc._class, core.class.Account)) {
      await updateId(ctx, client, db, storage, workspaceId, {
        _id: `${doc._id}_calendar` as Ref<Doc>,
        _class: calendar.class.Calendar
      })
    }

    // update backlinks
    const backlinks = await client.findAll(activity.class.ActivityReference, { attachedTo: doc._id })
    for (const backlink of backlinks) {
      const contentDoc = await client.findOne(backlink.attachedDocClass ?? backlink.srcDocClass, {
        _id: backlink.attachedDocId ?? backlink.srcDocClass
      })
      if (contentDoc !== undefined) {
        const attrs = h.getAllAttributes(contentDoc._class)
        for (const [attrName, attr] of attrs) {
          if (attr.type._class === core.class.TypeMarkup) {
            const markup = (contentDoc as any)[attrName] as Markup
            const newMarkup = markup.replaceAll(doc._id, newId)
            await update(h, db, contentDoc, { [attrName]: newMarkup })
          } else if (attr.type._class === core.class.TypeCollaborativeDoc) {
            const collaborativeDoc = (contentDoc as any)[attr.name] as CollaborativeDoc
            await updateYDoc(ctx, collaborativeDoc, storage, workspaceId, contentDoc, newId, doc)
          }
        }
      }
      await update(h, db, backlink, { attachedTo: newId, message: backlink.message.replaceAll(doc._id, newId) })
    }

    // blobs

    await updateRefs(txop, newId, doc)

    await updateArrRefs(txop, newId, doc)

    // update docIndexState
    const docIndexState = await client.findOne(core.class.DocIndexState, { doc: doc._id })
    if (docIndexState !== undefined) {
      const { _id, space, modifiedBy, modifiedOn, createdBy, createdOn, _class, ...data } = docIndexState
      await txop.createDoc(docIndexState._class, docIndexState.space, {
        ...data,
        stages: {},
        removed: false
      })
      await txop.update(docIndexState, { removed: true, needIndex: true })
    }

    if (domain !== DOMAIN_MODEL) {
      const raw = await db.collection(domain).findOne({ _id: doc._id })
      await db.collection(domain).insertOne({
        ...raw,
        _id: newId as any,
        '%hash%': null
      })
      await db.collection(domain).deleteOne({ _id: doc._id })
    }
  } catch (err: any) {
    console.error('Error processing', docRef._id)
  }
}

async function updateYDoc (
  ctx: MeasureContext,
  _id: CollaborativeDoc,
  storage: StorageAdapter,
  workspaceId: WorkspaceId,
  contentDoc: Doc,
  newId: Ref<Doc>,
  doc: RelatedDocument
): Promise<void> {
  try {
    const ydoc = await loadCollaborativeDoc(ctx, storage, workspaceId, _id)
    if (ydoc === undefined) {
      ctx.error('document content not found', { document: contentDoc._id })
      return
    }
    const buffer = yDocToBuffer(ydoc)

    const updatedYDoc = updateYDocContent(buffer, (body: Record<string, any>) => {
      const str = JSON.stringify(body)
      const updated = str.replaceAll(doc._id, newId)
      return JSON.parse(updated)
    })

    if (updatedYDoc !== undefined) {
      await saveCollaborativeDoc(ctx, storage, workspaceId, _id, updatedYDoc)
    }
  } catch {
    // do nothing, the collaborative doc does not sem to exist yet
  }
}

async function updateRefs (client: TxOperations, newId: Ref<Doc>, doc: RelatedDocument): Promise<void> {
  const h = client.getHierarchy()
  const ancestors = h.getAncestors(doc._class)
  const reftos = (await client.findAll(core.class.Attribute, { 'type._class': core.class.RefTo })).filter((it) => {
    const to = it.type as RefTo<Doc>
    return ancestors.includes(h.getBaseClass(to.to))
  })
  for (const attr of reftos) {
    if (attr.name === '_id') {
      continue
    }
    const descendants = h.getDescendants(attr.attributeOf)
    for (const d of descendants) {
      if (h.isDerived(d, core.class.BenchmarkDoc)) {
        continue
      }
      if (h.isDerived(d, core.class.Tx)) {
        continue
      }
      if (h.findDomain(d) !== undefined) {
        while (true) {
          const values = await client.findAll(d, { [attr.name]: doc._id }, { limit: 100 })
          if (values.length === 0) {
            break
          }

          const builder = client.apply(doc._id)
          for (const v of values) {
            await updateAttribute(builder, v, d, { key: attr.name, attr }, newId, true)
          }
          const modelTxes = builder.txes.filter((p) => p.objectSpace === core.space.Model)
          builder.txes = builder.txes.filter((p) => p.objectSpace !== core.space.Model)
          for (const modelTx of modelTxes) {
            await client.tx(modelTx)
          }
          await builder.commit()
        }
      }
    }
  }
}

async function updateArrRefs (client: TxOperations, newId: Ref<Doc>, doc: RelatedDocument): Promise<void> {
  const h = client.getHierarchy()
  const ancestors = h.getAncestors(doc._class)
  const arrs = await client.findAll(core.class.Attribute, { 'type._class': core.class.ArrOf })
  for (const attr of arrs) {
    if (attr.name === '_id') {
      continue
    }
    const to = attr.type as ArrOf<Doc>
    if (to.of._class !== core.class.RefTo) continue
    const refto = to.of as RefTo<Doc>
    if (ancestors.includes(h.getBaseClass(refto.to))) {
      const descendants = h.getDescendants(attr.attributeOf)
      for (const d of descendants) {
        if (h.isDerived(d, core.class.BenchmarkDoc)) {
          continue
        }
        if (h.isDerived(d, core.class.Tx)) {
          continue
        }
        if (h.findDomain(d) !== undefined) {
          while (true) {
            const values = await client.findAll(attr.attributeOf, { [attr.name]: doc._id }, { limit: 100 })
            if (values.length === 0) {
              break
            }
            const builder = client.apply(doc._id)
            for (const v of values) {
              await updateAttribute(builder, v, d, { key: attr.name, attr }, newId, true)
            }
            const modelTxes = builder.txes.filter((p) => p.objectSpace === core.space.Model)
            builder.txes = builder.txes.filter((p) => p.objectSpace !== core.space.Model)
            for (const modelTx of modelTxes) {
              await client.tx(modelTx)
            }
            await builder.commit()
          }
        }
      }
    }
  }
}
