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
import core, {
  type AttachedDoc,
  type Attribute,
  type Class,
  type Client,
  type Collection,
  type Doc,
  groupByArray,
  type Hierarchy,
  type Ref,
  SortingOrder,
  type TxCollectionCUD,
  type TxCreateDoc,
  type TxCUD,
  type TxMixin,
  TxProcessor,
  type TxUpdateDoc,
  type WithLookup
} from '@hcengineering/core'
import notification, {
  type ActivityMessage,
  type ChatMessage,
  type DisplayActivityMessage,
  type DisplayDocUpdateMessage,
  type DocAttributeUpdates,
  type DocNotifyContext,
  type DocUpdateMessage,
  type InboxNotification
} from '@hcengineering/notification'
import view, { type AttributeModel } from '@hcengineering/view'
import { getClient, getFiltredKeys } from '@hcengineering/presentation'
import { getAttributePresenter, getDocLinkTitle } from '@hcengineering/view-resources'
import { type Person } from '@hcengineering/contact'
import { type IntlString } from '@hcengineering/platform'
import { type AnyComponent } from '@hcengineering/ui'
import { get } from 'svelte/store'
import { personAccountByIdStore } from '@hcengineering/contact-resources'

// Use 5 minutes to combine similar messages
const combineThresholdMs = 5 * 60 * 1000
// Use 10 seconds to combine update messages after creation.
const createCombineThreshold = 10 * 1000

const valueTypes: ReadonlyArray<Ref<Class<Doc>>> = [
  core.class.TypeString,
  core.class.EnumOf,
  core.class.TypeNumber,
  core.class.TypeDate,
  core.class.TypeMarkup,
  core.class.TypeHyperlink
]

async function buildRemovedDoc (client: Client, objectId: Ref<Doc>, _class: Ref<Class<Doc>>): Promise<Doc | undefined> {
  const isAttached = client.getHierarchy().isDerived(_class, core.class.AttachedDoc)
  const txes = await client.findAll<TxCUD<Doc>>(
    isAttached ? core.class.TxCollectionCUD : core.class.TxCUD,
    isAttached
      ? { 'tx.objectId': objectId as Ref<AttachedDoc> }
      : {
          objectId
        },
    { sort: { modifiedOn: 1 } }
  )
  const createTx = isAttached
    ? txes.map((tx) => (tx as TxCollectionCUD<Doc, AttachedDoc>).tx).find((tx) => tx._class === core.class.TxCreateDoc)
    : txes.find((tx) => tx._class === core.class.TxCreateDoc)

  if (createTx === undefined) return
  let doc = TxProcessor.createDoc2Doc(createTx as TxCreateDoc<Doc>)

  for (let tx of txes) {
    tx = TxProcessor.extractTx(tx) as TxCUD<Doc>
    if (tx._class === core.class.TxUpdateDoc) {
      doc = TxProcessor.updateDoc2Doc(doc, tx as TxUpdateDoc<Doc>)
    } else if (tx._class === core.class.TxMixin) {
      const mixinTx = tx as TxMixin<Doc, Doc>
      doc = TxProcessor.updateMixin4Doc(doc, mixinTx)
    }
  }
  return doc
}

export async function getAttributeValues (client: Client, values: any[], attrClass: Ref<Class<Doc>>): Promise<any[]> {
  if (values.some((value) => typeof value !== 'string')) {
    return values
  }

  if (valueTypes.includes(attrClass)) {
    return values
  }

  const docs = await client.findAll(attrClass, { _id: { $in: values } })
  const docIds = docs.map(({ _id }) => _id)
  const missedIds = values.filter((value) => !docIds.includes(value))
  const removedDocs = await Promise.all(missedIds.map(async (value) => await buildRemovedDoc(client, value, attrClass)))
  return [...docs, ...removedDocs].filter((doc) => !(doc == null))
}

export function getCollectionAttribute (
  hierarchy: Hierarchy,
  objectClass: Ref<Class<Doc>>,
  collection?: string
): Attribute<Collection<AttachedDoc>> | undefined {
  if (collection === undefined) {
    return undefined
  }

  const descendants = hierarchy.getDescendants(objectClass)

  for (const descendant of descendants) {
    const collectionAttribute = hierarchy.findAttribute(descendant, collection)
    if (collectionAttribute !== undefined) {
      return collectionAttribute
    }
  }

  return undefined
}

