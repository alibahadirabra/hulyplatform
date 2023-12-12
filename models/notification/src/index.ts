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

import activity, { type ActivityMessage } from '@hcengineering/activity'
import chunter from '@hcengineering/chunter'
import {
  type Account,
  type AttachedDoc,
  type Class,
  type Collection,
  type Data,
  type Doc,
  type Domain,
  DOMAIN_MODEL,
  Hierarchy,
  IndexKind,
  type Ref,
  type Timestamp,
  type Tx,
  type TxCUD
} from '@hcengineering/core'
import {
  ArrOf,
  type Builder,
  Index,
  Mixin,
  Model,
  Prop,
  TypeRef,
  TypeString,
  UX,
  TypeBoolean,
  TypeDate
} from '@hcengineering/model'
import core, { TAttachedDoc, TClass, TDoc } from '@hcengineering/model-core'
import preference, { TPreference } from '@hcengineering/model-preference'
import view, { createAction } from '@hcengineering/model-view'
import workbench from '@hcengineering/model-workbench'
import {
  type DocUpdates,
  type DocUpdateTx,
  inboxId,
  type InboxNotification,
  type DocNotifyContext,
  type Notification,
  type NotificationGroup,
  type NotificationPreferencesGroup,
  type NotificationPreview,
  type NotificationProvider,
  type NotificationSetting,
  type NotificationStatus,
  type NotificationTemplate,
  type NotificationType,
  notificationId,
  type NotificationObjectPresenter
} from '@hcengineering/notification'
import { type Asset, type IntlString } from '@hcengineering/platform'
import setting from '@hcengineering/setting'
import { type AnyComponent } from '@hcengineering/ui/src/types'

import notification from './plugin'

export { notificationId } from '@hcengineering/notification'
export { notificationOperation } from './migration'
export { notification as default }

export const DOMAIN_NOTIFICATION = 'notification' as Domain

@Model(notification.class.Notification, core.class.AttachedDoc, DOMAIN_NOTIFICATION)
export class TNotification extends TAttachedDoc implements Notification {
  @Prop(TypeRef(core.class.Tx), 'TX' as IntlString)
    tx!: Ref<TxCUD<Doc>>

  @Prop(TypeString(), 'Status' as IntlString)
    status!: NotificationStatus

  text!: string

  type!: Ref<NotificationType>
}

@Model(notification.class.NotificationType, core.class.Doc, DOMAIN_MODEL)
export class TNotificationType extends TDoc implements NotificationType {
  generated!: boolean
  label!: IntlString
  group!: Ref<NotificationGroup>
  txClasses!: Ref<Class<Tx>>[]
  providers!: Record<Ref<NotificationProvider>, boolean>
  objectClass!: Ref<Class<Doc>>
  hidden!: boolean
  templates?: NotificationTemplate
  onlyOwn?: boolean
}

@Model(notification.class.NotificationGroup, core.class.Doc, DOMAIN_MODEL)
export class TNotificationGroup extends TDoc implements NotificationGroup {
  label!: IntlString
  icon!: Asset
  // using for autogenerated settings
  objectClass?: Ref<Class<Doc>>
}

@Model(notification.class.NotificationPreferencesGroup, core.class.Doc, DOMAIN_MODEL)
export class TNotificationPreferencesGroup extends TDoc implements NotificationPreferencesGroup {
  label!: IntlString
  icon!: Asset
  presenter!: AnyComponent
}

@Model(notification.class.NotificationProvider, core.class.Doc, DOMAIN_MODEL)
export class TNotificationProvider extends TDoc implements NotificationProvider {
  label!: IntlString
  default!: boolean
}

@Model(notification.class.NotificationSetting, preference.class.Preference)
export class TNotificationSetting extends TPreference implements NotificationSetting {
  declare attachedTo: Ref<TNotificationProvider>
  type!: Ref<TNotificationType>
  enabled!: boolean
}

@Mixin(notification.mixin.ClassCollaborators, core.class.Class)
export class TClassCollaborators extends TClass {
  fields!: string[]
}

@Mixin(notification.mixin.Collaborators, core.class.Doc)
@UX(notification.string.Collaborators)
export class TCollaborators extends TDoc {
  @Prop(ArrOf(TypeRef(core.class.Account)), notification.string.Collaborators)
  @Index(IndexKind.Indexed)
    collaborators!: Ref<Account>[]
}

