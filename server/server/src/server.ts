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

import {
  Class,
  Doc,
  DocumentQuery,
  Domain,
  DOMAIN_BLOB,
  DOMAIN_FULLTEXT_BLOB,
  DOMAIN_MODEL,
  DOMAIN_TRANSIENT,
  DOMAIN_TX,
  FindOptions,
  FindResult,
  Hierarchy,
  ModelDb,
  Ref,
  StorageIterator,
  toFindResult,
  Tx,
  TxResult
} from '@hcengineering/core'
import { createElasticAdapter, createElasticBackupDataAdapter } from '@hcengineering/elastic'
import { ModifiedMiddleware, PrivateMiddleware } from '@hcengineering/middleware'
import { createMongoAdapter, createMongoTxAdapter } from '@hcengineering/mongo'
import { addLocation } from '@hcengineering/platform'
import { serverAttachmentId } from '@hcengineering/server-attachment'
import { serverCalendarId } from '@hcengineering/server-calendar'
import { serverChunterId } from '@hcengineering/server-chunter'
import { serverContactId } from '@hcengineering/server-contact'
import {
  createInMemoryAdapter,
  createPipeline,
  DbAdapter,
  DbConfiguration,
  MiddlewareCreator,
  Pipeline
} from '@hcengineering/server-core'
import { serverGmailId } from '@hcengineering/server-gmail'
import { serverInventoryId } from '@hcengineering/server-inventory'
import { serverLeadId } from '@hcengineering/server-lead'
import { serverNotificationId } from '@hcengineering/server-notification'
import { serverRecruitId } from '@hcengineering/server-recruit'
import { serverSettingId } from '@hcengineering/server-setting'
import { serverTagsId } from '@hcengineering/server-tags'
import { serverTaskId } from '@hcengineering/server-task'
import { serverTrackerId } from '@hcengineering/server-tracker'
import { serverTelegramId } from '@hcengineering/server-telegram'
import { serverHrId } from '@hcengineering/server-hr'
import { Token } from '@hcengineering/server-token'
import { BroadcastCall, ClientSession, start as startJsonRpc } from '@hcengineering/server-ws'
import { Client as MinioClient } from 'minio'
import { BackupClientSession } from './backup'
import { metricsContext } from './metrics'
import { createMinioDataAdapter } from './minio'

class NullDbAdapter implements DbAdapter {
  async init (model: Tx[]): Promise<void> {}
  async findAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T> | undefined
  ): Promise<FindResult<T>> {
    return toFindResult([])
  }

  async tx (tx: Tx): Promise<TxResult> {
    return {}
  }

  async close (): Promise<void> {}

  find (domain: Domain): StorageIterator {
    return {
      next: async () => undefined,
      close: async () => {}
    }
  }

  async load (domain: Domain, docs: Ref<Doc>[]): Promise<Doc[]> {
    return []
  }

  async upload (domain: Domain, docs: Doc[]): Promise<void> {}

  async clean (domain: Domain, docs: Ref<Doc>[]): Promise<void> {}
}

async function createNullAdapter (hierarchy: Hierarchy, url: string, db: string, modelDb: ModelDb): Promise<DbAdapter> {
  return new NullDbAdapter()
}

/**
 * @public
 */
export interface MinioConfig {
  endPoint: string
  accessKey: string
  secretKey: string
}

/**
 * @public
 */
export function start (
  dbUrl: string,
  fullTextUrl: string,
  minioConf: MinioConfig,
  port: number,
  host?: string
): () => void {
  addLocation(serverAttachmentId, () => import('@hcengineering/server-attachment-resources'))
  addLocation(serverContactId, () => import('@hcengineering/server-contact-resources'))
  addLocation(serverNotificationId, () => import('@hcengineering/server-notification-resources'))
  addLocation(serverSettingId, () => import('@hcengineering/server-setting-resources'))
  addLocation(serverChunterId, () => import('@hcengineering/server-chunter-resources'))
  addLocation(serverInventoryId, () => import('@hcengineering/server-inventory-resources'))
  addLocation(serverLeadId, () => import('@hcengineering/server-lead-resources'))
  addLocation(serverRecruitId, () => import('@hcengineering/server-recruit-resources'))
  addLocation(serverTaskId, () => import('@hcengineering/server-task-resources'))
  addLocation(serverTrackerId, () => import('@hcengineering/server-tracker-resources'))
  addLocation(serverTagsId, () => import('@hcengineering/server-tags-resources'))
  addLocation(serverCalendarId, () => import('@hcengineering/server-calendar-resources'))
  addLocation(serverGmailId, () => import('@hcengineering/server-gmail-resources'))
  addLocation(serverTelegramId, () => import('@hcengineering/server-telegram-resources'))
  addLocation(serverHrId, () => import('@hcengineering/server-hr-resources'))

  const middlewares: MiddlewareCreator[] = [ModifiedMiddleware.create, PrivateMiddleware.create]

  return startJsonRpc(
    metricsContext,
    (workspace: string) => {
      const conf: DbConfiguration = {
        domains: {
          [DOMAIN_TX]: 'MongoTx',
          [DOMAIN_TRANSIENT]: 'InMemory',
          [DOMAIN_BLOB]: 'MinioData',
          [DOMAIN_FULLTEXT_BLOB]: 'FullTextBlob',
          [DOMAIN_MODEL]: 'Null'
        },
        defaultAdapter: 'Mongo',
        adapters: {
          MongoTx: {
            factory: createMongoTxAdapter,
            url: dbUrl
          },
          Mongo: {
            factory: createMongoAdapter,
            url: dbUrl
          },
          Null: {
            factory: createNullAdapter,
            url: ''
          },
          InMemory: {
            factory: createInMemoryAdapter,
            url: ''
          },
          MinioData: {
            factory: createMinioDataAdapter,
            url: ''
          },
          FullTextBlob: {
            factory: createElasticBackupDataAdapter,
            url: fullTextUrl
          }
        },
        fulltextAdapter: {
          factory: createElasticAdapter,
          url: fullTextUrl
        },
        storageFactory: () =>
          new MinioClient({
            ...minioConf,
            port: 9000,
            useSSL: false
          }),
        workspace
      }
      return createPipeline(conf, middlewares)
    },
    (token: Token, pipeline: Pipeline, broadcast: BroadcastCall) => {
      if (token.extra?.mode === 'backup') {
        return new BackupClientSession(broadcast, token, pipeline)
      }
      return new ClientSession(broadcast, token, pipeline)
    },
    port,
    host
  )
}
