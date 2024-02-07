//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
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

import chunter, { Backlink, ChatMessage } from '@hcengineering/chunter'
import contact, { Employee, formatName, Person, PersonAccount } from '@hcengineering/contact'
import core, {
  Account,
  AnyAttribute,
  ArrOf,
  AttachedDoc,
  Class,
  Collection,
  concatLink,
  Data,
  Doc,
  DocumentUpdate,
  Hierarchy,
  MeasureContext,
  MixinUpdate,
  Ref,
  RefTo,
  Space,
  Timestamp,
  Tx,
  TxCollectionCUD,
  TxCreateDoc,
  TxCUD,
  TxMixin,
  TxProcessor,
  TxRemoveDoc,
  TxUpdateDoc
} from '@hcengineering/core'
import notification, {
  ActivityInboxNotification,
  ClassCollaborators,
  Collaborators,
  DocNotifyContext,
  InboxNotification,
  NotificationProvider,
  NotificationType
} from '@hcengineering/notification'
import { getMetadata, getResource } from '@hcengineering/platform'
import type { TriggerControl } from '@hcengineering/server-core'
import serverNotification, {
  getEmployee,
  getPersonAccount,
  getPersonAccountById,
  HTMLPresenter,
  TextPresenter
} from '@hcengineering/server-notification'
import activity, { ActivityMessage } from '@hcengineering/activity'

import { Content } from './types'
import {
  getNotificationContent,
  isMixinTx,
  isShouldNotify,
  isUserEmployeeInFieldValue,
  isUserInFieldValue,
  replaceAll,
  updateNotifyContextsSpace
} from './utils'

export async function OnBacklinkCreate (
  originTx: TxCollectionCUD<Doc, AttachedDoc>,
  control: TriggerControl
): Promise<Tx[]> {
  const hierarchy = control.hierarchy
  const isTxCorrect = await isBacklinkCreated(originTx, hierarchy, control)

  if (!isTxCorrect) {
    return []
  }

  const tx = originTx as TxCollectionCUD<Doc, Backlink>
  const receiver = await getPersonAccount(tx.objectId as Ref<Employee>, control)

  if (receiver === undefined) {
    return []
  }

  const sender = await getPersonAccountById(tx.modifiedBy, control)

  if (sender === undefined) {
    return []
  }

  const backlink = TxProcessor.createDoc2Doc(tx.tx as TxCreateDoc<Backlink>)

  if (!hierarchy.isDerived(backlink.backlinkClass, activity.class.ActivityMessage)) {
    return []
  }

  const message = (
    await control.findAll<ActivityMessage>(
      backlink.backlinkClass,
      {
        _id: backlink.backlinkId as Ref<ActivityMessage>
      },
      { limit: 1 }
    )
  )[0]

  if (message === undefined) {
    return []
  }

  const doc = (await control.findAll(message.attachedToClass, { _id: message.attachedTo }))[0]

  if (doc === undefined) {
    return []
  }

  let res: Tx[] = []

  const collabMixin = hierarchy.as(message as Doc, notification.mixin.Collaborators)
  if (collabMixin.collaborators === undefined || !collabMixin.collaborators.includes(receiver._id)) {
    const collabTx = control.txFactory.createTxMixin(
      message._id,
      message._class,
      message.space,
      notification.mixin.Collaborators,
      {
        $push: {
          collaborators: receiver._id
        }
      }
    )
    res.push(collabTx)
  }

  const messageTx = (
    await control.findAll(core.class.TxCollectionCUD, {
      'tx.objectId': message._id,
      'tx._class': core.class.TxCreateDoc
    })
  )[0]

  res = res.concat(
    await createCollabDocInfo([receiver._id], control, messageTx.tx, messageTx, doc, [message as ActivityMessage], true)
  )

  return res
}

async function isBacklinkCreated (
  ptx: TxCollectionCUD<Doc, AttachedDoc>,
  hierarchy: Hierarchy,
  control: TriggerControl
): Promise<boolean> {
  if (ptx.tx._class !== core.class.TxCreateDoc || !hierarchy.isDerived(ptx.tx.objectClass, chunter.class.Backlink)) {
    return false
  }
  if (ptx.objectClass === contact.class.Person) {
    // We need to check if person is employee.
    const [person] = await control.findAll(contact.class.Person, { _id: ptx.objectId as Ref<Person> })
    return person !== undefined ? hierarchy.hasMixin(person, contact.mixin.Employee) : false
  }

  return true
}

