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

import contact, { Channel } from '@hcengineering/contact'
import core, {
  Class,
  Doc,
  DocumentQuery,
  FindOptions,
  FindResult,
  Hierarchy,
  Ref,
  Tx,
  TxCUD,
  TxCreateDoc,
  TxProcessor
} from '@hcengineering/core'
import { TriggerControl } from '@hcengineering/server-core'
import telegram, { TelegramMessage } from '@hcengineering/telegram'
import notification from '@hcengineering/notification'

/**
 * @public
 */
export async function FindMessages (
  doc: Doc,
  hiearachy: Hierarchy,
  findAll: <T extends Doc>(
    clazz: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ) => Promise<FindResult<T>>
): Promise<Doc[]> {
  const channel = doc as Channel
  if (channel.provider !== contact.channelProvider.Telegram) {
    return []
  }
  const messages = await findAll(telegram.class.Message, { attachedTo: channel._id })
  const newMessages = await findAll(telegram.class.NewMessage, { attachedTo: channel._id })
  return [...messages, ...newMessages]
}

/**
 * @public
 */
export async function OnMessageCreate (tx: Tx, control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  const actualTx = TxProcessor.extractTx(tx)
  if (actualTx._class !== core.class.TxCreateDoc) {
    return []
  }

  const createTx = tx as TxCreateDoc<TelegramMessage>

  if (!control.hierarchy.isDerived(createTx.objectClass, telegram.class.Message)) {
    return []
  }
  const message = TxProcessor.createDoc2Doc<TelegramMessage>(createTx)

  const channel = (await control.findAll(contact.class.Channel, { _id: message.attachedTo }, { limit: 1 }))[0]
  if (channel !== undefined) {
    if (channel.lastMessage === undefined || channel.lastMessage < message.sendOn) {
      const tx = control.txFactory.createTxUpdateDoc(channel._class, channel.space, channel._id, {
        lastMessage: message.sendOn
      })
      res.push(tx)
    }

    if (message.incoming) {
      const docs = await control.findAll(notification.class.DocUpdates, {
        attachedTo: channel._id,
        user: message.modifiedBy
      })
      for (const doc of docs) {
        res.push(
          control.txFactory.createTxUpdateDoc(doc._class, doc.space, doc._id, {
            $push: {
              txes: [tx._id as Ref<TxCUD<Doc>>, tx.modifiedOn]
            }
          })
        )
        res.push(
          control.txFactory.createTxUpdateDoc(doc._class, doc.space, doc._id, {
            lastTx: tx._id as Ref<TxCUD<Doc>>,
            lastTxTime: tx.modifiedOn,
            hidden: false
          })
        )
      }
      if (docs.length === 0) {
        res.push(
          control.txFactory.createTxCreateDoc(notification.class.DocUpdates, notification.space.Notifications, {
            user: tx.modifiedBy,
            attachedTo: channel._id,
            attachedToClass: channel._class,
            hidden: false,
            lastTx: tx._id as Ref<TxCUD<Doc>>,
            lastTxTime: tx.modifiedOn,
            txes: [[tx._id as Ref<TxCUD<Doc>>, tx.modifiedOn]]
          })
        )
      }
    }
  }

  return res
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  trigger: {
    OnMessageCreate
  },
  function: {
    FindMessages
  }
})