@Mixin(notification.mixin.NotificationObjectPresenter, core.class.Class)
export class TNotificationObjectPresenter extends TClass implements NotificationObjectPresenter {
  presenter!: AnyComponent
}

@Mixin(notification.mixin.NotificationPreview, core.class.Class)
export class TNotificationPreview extends TClass implements NotificationPreview {
  presenter!: AnyComponent
}

@Model(notification.class.DocUpdates, core.class.Doc, DOMAIN_NOTIFICATION)
export class TDocUpdates extends TDoc implements DocUpdates {
  @Index(IndexKind.Indexed)
    user!: Ref<Account>

  @Index(IndexKind.Indexed)
    attachedTo!: Ref<Doc>

  @Index(IndexKind.Indexed)
    hidden!: boolean

  attachedToClass!: Ref<Class<Doc>>
  lastTxTime?: Timestamp
  txes!: DocUpdateTx[]
}

@Model(notification.class.DocNotifyContext, core.class.Doc, DOMAIN_NOTIFICATION)
export class TDocNotifyContext extends TDoc implements DocNotifyContext {
  @Prop(TypeRef(core.class.Account), core.string.Account)
  @Index(IndexKind.Indexed)
    user!: Ref<Account>

  @Prop(TypeRef(core.class.Doc), core.string.AttachedTo)
  @Index(IndexKind.Indexed)
    attachedTo!: Ref<Doc>

  @Prop(TypeRef(core.class.Class), core.string.AttachedToClass)
  @Index(IndexKind.Indexed)
    attachedToClass!: Ref<Class<Doc>>

  @Prop(TypeBoolean(), core.string.Archived)
  @Index(IndexKind.Indexed)
    hidden!: boolean

  @Prop(TypeDate(), core.string.Date)
  @Index(IndexKind.Indexed)
    lastViewedTimestamp?: Timestamp

  @Prop(TypeDate(), core.string.Date)
  @Index(IndexKind.Indexed)
    lastUpdateTimestamp?: Timestamp
}

@Model(notification.class.InboxNotification, core.class.Doc, DOMAIN_NOTIFICATION)
export class TInboxNotification extends TDoc implements InboxNotification {
  @Prop(TypeRef(activity.class.ActivityMessage), core.string.AttachedTo)
  @Index(IndexKind.Indexed)
    attachedTo!: Ref<ActivityMessage>

  @Prop(TypeRef(activity.class.ActivityMessage), core.string.AttachedToClass)
  @Index(IndexKind.Indexed)
    attachedToClass!: Ref<Class<ActivityMessage>>

  @Prop(TypeRef(notification.class.DocNotifyContext), core.string.AttachedTo)
  @Index(IndexKind.Indexed)
    docNotifyContext!: Ref<DocNotifyContext>

  @Prop(TypeRef(core.class.Account), core.string.Account)
  @Index(IndexKind.Indexed)
    user!: Ref<Account>

  @Prop(TypeBoolean(), core.string.Boolean)
  @Index(IndexKind.Indexed)
    isViewed!: boolean
}

