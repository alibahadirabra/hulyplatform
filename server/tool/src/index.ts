//
// Copyright © 2022 Hardcore Engineering Inc.
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

import contact from '@hcengineering/contact'
import core, {
  BackupClient,
  Client as CoreClient,
  Doc,
  Domain,
  DOMAIN_MODEL,
  DOMAIN_TX,
  FieldIndex,
  Hierarchy,
  IndexKind,
  IndexOrder,
  ModelDb,
  Tx,
  WorkspaceId
} from '@hcengineering/core'
import { MinioService } from '@hcengineering/minio'
import { consoleModelLogger, MigrateOperation, ModelLogger } from '@hcengineering/model'
import { getWorkspaceDB } from '@hcengineering/mongo'
import { Db, Document, MongoClient } from 'mongodb'
import { connect } from './connect'
import toolPlugin from './plugin'
import { MigrateClientImpl } from './upgrade'

import fs from 'fs'
import path from 'path'

export * from './connect'
export * from './plugin'
export { toolPlugin as default }

export class FileModelLogger implements ModelLogger {
  handle: fs.WriteStream
  constructor (readonly file: string) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })

    this.handle = fs.createWriteStream(this.file, { flags: 'a' })
  }

  log (...data: any[]): void {
    this.handle.write(data.map((it: any) => JSON.stringify(it)).join(' ') + '\n')
  }

  close (): void {
    this.handle.close()
  }
}

/**
 * @public
 */
export function prepareTools (rawTxes: Tx[]): { mongodbUri: string, minio: MinioService, txes: Tx[] } {
  let minioEndpoint = process.env.MINIO_ENDPOINT
  if (minioEndpoint === undefined) {
    console.error('please provide minio endpoint')
    process.exit(1)
  }

  const minioAccessKey = process.env.MINIO_ACCESS_KEY
  if (minioAccessKey === undefined) {
    console.error('please provide minio access key')
    process.exit(1)
  }

  const minioSecretKey = process.env.MINIO_SECRET_KEY
  if (minioSecretKey === undefined) {
    console.error('please provide minio secret key')
    process.exit(1)
  }

  const mongodbUri = process.env.MONGO_URL
  if (mongodbUri === undefined) {
    console.error('please provide mongodb url.')
    process.exit(1)
  }

  let minioPort = 9000
  const sp = minioEndpoint.split(':')
  if (sp.length > 1) {
    minioEndpoint = sp[0]
    minioPort = parseInt(sp[1])
  }

  const minio = new MinioService({
    endPoint: minioEndpoint,
    port: minioPort,
    useSSL: false,
    accessKey: minioAccessKey,
    secretKey: minioSecretKey
  })

  return { mongodbUri, minio, txes: JSON.parse(JSON.stringify(rawTxes)) as Tx[] }
}

/**
 * @public
 */
export async function initModel (
  transactorUrl: string,
  workspaceId: WorkspaceId,
  rawTxes: Tx[],
  migrateOperations: [string, MigrateOperation][],
  logger: ModelLogger = consoleModelLogger
): Promise<CoreClient> {
  const { mongodbUri, minio, txes } = prepareTools(rawTxes)
  if (txes.some((tx) => tx.objectSpace !== core.space.Model)) {
    throw Error('Model txes must target only core.space.Model')
  }

  const client = new MongoClient(mongodbUri)
  let connection: CoreClient & BackupClient
  try {
    await client.connect()
    const db = getWorkspaceDB(client, workspaceId)

    logger.log('dropping database...', workspaceId)
    await db.dropDatabase()

    logger.log('creating model...', workspaceId)
    const model = txes
    const result = await db.collection(DOMAIN_TX).insertMany(model as Document[])
    logger.log(`${result.insertedCount} model transactions inserted.`)

    logger.log('creating data...', transactorUrl)
    connection = (await connect(transactorUrl, workspaceId, undefined, {
      model: 'upgrade'
    })) as unknown as CoreClient & BackupClient

    try {
      for (const op of migrateOperations) {
        logger.log('Migrate', op[0])
        await op[1].upgrade(connection, logger)
      }

      // Create update indexes
      await createUpdateIndexes(connection, db, logger)

      logger.log('create minio bucket')
      if (!(await minio.exists(workspaceId))) {
        await minio.make(workspaceId)
      }
    } catch (e) {
      logger.log(e)
    }
  } finally {
    await client.close()
  }
  return connection
}

/**
 * @public
 */