export async function getNotificationObject (
  client: Client,
  objectId: Ref<Doc>,
  objectClass: Ref<Class<Doc>>
): Promise<{ isRemoved: boolean, object?: Doc }> {
  const object = await client.findOne(objectClass, { _id: objectId })

  if (object !== undefined) {
    return { isRemoved: false, object }
  }

  return {
    isRemoved: true,
    object: await buildRemovedDoc(client, objectId, objectClass)
  }
}

export async function getAttributeModel (
  client: Client,
  attributeUpdates: DocAttributeUpdates | undefined,
  objectClass: Ref<Class<Doc>>
): Promise<AttributeModel | undefined> {
  if (attributeUpdates === undefined) {
    return undefined
  }

  const hierarchy = client.getHierarchy()

  try {
    const { attrKey, attrClass, isMixin } = attributeUpdates
    let attrObjectClass = objectClass

    if (isMixin) {
      const keyedAttribute = getFiltredKeys(hierarchy, attrClass, []).find(({ key }) => key === attrKey)
      if (keyedAttribute === undefined) {
        return undefined
      }
      attrObjectClass = keyedAttribute.attr.attributeOf
    }

    return await getAttributePresenter(
      client,
      attrObjectClass,
      attrKey,
      { key: attrKey },
      view.mixin.NotificationAttributePresenter
    )
  } catch (e) {
    // ignore error
  }
}

function activityMessagesComparator (message1: ActivityMessage, message2: ActivityMessage): number {
  const time1 = getMessageTime(message1)
  const time2 = getMessageTime(message2)

  return time1 - time2
}

export function getDisplayActivityMessagesByNotifications (
  inboxNotifications: Array<WithLookup<InboxNotification>>,
  docNotifyContextById: Map<Ref<DocNotifyContext>, DocNotifyContext>,
  filter: 'all' | 'read' | 'unread',
  objectClass?: Ref<Class<Doc>>
): DisplayActivityMessage[] {
  const messages = inboxNotifications
    .filter(({ docNotifyContext, isViewed }) => {
      const update = docNotifyContextById.get(docNotifyContext)
      const isVisible = update !== undefined && !update.hidden

      if (!isVisible) {
        return false
      }

      switch (filter) {
        case 'unread':
          return !isViewed
        case 'all':
          return true
        case 'read':
          return !!isViewed
      }

      return false
    })
    .map(({ $lookup }) => $lookup?.attachedTo)
    .filter((message): message is ActivityMessage => {
      if (message === undefined) {
        return false
      }
      if (objectClass === undefined) {
        return true
      }
      if (message._class === notification.class.ChatMessage) {
        return false
      }

      return (message as DocUpdateMessage).objectClass === objectClass
    })
    .sort(activityMessagesComparator)

  return combineActivityMessages(messages, SortingOrder.Descending)
}

function getMessageTime (message: ActivityMessage): number {
  return message.createdOn ?? message.modifiedOn
}

function combineByCreateThreshold (docUpdateMessages: DocUpdateMessage[]): DocUpdateMessage[] {
  const createMessages = docUpdateMessages.filter(
    ({ action, attachedTo, objectId }) => action === 'create' && attachedTo === objectId
  )
  return docUpdateMessages.filter((message) => {
    const { _id, attachedTo } = message
    const createMsg = createMessages.find((create) => create.attachedTo === attachedTo)

    if (createMsg === undefined) {
      return true
    }

    if (createMsg._id === _id) {
      return true
    }

    const diff = getMessageTime(message) - getMessageTime(createMsg)

    return diff > createCombineThreshold
  })
}