export function createModel (builder: Builder): void {
  builder.createModel(
    TNotification,
    TNotificationType,
    TNotificationProvider,
    TNotificationSetting,
    TNotificationGroup,
    TNotificationPreferencesGroup,
    TClassCollaborators,
    TCollaborators,
    TDocUpdates,
    TNotificationObjectPresenter,
    TNotificationPreview,
    TDocNotifyContext,
    TInboxNotification
  )

  // Temporarily disabled, we should think about it
  // builder.createDoc(
  //   notification.class.NotificationProvider,
  //   core.space.Model,
  //   {
  //     label: notification.string.BrowserNotification,
  //     default: true
  //   },
  //   notification.ids.BrowserNotification
  // )

  builder.createDoc(
    notification.class.NotificationProvider,
    core.space.Model,
    {
      label: notification.string.Inbox
    },
    notification.providers.PlatformNotification
  )

  builder.createDoc(
    notification.class.NotificationProvider,
    core.space.Model,
    {
      label: notification.string.EmailNotification
    },
    notification.providers.EmailNotification
  )

  builder.createDoc(
    setting.class.SettingsCategory,
    core.space.Model,
    {
      name: 'notifications',
      label: notification.string.Notifications,
      icon: notification.icon.Notifications,
      component: notification.component.NotificationSettings,
      group: 'settings',
      secured: false,
      order: 2500
    },
    notification.ids.NotificationSettings
  )

  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: notification.string.Inbox,
      icon: notification.icon.Notifications,
      alias: notificationId,
      hidden: true,
      component: notification.component.Inbox,
      aside: chunter.component.ThreadView
    },
    notification.app.Notification
  )

  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: notification.string.Inbox,
      icon: notification.icon.Notifications,
      alias: inboxId,
      hidden: true,
      locationResolver: notification.resolver.Location,
      navigatorModel: {
        aside: notification.component.InboxAside,
        spaces: [],
        specials: [
          {
            id: 'all',
            component: notification.component.NewInbox,
            icon: activity.icon.Activity,
            label: activity.string.AllActivity,
            componentProps: {
              type: 'all',
              label: activity.string.AllActivity
            }
          },
          {
            id: 'reactions',
            component: notification.component.NewInbox,
            icon: activity.icon.Emoji,
            label: activity.string.Reactions,
            componentProps: {
              _class: activity.class.Reaction,
              label: activity.string.Reactions
            }
          }
        ]
      }
    },
    notification.app.Inbox
  )

  createAction(
    builder,
    {
      action: notification.actionImpl.MarkAsUnread,
      actionProps: {},
      label: notification.string.MarkAsUnread,
      icon: notification.icon.Track,
      input: 'focus',
      visibilityTester: notification.function.HasntNotifications,
      category: notification.category.Notification,
      target: notification.class.DocUpdates,
      context: { mode: 'context', application: notification.app.Notification, group: 'edit' }
    },
    notification.action.MarkAsUnread
  )

  createAction(
    builder,
    {
      action: notification.actionImpl.Hide,
      actionProps: {},
      label: notification.string.Archive,
      icon: view.icon.Archive,
      input: 'focus',
      keyBinding: ['Backspace'],
      category: notification.category.Notification,
      target: notification.class.DocUpdates,
      context: { mode: ['context', 'browser'], group: 'edit' }
    },
    notification.action.Hide
  )

  createAction(
    builder,
    {
      action: notification.actionImpl.Unsubscribe,
      actionProps: {},
      label: notification.string.DontTrack,
      icon: notification.icon.Hide,
      input: 'focus',
      category: notification.category.Notification,
      target: notification.class.DocUpdates,
      context: { mode: 'context', application: notification.app.Notification, group: 'edit' }
    },
    notification.action.Unsubscribe
  )

  builder.mixin(notification.class.DocUpdates, core.class.Class, view.mixin.IgnoreActions, {
    actions: [view.action.Delete, view.action.Open]
  })

  createAction(builder, {
    action: workbench.actionImpl.Navigate,
    actionProps: {
      mode: 'app',
      application: notificationId,
      special: notificationId
    },
    label: notification.string.Inbox,
    icon: view.icon.ArrowRight,
    input: 'none',
    category: view.category.Navigation,
    target: core.class.Doc,
    context: {
      mode: ['workbench', 'browser', 'editor', 'panel', 'popup']
    }
  })

  builder.createDoc(
    notification.class.NotificationGroup,
    core.space.Model,
    {
      label: notification.string.Notifications,
      icon: notification.icon.Notifications
    },
    notification.ids.NotificationGroup
  )

  builder.createDoc(
    notification.class.NotificationType,
    core.space.Model,
    {
      hidden: false,
      generated: false,
      label: notification.string.Collaborators,
      group: notification.ids.NotificationGroup,
      txClasses: [],
      objectClass: notification.mixin.Collaborators,
      providers: {
        [notification.providers.PlatformNotification]: true
      }
    },
    notification.ids.CollaboratoAddNotification
  )

  builder.createDoc(
    activity.class.TxViewlet,
    core.space.Model,
    {
      objectClass: notification.mixin.Collaborators,
      icon: notification.icon.Notifications,
      txClass: core.class.TxMixin,
      component: notification.activity.TxCollaboratorsChange,
      display: 'inline',
      editable: false,
      hideOnRemove: true
    },
    notification.ids.TxCollaboratorsChange
  )

  builder.createDoc(
    activity.class.TxViewlet,
    core.space.Model,
    {
      objectClass: chunter.class.DirectMessage,
      icon: chunter.icon.Chunter,
      txClass: core.class.TxCreateDoc,
      component: notification.activity.TxDmCreation,
      display: 'inline',
      editable: false,
      hideOnRemove: true
    },
    notification.ids.TxDmCreation
  )

  builder.createDoc(
    activity.class.DocUpdateMessageViewlet,
    core.space.Model,
    {
      objectClass: notification.mixin.Collaborators,
      action: 'update',
      icon: notification.icon.Notifications,
      component: notification.activity.TxCollaboratorsChange,
      label: notification.string.ChangeCollaborators
    },
    notification.ids.NotificationCollaboratorsChanged
  )

  builder.mixin(notification.mixin.Collaborators, core.class.Class, view.mixin.ActivityAttributePresenter, {
    presenter: notification.component.NotificationCollaboratorsChanged
  })

  createAction(
    builder,
    {
      action: notification.actionImpl.MarkAsReadInboxNotification,
      label: notification.string.MarkAsRead,
      icon: notification.icon.Notifications,
      input: 'focus',
      visibilityTester: notification.function.HasInboxNotifications,
      category: notification.category.Notification,
      target: activity.class.ActivityMessage,
      context: { mode: 'context', application: notification.app.Notification, group: 'edit' }
    },
    notification.action.MarkAsReadInboxNotification
  )

  createAction(
    builder,
    {
      action: notification.actionImpl.MarkAsUnreadInboxNotification,
      label: notification.string.MarkAsUnread,
      icon: notification.icon.Track,
      input: 'focus',
      visibilityTester: notification.function.HasntInboxNotifications,
      category: notification.category.Notification,
      target: activity.class.ActivityMessage,
      context: { mode: 'context', application: notification.app.Notification, group: 'edit' }
    },
    notification.action.MarkAsUnreadInboxNotification
  )

  createAction(
    builder,
    {
      action: notification.actionImpl.DeleteInboxNotification,
      label: notification.string.Archive,
      icon: view.icon.Archive,
      input: 'focus',
      keyBinding: ['Backspace'],
      category: notification.category.Notification,
      target: activity.class.ActivityMessage,
      context: { mode: ['context', 'browser'], group: 'edit' }
    },
    notification.action.DeleteInboxNotification
  )
}

