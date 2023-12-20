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

import {
  Account,
  AttachedDoc,
  Data,
  Doc,
  Ref,
  Tx,
  TxCollectionCUD,
  TxCreateDoc,
  TxCUD,
  TxProcessor
} from '@hcengineering/core'
import type { TriggerControl } from '@hcengineering/server-core'
import activity, { DocUpdateMessage } from '@hcengineering/activity'
import core from '@hcengineering/core/lib/component'
import { ActivityControl, DocObjectCache } from '@hcengineering/server-activity'
import { getDocUpdateAction, getTxAttributesUpdates } from './utils'

// export async function OnReactionChanged (originTx: Tx, control: TriggerControl): Promise<Tx[]> {
//   const tx = originTx as TxCollectionCUD<ActivityMessage, Reaction>
//   const actualTx = TxProcessor.extractTx(tx) as TxCUD<Doc>
//
//   if (actualTx._class === core.class.TxCreateDoc) {
//     return await createReactionNotifications(tx, control)
//   } else if (actualTx._class === core.class.TxRemoveDoc) {
//     return await removeReactionNotifications(tx, control)
//   }
//
//   return []
// }
//
// export async function removeReactionNotifications (
//   tx: TxCollectionCUD<ActivityMessage, Reaction>,
//   control: TriggerControl
// ): Promise<Tx[]> {
//   const message = (await control.findAll(activity.class.DocUpdateMessage, { objectId: tx.tx.objectId }))[0]
//
//   if (message === undefined) {
//     return []
//   }
//
//   const res: Tx[] = []
//   const inboxNotifications = await control.findAll(notification.class.InboxNotification, { attachedTo: message._id })
//
//   inboxNotifications.forEach((inboxNotification) =>
//     res.push(
//       control.txFactory.createTxRemoveDoc(
//         notification.class.InboxNotification,
//         inboxNotification.space,
//         inboxNotification._id
//       )
//     )
//   )
//
//   return res
// }
// export async function createReactionNotifications (
//   tx: TxCollectionCUD<ActivityMessage, Reaction>,
//   control: TriggerControl
// ): Promise<Tx[]> {
//   const res: Tx[] = []
//   const parentMessage = (await control.findAll(activity.class.ActivityMessage, { _id: tx.objectId }))[0]
//
//   if (parentMessage === undefined) {
//     return res
//   }
//
//   const user = parentMessage.createdBy
//
//   if (user === undefined || user === core.account.System || user === tx.modifiedBy) {
//     return []
//   }
//
//   const messageTx: TxCreateDoc<DocUpdateMessage> | undefined = (
//     await pushDocUpdateMessages(control, res as TxCollectionCUD<Doc, DocUpdateMessage>[], parentMessage, tx, tx.modifiedBy)
//   )[0]
//
//   if (messageTx === undefined) {
//     return res
//   }
//
//   const docNotifyContexts = await control.findAll(notification.class.DocNotifyContext, {
//     attachedTo: parentMessage._id
//   })
//
//   createInboxNotifications(
//     control,
//     res,
//     user,
//     parentMessage,
//     tx,
//     messageTx.objectId,
//     messageTx.objectClass,
//     docNotifyContexts
//   )
//
//   return res
// }

function getDocUpdateMessageTx (
  control: ActivityControl,
  originTx: TxCUD<Doc>,
  object: Doc,
  rawMessage: Data<DocUpdateMessage>,
  modifiedBy?: Ref<Account>
): TxCollectionCUD<Doc, DocUpdateMessage> {
  const innerTx = control.txFactory.createTxCreateDoc(
    activity.class.DocUpdateMessage,
    object.space,
    rawMessage,
    undefined,
    originTx.modifiedOn,
    modifiedBy ?? originTx.modifiedBy
  )

  return control.txFactory.createTxCollectionCUD(
    rawMessage.attachedToClass,
    rawMessage.attachedTo,
    object.space,
    rawMessage.collection,
    innerTx,
    originTx.modifiedOn,
    modifiedBy ?? originTx.modifiedBy
  )
}