export function combineActivityMessages (
  messages: ActivityMessage[],
  sortingOrder: SortingOrder = SortingOrder.Ascending
): DisplayActivityMessage[] {
  const chatMessages = messages.filter(
    (message): message is ChatMessage => message._class === notification.class.ChatMessage
  )

  const docUpdateMessages = combineByCreateThreshold(
    messages.filter((message): message is DocUpdateMessage => message._class === notification.class.DocUpdateMessage)
  )

  const result: DisplayActivityMessage[] = [...chatMessages]

  const groupedByType: Map<string, DocUpdateMessage[]> = groupByArray(docUpdateMessages, getDocUpdateMessageKey)

  for (const [, groupedMessages] of groupedByType) {
    const cantMerge = groupedMessages.filter(
      (message, index) => index !== groupedMessages.length - 1 && !canCombineMessage(message)
    )
    const cantMergeIds = new Set(cantMerge.map(({ _id }) => _id))

    const canMerge = groupedMessages.filter(({ _id }) => !cantMergeIds.has(_id))
    const forMerge = groupByTime(canMerge)

    forMerge.forEach((messagesForMerge) => {
      const mergedNotification = mergeDocUpdateMessages(messagesForMerge)

      if (mergedNotification !== undefined) {
        result.push(mergedNotification)
      }
    })
    result.push(...cantMerge)
  }

  return sortActivityMessages(result, sortingOrder)
}

export function sortActivityMessages<T extends ActivityMessage> (messages: T[], order: SortingOrder): T[] {
  return messages.sort((message1, message2) =>
    order === SortingOrder.Ascending
      ? activityMessagesComparator(message1, message2)
      : activityMessagesComparator(message2, message1)
  )
}

function canCombineMessage (message: ActivityMessage): boolean {
  const hasReactions = message.reactions !== undefined && message.reactions > 0
  const isPinned = message.isPinned === true

  return !hasReactions && !isPinned
}

function groupByTime<T extends ActivityMessage> (messages: T[]): T[][] {
  const result: T[][] = []

  for (const message1 of messages) {
    if (result.some((forMerge) => forMerge.includes(message1))) {
      continue
    }

    const forMerge: T[] = [message1]

    for (const message2 of messages) {
      if (message1._id === message2._id) {
        continue
      }

      const timeDiff = (message2.createdOn ?? message2.modifiedOn) - (message1.createdOn ?? message1.modifiedOn)

      if (timeDiff >= 0 && timeDiff < combineThresholdMs) {
        forMerge.push(message2)
      }
    }

    result.push(forMerge)
  }

  return result
}

function getDocUpdateMessageKey (message: DocUpdateMessage): string {
  const personAccountById = get(personAccountByIdStore)
  const person = personAccountById.get(message.modifiedBy as any)?.person ?? message.modifiedBy

  if (message.action === 'update') {
    return [message._class, message.attachedTo, message.action, person, getAttributeUpdatesKey(message)].join('_')
  }

  return [
    message._class,
    message.attachedTo,
    person,
    message.updateCollection,
    message.objectId === message.attachedTo
  ].join('_')
}

function mergeDocUpdateAttributes (messages: DocUpdateMessage[]): DisplayDocUpdateMessage | undefined {
  const firstMessage = messages[0]
  const lastMessage = messages[messages.length - 1]

  let mergedAttributeUpdates = firstMessage.attributeUpdates

  messages.forEach((message) => {
    if (message._id !== firstMessage._id && message.attributeUpdates !== undefined) {
      mergedAttributeUpdates = mergeAttributeUpdates(message.attributeUpdates, mergedAttributeUpdates)
    }
  })

  if (mergedAttributeUpdates === undefined) {
    return undefined
  }

  const hasChanges =
    mergedAttributeUpdates.set.length > 0 ||
    mergedAttributeUpdates.added.length > 0 ||
    mergedAttributeUpdates.removed.length > 0

  if (!hasChanges) {
    return undefined
  }

  return {
    ...lastMessage,
    attributeUpdates: mergedAttributeUpdates,
    combinedMessagesIds: messages.map(({ _id }) => _id)
  }
}