export function generateClassNotificationTypes (
  builder: Builder,
  _class: Ref<Class<Doc>>,
  group: Ref<NotificationGroup>,
  ignoreKeys: string[] = [],
  defaultEnabled: string[] = []
): void {
  const txes = builder.getTxes()
  const hierarchy = new Hierarchy()
  for (const tx of txes) {
    hierarchy.tx(tx)
  }
  const attributes = hierarchy.getAllAttributes(
    _class,
    hierarchy.isDerived(_class, core.class.AttachedDoc) ? core.class.AttachedDoc : core.class.Doc
  )
  const filtered = Array.from(attributes.values()).filter((p) => p.hidden !== true && p.readonly !== true)
  for (const attribute of filtered) {
    if (ignoreKeys.includes(attribute.name)) continue
    const isCollection: boolean = core.class.Collection === attribute.type._class
    const objectClass = !isCollection ? _class : (attribute.type as Collection<AttachedDoc>).of
    const txClasses = !isCollection
      ? hierarchy.isMixin(attribute.attributeOf)
        ? [core.class.TxMixin]
        : [core.class.TxUpdateDoc]
      : [core.class.TxCreateDoc, core.class.TxRemoveDoc]
    const data: Data<NotificationType> = {
      attribute: attribute._id,
      field: attribute.name,
      group,
      generated: true,
      objectClass,
      txClasses,
      hidden: false,
      providers: {
        [notification.providers.PlatformNotification]: defaultEnabled.includes(attribute.name)
      },
      label: attribute.label
    }
    if (isCollection) {
      data.attachedToClass = _class
    }
    const id = `${notification.class.NotificationType}_${_class}_${attribute.name}` as Ref<NotificationType>
    builder.createDoc(notification.class.NotificationType, core.space.Model, data, id)
  }
}