/**
 * @public
 */
export async function isAllowed (
  control: TriggerControl,
  receiver: Ref<PersonAccount>,
  typeId: Ref<NotificationType>,
  providerId: Ref<NotificationProvider>
): Promise<boolean> {
  const setting = (
    await control.findAll(
      notification.class.NotificationSetting,
      {
        attachedTo: providerId,
        type: typeId,
        modifiedBy: receiver
      },
      { limit: 1 }
    )
  )[0]
  if (setting !== undefined) {
    return setting.enabled
  }
  const type = (
    await control.modelDb.findAll(notification.class.NotificationType, {
      _id: typeId
    })
  )[0]
  if (type === undefined) return false
  return type.providers[providerId] ?? false
}

async function getTextPart (doc: Doc, control: TriggerControl): Promise<string | undefined> {
  const TextPresenter = getTextPresenter(doc._class, control.hierarchy)
  if (TextPresenter === undefined) return
  return await (
    await getResource(TextPresenter.presenter)
  )(doc, control)
}

async function getHtmlPart (doc: Doc, control: TriggerControl): Promise<string | undefined> {
  const HTMLPresenter = getHTMLPresenter(doc._class, control.hierarchy)
  return HTMLPresenter != null ? await (await getResource(HTMLPresenter.presenter))(doc, control) : undefined
}

/**
 * @public
 */
export function getHTMLPresenter (_class: Ref<Class<Doc>>, hierarchy: Hierarchy): HTMLPresenter | undefined {
  return hierarchy.classHierarchyMixin(_class, serverNotification.mixin.HTMLPresenter)
}

/**
 * @public
 */
export function getTextPresenter (_class: Ref<Class<Doc>>, hierarchy: Hierarchy): TextPresenter | undefined {
  return hierarchy.classHierarchyMixin(_class, serverNotification.mixin.TextPresenter)
}

function fillTemplate (template: string, sender: string, doc: string, data: string): string {
  let res = replaceAll(template, '{sender}', sender)
  res = replaceAll(res, '{doc}', doc)
  res = replaceAll(res, '{data}', data)
  return res
}

/**
 * @public
 */
export async function getContent (
  doc: Doc | undefined,
  sender: string,
  type: Ref<NotificationType>,
  control: TriggerControl,
  data: string
): Promise<Content | undefined> {
  if (doc === undefined) return
  const notificationType = control.modelDb.getObject(type)

  const textPart = await getTextPart(doc, control)
  if (textPart === undefined) return
  if (notificationType.templates === undefined) return
  const text = fillTemplate(notificationType.templates.textTemplate, sender, textPart, data)
  const htmlPart = await getHtmlPart(doc, control)
  const html = fillTemplate(notificationType.templates.htmlTemplate, sender, htmlPart ?? textPart, data)
  const subject = fillTemplate(notificationType.templates.subjectTemplate, sender, textPart, data)
  return {
    text,
    html,
    subject
  }
}

async function notifyByEmail (
  control: TriggerControl,
  type: Ref<NotificationType>,
  doc: Doc | undefined,
  senderId: Ref<PersonAccount>,
  receiverId: Ref<PersonAccount>,
  data: string = ''
): Promise<void> {
  const sender = (await control.modelDb.findAll(contact.class.PersonAccount, { _id: senderId }))[0]

  const receiver = (await control.modelDb.findAll(contact.class.PersonAccount, { _id: receiverId }))[0]
  if (receiver === undefined) return
  let senderName = ''

  if (sender !== undefined) {
    const senderPerson = (await control.findAll(contact.class.Person, { _id: sender.person }))[0]
    senderName = senderPerson !== undefined ? formatName(senderPerson.name) : ''
  }

  const content = await getContent(doc, senderName, type, control, data)

  if (content !== undefined) {
    await sendEmailNotification(content.text, content.html, content.subject, receiver.email)
  }
}