function mergeDocUpdateMessages (messages: DocUpdateMessage[]): DisplayDocUpdateMessage | undefined {
  if (messages.length === 0) {
    return undefined
  }

  if (messages[0].action === 'update') {
    return mergeDocUpdateAttributes(messages)
  }

  if (messages.length === 1) {
    return messages[0]
  }

  const removeMessages = messages.filter(({ action }) => action === 'remove')
  const createMessages = messages.filter(({ action }) => action === 'create')
  const removedObjectIds = removeMessages.map(({ objectId }) => objectId)
  const createdObjectIds = createMessages.map(({ objectId }) => objectId)

  const forMerge = [
    ...createMessages.filter(({ objectId }) => !removedObjectIds.includes(objectId)),
    ...removeMessages.filter(({ objectId }) => !createdObjectIds.includes(objectId))
  ]

  forMerge.sort(activityMessagesComparator)

  if (forMerge.length === 0) {
    return undefined
  }

  return {
    ...forMerge[forMerge.length - 1],
    previousMessages: forMerge.slice(0, -1),
    combinedMessagesIds: messages.map(({ _id }) => _id)
  }
}

function mergeAttributeUpdates (
  attributeUpdates: DocAttributeUpdates,
  prevAttributeUpdates?: DocAttributeUpdates
): DocAttributeUpdates {
  if (prevAttributeUpdates === undefined) {
    return attributeUpdates
  }

  if (attributeUpdates.attrKey !== prevAttributeUpdates.attrKey) {
    return attributeUpdates
  }

  const added = attributeUpdates.added
    .filter((item) => !prevAttributeUpdates.removed.includes(item))
    .concat(prevAttributeUpdates.added.filter((item) => !attributeUpdates.removed.includes(item)))
  const removed = attributeUpdates.removed
    .filter((item) => !prevAttributeUpdates.added.includes(item))
    .concat(prevAttributeUpdates.removed.filter((item) => !attributeUpdates.added.includes(item)))

  const { prevValue } = prevAttributeUpdates
  const { set, attrClass, attrKey, isMixin } = attributeUpdates

  return {
    attrKey,
    attrClass,
    prevValue,
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    set: prevValue ? set.filter((value) => value !== prevValue) : set,
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    added: prevValue ? added.filter((value) => value !== prevValue) : added,
    removed,
    isMixin
  }
}

function getAttributeUpdatesKey (message: DocUpdateMessage): string {
  if (message.attributeUpdates === undefined) {
    return ''
  }

  const { attrKey, attrClass, isMixin } = message.attributeUpdates

  return [attrKey, attrClass, isMixin].join('-')
}

export function attributesFilter (message: ActivityMessage, _class?: Ref<Doc>): boolean {
  if (message._class === notification.class.DocUpdateMessage) {
    return (message as DocUpdateMessage).objectClass === _class
  }

  return false
}

export function chatMessagesFilter (message: ActivityMessage): boolean {
  return message._class === notification.class.ChatMessage
}

export function pinnedFilter (message: ActivityMessage, _class?: Ref<Doc>): boolean {
  return message.isPinned === true
}

export interface LinkData {
  title?: string
  preposition: IntlString
  panelComponent: AnyComponent
  object: Doc
}

export async function getLinkData (
  message: DisplayActivityMessage,
  object: Doc | undefined,
  parentObject: Doc | undefined,
  person: Person | undefined
): Promise<LinkData | undefined> {
  const client = getClient()
  const hierarchy = client.getHierarchy()

  let linkObject: Doc | undefined

  if (hierarchy.isDerived(message.attachedToClass, notification.class.ActivityMessage)) {
    linkObject = parentObject
  } else if (message._class === notification.class.DocUpdateMessage) {
    linkObject = (message as DocUpdateMessage).action === 'update' ? object : parentObject ?? object
  } else {
    linkObject = parentObject ?? object
  }

  if (linkObject === undefined) {
    return undefined
  }

  if (person !== undefined && person._id === linkObject._id) {
    return undefined
  }

  const title = await getDocLinkTitle(client, linkObject._id, linkObject._class, linkObject)

  const preposition = hierarchy.classHierarchyMixin(linkObject._class, notification.mixin.NotificationObjectPreposition)
    ?.preposition
  const panelComponent = hierarchy.classHierarchyMixin(linkObject._class, view.mixin.ObjectPanel)

  return {
    title,
    preposition: preposition ?? notification.string.In,
    panelComponent: panelComponent?.component ?? view.component.EditDoc,
    object: linkObject
  }
}
