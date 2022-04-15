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

import { Comment, Message, ThreadMessage } from '@anticrm/chunter'
import core, { Client, Doc, DOMAIN_TX, Ref, TxCreateDoc, TxOperations } from '@anticrm/core'
import { MigrateOperation, MigrationClient, MigrationUpgradeClient } from '@anticrm/model'
import { DOMAIN_CHUNTER, DOMAIN_COMMENT } from './index'
import chunter from './plugin'

export async function createDeps (client: Client): Promise<void> {
  const tx = new TxOperations(client, core.account.System)

  await createGeneral(tx)
  await createRandom(tx)
}

export async function createGeneral (tx: TxOperations): Promise<void> {
  const createTx = await tx.findOne(core.class.TxCreateDoc, {
    objectId: chunter.space.General
  })
  if (createTx === undefined) {
    await tx.createDoc(chunter.class.Channel, core.space.Space, {
      name: 'general',
      description: 'General Channel',
      topic: 'General Channel',
      private: false,
      archived: false,
      members: []
    }, chunter.space.General)
  }
}

export async function createRandom (tx: TxOperations): Promise<void> {
  const createTx = await tx.findOne(core.class.TxCreateDoc, {
    objectId: chunter.space.Random
  })
  if (createTx === undefined) {
    await tx.createDoc(chunter.class.Channel, core.space.Space, {
      name: 'random',
      description: 'Random Talks',
      topic: 'Random Talks',
      private: false,
      archived: false,
      members: []
    }, chunter.space.Random)
  }
}

export async function setCreate (client: TxOperations): Promise<void> {
  const messages = (await client.findAll(chunter.class.Message, { })).filter((m) => m.createBy === undefined).map((m) => m._id)
  if (messages.length === 0) return
  const txes = await client.findAll(core.class.TxCreateDoc, { objectId: { $in: messages } })
  const promises = txes.map(async (tx) => {
    await client.updateDoc<Message>(chunter.class.Message, tx.objectSpace, tx.objectId as Ref<Message>, {
      createBy: tx.modifiedBy,
      createOn: tx.modifiedOn
    })
  })
  await Promise.all(promises)
}

export async function migrateMessages (client: MigrationClient): Promise<void> {
  const messages = await client.find(DOMAIN_CHUNTER, {
    _class: chunter.class.Message,
    attachedTo: { $exists: false }
  })
  for (const message of messages) {
    await client.update(DOMAIN_CHUNTER, {
      _id: message._id
    }, {
      attachedTo: message.space,
      attachedToClass: chunter.class.Channel,
      collection: 'messages'
    })
  }

  const txes = await client.find<TxCreateDoc<Doc>>(DOMAIN_TX, {
    _class: core.class.TxCreateDoc,
    objectClass: chunter.class.Message
  })
  for (const tx of txes) {
    await client.update(DOMAIN_TX, {
      _id: tx._id
    }, {
      'attributes.attachedTo': tx.objectSpace,
      'attributes.attachedToClass': chunter.class.Channel,
      'attributes.collection': 'messages'
    })
  }
}

export async function migrateThreadMessages (client: MigrationClient): Promise<void> {
  const messages = await client.find<Comment>(DOMAIN_COMMENT, {
    _class: chunter.class.Comment,
    attachedToClass: chunter.class.Message
  })
  for (const message of messages) {
    await client.delete(DOMAIN_COMMENT, message._id)
    await client.create<ThreadMessage>(DOMAIN_CHUNTER, {
      attachedTo: message.attachedTo as Ref<Message>,
      attachedToClass: message.attachedToClass,
      attachments: message.attachments,
      content: message.message,
      collection: message.collection,
      _class: chunter.class.ThreadMessage,
      space: message.space,
      modifiedOn: message.modifiedOn,
      modifiedBy: message.modifiedBy,
      createBy: message.modifiedBy,
      createOn: message.modifiedOn,
      editedOn: 0,
      _id: message._id as string as Ref<ThreadMessage>
    })
  }

  const txes = await client.find<TxCreateDoc<Comment>>(DOMAIN_TX, {
    _class: core.class.TxCreateDoc,
    objectClass: chunter.class.Comment,
    'attributes.attachedToClass': chunter.class.Message
  })
  for (const tx of txes) {
    await client.update(DOMAIN_TX, {
      _id: tx._id
    }, {
      objectClass: chunter.class.ThreadMessage,
      'attributes.createBy': tx.modifiedBy,
      'attributes.createOn': tx.modifiedOn,
      'attributes.content': tx.attributes.message
    })
  }
}

export const chunterOperation: MigrateOperation = {
  async migrate (client: MigrationClient): Promise<void> {
    await migrateMessages(client)
    await migrateThreadMessages(client)
  },
  async upgrade (client: MigrationUpgradeClient): Promise<void> {
    const tx = new TxOperations(client, core.account.System)
    await createGeneral(tx)
    await createRandom(tx)
    await setCreate(tx)
  }
}