export async function sendEmailNotification (
  text: string,
  html: string,
  subject: string,
  receiver: string
): Promise<void> {
  try {
    const sesURL = getMetadata(serverNotification.metadata.SesUrl)
    if (sesURL === undefined || sesURL === '') {
      console.log('Please provide email service url to enable email confirmations.')
      return
    }
    await fetch(concatLink(sesURL, '/send'), {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        html,
        subject,
        to: [receiver]
      })
    })
  } catch (err) {
    console.log('Could not send email notification', err)
  }
}

async function getValueCollaborators (value: any, attr: AnyAttribute, control: TriggerControl): Promise<Ref<Account>[]> {
  const hierarchy = control.hierarchy
  if (attr.type._class === core.class.RefTo) {
    const to = (attr.type as RefTo<Doc>).to
    if (hierarchy.isDerived(to, contact.class.Person)) {
      const acc = await getPersonAccount(value, control)
      return acc !== undefined ? [acc._id] : []
    } else if (hierarchy.isDerived(to, core.class.Account)) {
      const acc = await getPersonAccountById(value, control)
      return acc !== undefined ? [acc._id] : []
    }
  } else if (attr.type._class === core.class.ArrOf) {
    const arrOf = (attr.type as ArrOf<RefTo<Doc>>).of
    if (arrOf._class === core.class.RefTo) {
      const to = (arrOf as RefTo<Doc>).to
      if (hierarchy.isDerived(to, contact.class.Person)) {
        const employeeAccounts = await control.modelDb.findAll(contact.class.PersonAccount, {
          person: { $in: Array.isArray(value) ? value : [value] }
        })
        return employeeAccounts.map((p) => p._id)
      } else if (hierarchy.isDerived(to, core.class.Account)) {
        const employeeAccounts = await control.modelDb.findAll(contact.class.PersonAccount, {
          _id: { $in: Array.isArray(value) ? value : [value] }
        })
        return employeeAccounts.map((p) => p._id)
      }
    }
  }
  return []
}

async function getKeyCollaborators (
  doc: Doc,
  value: any,
  field: string,
  control: TriggerControl
): Promise<Ref<Account>[] | undefined> {
  if (value !== undefined && value !== null) {
    const attr = control.hierarchy.findAttribute(doc._class, field)
    if (attr !== undefined) {
      return await getValueCollaborators(value, attr, control)
    }
  }
}

/**
 * @public
 */
export async function getDocCollaborators (
  doc: Doc,
  mixin: ClassCollaborators,
  control: TriggerControl
): Promise<Ref<Account>[]> {
  const collaborators = new Set<Ref<Account>>()
  for (const field of mixin.fields) {
    const value = (doc as any)[field]
    const newCollaborators = await getKeyCollaborators(doc, value, field, control)
    if (newCollaborators !== undefined) {
      for (const newCollaborator of newCollaborators) {
        collaborators.add(newCollaborator)
      }
    }
  }
  return Array.from(collaborators.values())
}

function getDocNotifyContext (
  docNotifyContexts: DocNotifyContext[],
  targetUser: Ref<Account>,
  attachedTo: Ref<Doc>,
  res: Tx[]
): DocNotifyContext | undefined {
  const context = docNotifyContexts.find((context) => context.user === targetUser && context.attachedTo === attachedTo)

  if (context !== undefined) {
    return context
  }

  const contextTx = (res as TxCUD<Doc>[]).find((tx) => {
    if (tx._class === core.class.TxCreateDoc && tx.objectClass === notification.class.DocNotifyContext) {
      const createTx = tx as TxCreateDoc<DocNotifyContext>

      return createTx.attributes.attachedTo === attachedTo && createTx.attributes.user === targetUser
    }

    return false
  }) as TxCreateDoc<DocNotifyContext> | undefined

  if (contextTx !== undefined) {
    return TxProcessor.createDoc2Doc(contextTx)
  }

  return undefined
}