async function pushDocUpdateMessages (
  control: ActivityControl,
  res: TxCollectionCUD<Doc, DocUpdateMessage>[],
  object: Doc | undefined,
  originTx: TxCUD<Doc>,
  modifiedBy?: Ref<Account>,
  objectCache?: DocObjectCache
): Promise<TxCollectionCUD<Doc, DocUpdateMessage>[]> {
  if (object === undefined) {
    return res
  }
  const activityDoc = await control.modelDb.findOne(activity.mixin.ActivityDoc, { _id: object._class })

  if (activityDoc === undefined) {
    return res
  }

  const collection =
    originTx._class === core.class.TxCollectionCUD
      ? (originTx as TxCollectionCUD<Doc, AttachedDoc>).collection
      : undefined

  const { ignoreCollections = [] } = activityDoc

  if (collection !== undefined && ignoreCollections.includes(collection)) {
    return res
  }

  const tx =
    originTx._class === core.class.TxCollectionCUD ? (originTx as TxCollectionCUD<Doc, AttachedDoc>).tx : originTx

  const rawMessage: Data<DocUpdateMessage> = {
    txId: originTx._id,
    attachedTo: object._id,
    attachedToClass: object._class,
    objectId: tx.objectId,
    objectClass: tx.objectClass,
    action: getDocUpdateAction(control, tx),
    collection: 'docUpdateMessages',
    updateCollection:
      originTx._class === core.class.TxCollectionCUD
        ? (originTx as TxCollectionCUD<Doc, AttachedDoc>).collection
        : undefined
  }

  const attributesUpdates = await getTxAttributesUpdates(control, originTx, tx, object, objectCache)

  for (const attributeUpdates of attributesUpdates) {
    res.push(
      getDocUpdateMessageTx(
        control,
        originTx,
        object,
        {
          ...rawMessage,
          attributeUpdates
        },
        modifiedBy
      )
    )
  }

  if (attributesUpdates.length === 0) {
    res.push(getDocUpdateMessageTx(control, originTx, object, rawMessage, modifiedBy))
  }

  return res
}

export async function generateDocUpdateMessages (
  tx: TxCUD<Doc>,
  control: ActivityControl,
  res: TxCollectionCUD<Doc, DocUpdateMessage>[] = [],
  originTx?: TxCUD<Doc>,
  objectCache?: DocObjectCache
): Promise<TxCollectionCUD<Doc, DocUpdateMessage>[]> {
  if (tx.space === core.space.DerivedTx) {
    return res
  }

  if (control.hierarchy.isDerived(tx.objectClass, activity.class.ActivityMessage)) {
    return res
  }

  switch (tx._class) {
    case core.class.TxCreateDoc: {
      const doc = TxProcessor.createDoc2Doc(tx as TxCreateDoc<Doc>)
      return await pushDocUpdateMessages(control, res, doc, originTx ?? tx, undefined, objectCache)
    }
    case core.class.TxMixin:
    case core.class.TxUpdateDoc: {
      let doc = objectCache?.docs?.get(tx.objectId)
      if (doc === undefined) {
        doc = (await control.findAll(tx.objectClass, { _id: tx.objectId }, { limit: 1 }))[0]
      }
      return await pushDocUpdateMessages(control, res, doc ?? undefined, originTx ?? tx, undefined, objectCache)
    }
    case core.class.TxCollectionCUD: {
      const actualTx = TxProcessor.extractTx(tx) as TxCUD<Doc>
      res = await generateDocUpdateMessages(actualTx, control, res, tx, objectCache)
      if ([core.class.TxCreateDoc, core.class.TxRemoveDoc].includes(actualTx._class)) {
        let doc = objectCache?.docs?.get(tx.objectId)
        if (doc === undefined) {
          doc = (await control.findAll(tx.objectClass, { _id: tx.objectId }, { limit: 1 }))[0]
        }
        if (doc !== undefined) {
          return await pushDocUpdateMessages(control, res, doc ?? undefined, originTx ?? tx, undefined, objectCache)
        }
      }
      return res
    }
  }

  return res
}

async function ActivityMessagesHandler (tx: TxCUD<Doc>, control: TriggerControl): Promise<Tx[]> {
  if (control.hierarchy.isDerived(tx.objectClass, activity.class.ActivityMessage)) {
    return []
  }

  return await generateDocUpdateMessages(tx, control)
}

async function OnDocRemoved (originTx: TxCUD<Doc>, control: TriggerControl): Promise<Tx[]> {
  const tx = TxProcessor.extractTx(originTx) as TxCUD<Doc>

  if (tx._class !== core.class.TxRemoveDoc) {
    return []
  }

  const activityDocMixin = control.hierarchy.classHierarchyMixin(tx.objectClass, activity.mixin.ActivityDoc)

  if (activityDocMixin === undefined) {
    return []
  }

  const messages = await control.findAll(
    activity.class.ActivityMessage,
    { attachedTo: tx.objectId },
    { projection: { _id: 1, _class: 1, space: 1 } }
  )

  return messages.map((message) => control.txFactory.createTxRemoveDoc(message._class, message.space, message._id))
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  trigger: {
    // OnReactionChanged,
    ActivityMessagesHandler,
    OnDocRemoved
  }
})