export async function upgradeModel (
  transactorUrl: string,
  workspaceId: WorkspaceId,
  rawTxes: Tx[],
  migrateOperations: [string, MigrateOperation][],
  logger: ModelLogger = consoleModelLogger
): Promise<CoreClient> {
  const { mongodbUri, txes } = prepareTools(rawTxes)

  if (txes.some((tx) => tx.objectSpace !== core.space.Model)) {
    throw Error('Model txes must target only core.space.Model')
  }

  const client = new MongoClient(mongodbUri)
  try {
    await client.connect()
    const db = getWorkspaceDB(client, workspaceId)

    logger.log(`${workspaceId.name}: removing model...`)
    // we're preserving accounts (created by core.account.System).
    const result = await db.collection(DOMAIN_TX).deleteMany({
      objectSpace: core.space.Model,
      modifiedBy: core.account.System,
      objectClass: { $nin: [contact.class.PersonAccount, 'contact:class:EmployeeAccount'] }
    })
    logger.log(`${workspaceId.name}: ${result.deletedCount} transactions deleted.`)

    logger.log(`${workspaceId.name}: creating model...`)
    const model = txes
    const insert = await db.collection(DOMAIN_TX).insertMany(model as Document[])
    logger.log(`${workspaceId.name}: ${insert.insertedCount} model transactions inserted.`)

    const hierarchy = new Hierarchy()
    const modelDb = new ModelDb(hierarchy)
    for (const tx of txes) {
      try {
        hierarchy.tx(tx)
      } catch (err: any) {}
    }
    for (const tx of txes) {
      try {
        await modelDb.tx(tx)
      } catch (err: any) {}
    }

    const migrateClient = new MigrateClientImpl(db, hierarchy, modelDb, logger)
    for (const op of migrateOperations) {
      const t = Date.now()
      await op[1].migrate(migrateClient, logger)
      logger.log(`${workspaceId.name}: migrate:`, op[0], Date.now() - t)
    }

    logger.log(`${workspaceId.name}: Apply upgrade operations`)

    const connection = await connect(transactorUrl, workspaceId, undefined, { mode: 'backup', model: 'upgrade' })

    // Create update indexes
    await createUpdateIndexes(connection, db, logger)

    for (const op of migrateOperations) {
      const t = Date.now()
      await op[1].upgrade(connection, logger)
      logger.log(`${workspaceId.name}: upgrade:`, op[0], Date.now() - t)
    }

    return connection
  } finally {
    await client.close()
  }
}

async function createUpdateIndexes (connection: CoreClient, db: Db, logger: ModelLogger): Promise<void> {
  const classes = await connection.findAll(core.class.Class, {})

  const hierarchy = connection.getHierarchy()
  const domains = new Map<Domain, Set<string | FieldIndex<Doc>>>()
  // Find all domains and indexed fields inside
  for (const c of classes) {
    try {
      const domain = hierarchy.getDomain(c._id)
      if (domain === DOMAIN_MODEL) {
        continue
      }
      const attrs = hierarchy.getAllAttributes(c._id)
      const domainAttrs = domains.get(domain) ?? new Set<string | FieldIndex<Doc>>()
      for (const a of attrs.values()) {
        if (a.index !== undefined && (a.index === IndexKind.Indexed || a.index === IndexKind.IndexedDsc)) {
          if (a.index === IndexKind.Indexed) {
            domainAttrs.add(a.name)
          } else {
            domainAttrs.add({ [a.name]: IndexOrder.Descending })
          }
        }
      }

      // Handle extra configurations
      if (hierarchy.hasMixin(c, core.mixin.IndexConfiguration)) {
        const config = hierarchy.as(c, core.mixin.IndexConfiguration)
        for (const attr of config.indexes) {
          domainAttrs.add(attr)
        }
      }

      domains.set(domain, domainAttrs)
    } catch (err: any) {
      // Ignore, since we have classes without domain.
    }
  }

  for (const [d, v] of domains.entries()) {
    const collInfo = await db.listCollections({ name: d }).next()
    if (collInfo === null) {
      await db.createCollection(d)
    }
    const collection = db.collection(d)
    const bb: (string | FieldIndex<Doc>)[] = []
    for (const vv of v.values()) {
      try {
        const key = typeof vv === 'string' ? vv : Object.keys(vv)[0]
        const name = typeof vv === 'string' ? `${key}_1` : `${key}_${vv[key]}`
        const exists = await collection.indexExists(name)
        if (!exists) {
          await collection.createIndex(vv)
        }
      } catch (err: any) {
        logger.log('error: failed to create index', d, vv, JSON.stringify(err))
      }
      bb.push(vv)
    }
    if (bb.length > 0) {
      logger.log('created indexes', d, JSON.stringify(bb))
    }
  }
}