export async function pushInboxNotifications (
  control: TriggerControl,
  res: Tx[],
  targetUser: Ref<Account>,
  attachedTo: Ref<Doc>,
  attachedToClass: Ref<Class<Doc>>,
  space: Ref<Space>,
  contexts: DocNotifyContext[],
  data: Partial<Data<InboxNotification>>,
  _class: Ref<Class<InboxNotification>>,
  modifiedOn: Timestamp,
  shouldUpdateTimestamp = true
): Promise<void> {
  const context = getDocNotifyContext(contexts, targetUser, attachedTo, res)

  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  const isHidden = !!context?.hidden

  let docNotifyContextId: Ref<DocNotifyContext>

  if (context === undefined) {
    const createContextTx = control.txFactory.createTxCreateDoc(notification.class.DocNotifyContext, space, {
      user: targetUser,
      attachedTo,
      attachedToClass,
      hidden: false,
      lastUpdateTimestamp: shouldUpdateTimestamp ? modifiedOn : undefined
    })
    res.push(createContextTx)
    docNotifyContextId = createContextTx.objectId
  } else {
    if (shouldUpdateTimestamp) {
      res.push(
        control.txFactory.createTxUpdateDoc(context._class, context.space, context._id, {
          lastUpdateTimestamp: modifiedOn
        })
      )
    }
    docNotifyContextId = context._id
  }

  if (!isHidden) {
    res.push(
      control.txFactory.createTxCreateDoc(_class, space, {
        user: targetUser,
        isViewed: false,
        docNotifyContext: docNotifyContextId,
        ...data
      })
    )
  }
}

/**
 * @public
 */
export async function pushActivityInboxNotifications (
  originTx: TxCUD<Doc>,
  control: TriggerControl,
  res: Tx[],
  targetUser: Ref<Account>,
  object: Doc,
  docNotifyContexts: DocNotifyContext[],
  activityMessages: ActivityMessage[],
  shouldUpdateTimestamp = true
): Promise<void> {
  for (const activityMessage of activityMessages) {
    const existNotifications = await control.findAll(notification.class.ActivityInboxNotification, {
      user: targetUser,
      attachedTo: activityMessage._id
    })

    if (existNotifications.length > 0) {
      return
    }

    const content = await getNotificationContent(originTx, targetUser, object, control)
    const data: Partial<Data<ActivityInboxNotification>> = {
      ...content,
      attachedTo: activityMessage._id,
      attachedToClass: activityMessage._class
    }

    await pushInboxNotifications(
      control,
      res,
      targetUser,
      activityMessage.attachedTo,
      activityMessage.attachedToClass,
      activityMessage.space,
      docNotifyContexts,
      data,
      notification.class.ActivityInboxNotification,
      activityMessage.modifiedOn,
      shouldUpdateTimestamp
    )
  }
}

async function getNotificationTxes (
  control: TriggerControl,
  object: Doc,
  tx: TxCUD<Doc>,
  originTx: TxCUD<Doc>,
  target: Ref<Account>,
  isOwn: boolean,
  isSpace: boolean,
  docNotifyContexts: DocNotifyContext[],
  activityMessages: ActivityMessage[],
  shouldUpdateTimestamp = true
): Promise<Tx[]> {
  const res: Tx[] = []
  const notifyResult = await isShouldNotify(control, tx, originTx, object, target, isOwn, isSpace)

  if (notifyResult.allowed) {
    await pushActivityInboxNotifications(
      originTx,
      control,
      res,
      target,
      object,
      docNotifyContexts,
      activityMessages,
      shouldUpdateTimestamp
    )
  }

  if (notifyResult.emails.length === 0) {
    return res
  }
  const acc = await getPersonAccountById(target, control)
  if (acc === undefined) {
    return res
  }
  const emp = await getEmployee(acc.person as Ref<Employee>, control)
  if (emp?.active === true) {
    for (const type of notifyResult.emails) {
      await notifyByEmail(
        control,
        type._id,
        object,
        originTx.modifiedBy as Ref<PersonAccount>,
        target as Ref<PersonAccount>
      )
    }
  }

  return res
}

export async function createCollabDocInfo (
  collaborators: Ref<Account>[],
  control: TriggerControl,
  tx: TxCUD<Doc>,
  originTx: TxCUD<Doc>,
  object: Doc,
  activityMessage: ActivityMessage[],
  isOwn: boolean,
  isSpace: boolean = false,
  shouldUpdateTimestamp = true
): Promise<Tx[]> {
  let res: Tx[] = []

  if (originTx.space === core.space.DerivedTx) {
    return res
  }

  const targets = new Set(collaborators)
  const notifyContexts = await control.findAll(notification.class.DocNotifyContext, {
    attachedTo: { $in: activityMessage.map(({ attachedTo }) => attachedTo) }
  })

  for (const target of targets) {
    res = res.concat(
      await getNotificationTxes(
        control,
        object,
        tx,
        originTx,
        target,
        isOwn,
        isSpace,
        notifyContexts,
        activityMessage,
        shouldUpdateTimestamp
      )
    )
  }
  return res
}

/**
 * @public
 */
export function getMixinTx (
  actualTx: TxCUD<Doc>,
  control: TriggerControl,
  collaborators: Ref<Account>[]
): TxMixin<Doc, Collaborators> {
  return control.txFactory.createTxMixin(
    actualTx.objectId,
    actualTx.objectClass,
    actualTx.objectSpace,
    notification.mixin.Collaborators,
    {
      collaborators
    }
  )
}

async function getSpaceCollabTxes (
  control: TriggerControl,
  doc: Doc,
  tx: TxCUD<Doc>,
  originTx: TxCUD<Doc>,
  activityMessages: ActivityMessage[]
): Promise<Tx[]> {
  const space = (await control.findAll(core.class.Space, { _id: doc.space }))[0]
  if (space === undefined) return []
  const mixin = control.hierarchy.classHierarchyMixin<Doc, ClassCollaborators>(
    space._class,
    notification.mixin.ClassCollaborators
  )
  if (mixin !== undefined) {
    const collabs = control.hierarchy.as<Doc, Collaborators>(space, notification.mixin.Collaborators)
    if (collabs.collaborators !== undefined) {
      return await createCollabDocInfo(collabs.collaborators, control, tx, originTx, doc, activityMessages, false, true)
    }
  }
  return []
}

async function createCollaboratorDoc (
  tx: TxCreateDoc<Doc>,
  control: TriggerControl,
  activityMessage: ActivityMessage[],
  originTx: TxCUD<Doc>
): Promise<Tx[]> {
  const res: Tx[] = []
  const hierarchy = control.hierarchy
  const mixin = hierarchy.classHierarchyMixin(tx.objectClass, notification.mixin.ClassCollaborators)

  if (mixin === undefined) {
    return res
  }

  const doc = TxProcessor.createDoc2Doc(tx)
  const collaborators = await getDocCollaborators(doc, mixin, control)
  const mixinTx = getMixinTx(tx, control, collaborators)

  const notificationTxes = await createCollabDocInfo(collaborators, control, tx, originTx, doc, activityMessage, true)
  res.push(mixinTx)
  res.push(...notificationTxes)

  res.push(...(await getSpaceCollabTxes(control, doc, tx, originTx, activityMessage)))

  return res
}

async function updateCollaboratorsMixin (
  tx: TxMixin<Doc, Collaborators>,
  control: TriggerControl,
  activityMessages: ActivityMessage[],
  originTx: TxCUD<Doc>
): Promise<Tx[]> {
  const { hierarchy } = control

  if (tx._class !== core.class.TxMixin) return []
  if (originTx.space === core.space.DerivedTx) return []
  if (!hierarchy.isDerived(tx.mixin, notification.mixin.Collaborators)) return []

  const res: Tx[] = []

  if (tx.attributes.collaborators !== undefined) {
    const createTx = hierarchy.isDerived(tx.objectClass, core.class.AttachedDoc)
      ? (
          await control.findAll(core.class.TxCollectionCUD, {
            'tx.objectId': tx.objectId,
            'tx._class': core.class.TxCreateDoc
          })
        )[0]
      : (
          await control.findAll(core.class.TxCreateDoc, {
            objectId: tx.objectId
          })
        )[0]
    const mixinTxes = await control.findAll(core.class.TxMixin, {
      objectId: tx.objectId
    })
    const prevDoc = TxProcessor.buildDoc2Doc([createTx, ...mixinTxes].filter((t) => t._id !== tx._id)) as Doc
    const newCollabs: Ref<Account>[] = []

    let prevCollabs: Set<Ref<Account>>

    if (hierarchy.hasMixin(prevDoc, notification.mixin.Collaborators)) {
      const prevDocMixin = control.hierarchy.as(prevDoc, notification.mixin.Collaborators)
      prevCollabs = new Set(prevDocMixin.collaborators ?? [])
    } else {
      const mixin = hierarchy.classHierarchyMixin(prevDoc._class, notification.mixin.ClassCollaborators)
      prevCollabs = mixin !== undefined ? new Set(await getDocCollaborators(prevDoc, mixin, control)) : new Set()
    }

    for (const collab of tx.attributes.collaborators) {
      if (!prevCollabs.has(collab) && tx.modifiedBy !== collab) {
        if (
          await isAllowed(
            control,
            collab as Ref<PersonAccount>,
            notification.ids.CollaboratoAddNotification,
            notification.providers.PlatformNotification
          )
        ) {
          newCollabs.push(collab)
        }
      }
    }

    if (newCollabs.length > 0) {
      const docNotifyContexts = await control.findAll(notification.class.DocNotifyContext, {
        user: { $in: newCollabs },
        attachedTo: tx.objectId
      })
      for (const collab of newCollabs) {
        await pushActivityInboxNotifications(
          originTx,
          control,
          res,
          collab,
          prevDoc,
          docNotifyContexts,
          activityMessages
        )
      }
    }
  }
  return res
}

async function collectionCollabDoc (
  tx: TxCollectionCUD<Doc, AttachedDoc>,
  control: TriggerControl,
  activityMessages: ActivityMessage[]
): Promise<Tx[]> {
  const actualTx = TxProcessor.extractTx(tx) as TxCUD<Doc>
  let res = await createCollaboratorNotifications(control.ctx, actualTx, control, activityMessages, tx)

  if (![core.class.TxCreateDoc, core.class.TxRemoveDoc, core.class.TxUpdateDoc].includes(actualTx._class)) {
    return res
  }

  const isNotificationPushed = (res as TxCUD<Doc>[]).some(
    ({ _class, objectClass }) =>
      _class === core.class.TxCreateDoc && objectClass === notification.class.ActivityInboxNotification
  )

  if (isNotificationPushed) {
    return res
  }

  const mixin = control.hierarchy.classHierarchyMixin(tx.objectClass, notification.mixin.ClassCollaborators)

  if (mixin === undefined) {
    return res
  }

  const doc = (await control.findAll(tx.objectClass, { _id: tx.objectId }, { limit: 1 }))[0]

  if (doc === undefined) {
    return res
  }

  if (control.hierarchy.hasMixin(doc, notification.mixin.Collaborators)) {
    const collaborators = control.hierarchy.as(doc, notification.mixin.Collaborators)

    res = res.concat(
      await createCollabDocInfo(collaborators.collaborators, control, actualTx, tx, doc, activityMessages, false)
    )
  } else {
    const collaborators = await getDocCollaborators(doc, mixin, control)

    res.push(getMixinTx(tx, control, collaborators))
    res = res.concat(await createCollabDocInfo(collaborators, control, actualTx, tx, doc, activityMessages, false))
  }
  return res
}

async function removeCollaboratorDoc (tx: TxRemoveDoc<Doc>, control: TriggerControl): Promise<Tx[]> {
  const hierarchy = control.hierarchy
  const mixin = hierarchy.classHierarchyMixin(tx.objectClass, notification.mixin.ClassCollaborators)

  if (mixin === undefined) {
    return []
  }

  const res: Tx[] = []
  const notifyContexts = await control.findAll(notification.class.DocNotifyContext, { attachedTo: tx.objectId })
  const notifyContextRefs = notifyContexts.map(({ _id }) => _id)
  const inboxNotifications = await control.findAll(notification.class.InboxNotification, {
    docNotifyContext: { $in: notifyContextRefs }
  })

  inboxNotifications.forEach((notification) => {
    res.push(control.txFactory.createTxRemoveDoc(notification._class, notification.space, notification._id))
  })
  notifyContexts.forEach((context) => {
    res.push(control.txFactory.createTxRemoveDoc(context._class, context.space, context._id))
  })

  return res
}

async function getNewCollaborators (
  ops: DocumentUpdate<Doc> | MixinUpdate<Doc, Doc>,
  mixin: ClassCollaborators,
  doc: Doc,
  control: TriggerControl
): Promise<Ref<Account>[]> {
  const newCollaborators = new Set<Ref<Account>>()
  if (ops.$push !== undefined) {
    for (const key in ops.$push) {
      if (mixin.fields.includes(key)) {
        let value = (ops.$push as any)[key]
        if (typeof value !== 'string') {
          value = value.$each
        }
        const newCollabs = await getKeyCollaborators(doc, value, key, control)
        if (newCollabs !== undefined) {
          for (const newCollab of newCollabs) {
            newCollaborators.add(newCollab)
          }
        }
      }
    }
  }
  for (const key in ops) {
    if (key.startsWith('$')) continue
    if (mixin.fields.includes(key)) {
      const value = (ops as any)[key]
      const newCollabs = await getKeyCollaborators(doc, value, key, control)
      if (newCollabs !== undefined) {
        for (const newCollab of newCollabs) {
          newCollaborators.add(newCollab)
        }
      }
    }
  }
  return Array.from(newCollaborators.values())
}

async function updateCollaboratorDoc (
  tx: TxUpdateDoc<Doc> | TxMixin<Doc, Doc>,
  control: TriggerControl,
  originTx: TxCUD<Doc>,
  activityMessages: ActivityMessage[]
): Promise<Tx[]> {
  const hierarchy = control.hierarchy
  let res: Tx[] = []
  const mixin = hierarchy.classHierarchyMixin(tx.objectClass, notification.mixin.ClassCollaborators)
  if (mixin === undefined) return []
  const doc = (await control.findAll(tx.objectClass, { _id: tx.objectId }, { limit: 1 }))[0]
  if (doc === undefined) return []
  if (hierarchy.hasMixin(doc, notification.mixin.Collaborators)) {
    // we should handle change field and subscribe new collaborators
    const collabMixin = hierarchy.as(doc, notification.mixin.Collaborators)
    const collabs = new Set(collabMixin.collaborators)
    const ops = isMixinTx(tx) ? tx.attributes : tx.operations
    const newCollaborators = (await getNewCollaborators(ops, mixin, doc, control)).filter((p) => !collabs.has(p))

    if (newCollaborators.length > 0) {
      res.push(
        control.txFactory.createTxMixin(tx.objectId, tx.objectClass, tx.objectSpace, notification.mixin.Collaborators, {
          $push: {
            collaborators: {
              $each: newCollaborators,
              $position: 0
            }
          }
        })
      )
    }
    res = res.concat(
      await createCollabDocInfo(
        [...collabMixin.collaborators, ...newCollaborators],
        control,
        tx,
        originTx,
        doc,
        activityMessages,
        true,
        false
      )
    )
  } else {
    const collaborators = await getDocCollaborators(doc, mixin, control)
    res.push(getMixinTx(tx, control, collaborators))
    res = res.concat(
      await createCollabDocInfo(collaborators, control, tx, originTx, doc, activityMessages, true, false)
    )
  }

  res = res.concat(await getSpaceCollabTxes(control, doc, tx, originTx, activityMessages))
  res = res.concat(await updateNotifyContextsSpace(control, tx))

  return res
}

/**
 * @public
 */
export async function OnAttributeCreate (tx: Tx, control: TriggerControl): Promise<Tx[]> {
  const attribute = TxProcessor.createDoc2Doc(tx as TxCreateDoc<AnyAttribute>)
  const group = (
    await control.modelDb.findAll(notification.class.NotificationGroup, { objectClass: attribute.attributeOf })
  )[0]
  if (group === undefined) return []
  const isCollection: boolean = core.class.Collection === attribute.type._class
  const objectClass = !isCollection ? attribute.attributeOf : (attribute.type as Collection<AttachedDoc>).of
  const txClasses = !isCollection
    ? [control.hierarchy.isMixin(attribute.attributeOf) ? core.class.TxMixin : core.class.TxUpdateDoc]
    : [core.class.TxCreateDoc, core.class.TxRemoveDoc]
  const data: Data<NotificationType> = {
    attribute: attribute._id,
    group: group._id,
    field: attribute.name,
    generated: true,
    objectClass,
    txClasses,
    hidden: false,
    providers: {
      [notification.providers.PlatformNotification]: false
    },
    label: attribute.label
  }
  if (isCollection) {
    data.attachedToClass = attribute.attributeOf
  }
  const id =
    `${notification.class.NotificationType}_${attribute.attributeOf}_${attribute.name}` as Ref<NotificationType>
  const res = control.txFactory.createTxCreateDoc(notification.class.NotificationType, core.space.Model, data, id)
  return [res]
}

/**
 * @public
 */
export async function OnAttributeUpdate (tx: Tx, control: TriggerControl): Promise<Tx[]> {
  const ctx = tx as TxUpdateDoc<AnyAttribute>
  if (ctx.operations.hidden === undefined) return []
  const type = (await control.findAll(notification.class.NotificationType, { attribute: ctx.objectId }))[0]
  if (type === undefined) return []
  const res = control.txFactory.createTxUpdateDoc(type._class, type.space, type._id, {
    hidden: ctx.operations.hidden
  })
  return [res]
}

export async function createCollaboratorNotifications (
  ctx: MeasureContext,
  tx: TxCUD<Doc>,
  control: TriggerControl,
  activityMessages: ActivityMessage[],
  originTx?: TxCUD<Doc>
): Promise<Tx[]> {
  if (tx.space === core.space.DerivedTx) {
    return []
  }

  switch (tx._class) {
    case core.class.TxCreateDoc:
      return await createCollaboratorDoc(tx as TxCreateDoc<Doc>, control, activityMessages, originTx ?? tx)
    case core.class.TxUpdateDoc:
    case core.class.TxMixin: {
      let res = await updateCollaboratorDoc(tx as TxUpdateDoc<Doc>, control, originTx ?? tx, activityMessages)
      res = res.concat(
        await updateCollaboratorsMixin(tx as TxMixin<Doc, Collaborators>, control, activityMessages, originTx ?? tx)
      )
      return res
    }
    case core.class.TxRemoveDoc:
      return await removeCollaboratorDoc(tx as TxRemoveDoc<Doc>, control)
    case core.class.TxCollectionCUD:
      return await collectionCollabDoc(tx as TxCollectionCUD<Doc, AttachedDoc>, control, activityMessages)
  }

  return []
}

async function OnChatMessageCreate (tx: TxCollectionCUD<Doc, ChatMessage>, control: TriggerControl): Promise<Tx[]> {
  const createTx = TxProcessor.extractTx(tx) as TxCreateDoc<ChatMessage>
  const message = (await control.findAll(chunter.class.ChatMessage, { _id: createTx.objectId }))[0]

  return await createCollaboratorNotifications(control.ctx, tx, control, [message])
}

/**
 * @public
 */
export async function removeDocInboxNotifications (_id: Ref<ActivityMessage>, control: TriggerControl): Promise<Tx[]> {
  const inboxNotifications = await control.findAll(notification.class.InboxNotification, { attachedTo: _id })

  return inboxNotifications.map((inboxNotification) =>
    control.txFactory.createTxRemoveDoc(
      notification.class.InboxNotification,
      inboxNotification.space,
      inboxNotification._id
    )
  )
}

async function OnActivityNotificationViewed (
  tx: TxUpdateDoc<InboxNotification>,
  control: TriggerControl
): Promise<Tx[]> {
  if (tx.objectClass !== notification.class.ActivityInboxNotification || tx.operations.isViewed !== true) {
    return []
  }

  const inboxNotification = (
    await control.findAll(notification.class.ActivityInboxNotification, {
      _id: tx.objectId as Ref<ActivityInboxNotification>
    })
  )[0]

  if (inboxNotification === undefined) {
    return []
  }

  // Read reactions notifications when message is read
  const { attachedTo, user } = inboxNotification

  const reactionMessages = await control.findAll(activity.class.DocUpdateMessage, {
    attachedTo,
    objectClass: activity.class.Reaction
  })

  if (reactionMessages.length === 0) {
    return []
  }

  const reactionNotifications = await control.findAll(notification.class.ActivityInboxNotification, {
    attachedTo: { $in: reactionMessages.map(({ _id }) => _id) },
    user
  })

  return reactionNotifications.map(({ _id, _class, space }) =>
    control.txFactory.createTxUpdateDoc(_class, space, _id, { isViewed: true })
  )
}

export * from './types'
export * from './utils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  trigger: {
    OnChatMessageCreate,
    OnAttributeCreate,
    OnAttributeUpdate,
    OnBacklinkCreate,
    OnActivityNotificationViewed
  },
  function: {
    IsUserInFieldValue: isUserInFieldValue,
    IsUserEmployeeInFieldValue: isUserEmployeeInFieldValue
  }
})
