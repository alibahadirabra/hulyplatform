//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
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

import activity from '@anticrm/activity'
import { Calendar, Event, Reminder } from '@anticrm/calendar'
import { Employee } from '@anticrm/contact'
import type { Domain, Markup, Ref, Timestamp } from '@anticrm/core'
import { IndexKind } from '@anticrm/core'
import { ArrOf, Builder, Collection, Index, Mixin, Model, Prop, TypeDate, TypeMarkup, TypeRef, TypeString, UX } from '@anticrm/model'
import attachment from '@anticrm/model-attachment'
import chunter from '@anticrm/model-chunter'
import contact from '@anticrm/model-contact'
import core, { TAttachedDoc } from '@anticrm/model-core'
import { TSpaceWithStates } from '@anticrm/model-task'
import view from '@anticrm/model-view'
import workbench from '@anticrm/model-workbench'
import notification from '@anticrm/notification'
import calendar from './plugin'

export * from '@anticrm/calendar'

export const DOMAIN_CALENDAR = 'calendar' as Domain

@Model(calendar.class.Calendar, core.class.Space)
@UX(calendar.string.Calendar, calendar.icon.Calendar)
export class TCalendar extends TSpaceWithStates implements Calendar {}

@Model(calendar.class.Event, core.class.AttachedDoc, DOMAIN_CALENDAR)
@UX(calendar.string.Event, calendar.icon.Calendar)
export class TEvent extends TAttachedDoc implements Event {
  @Prop(TypeString(), calendar.string.Title)
  @Index(IndexKind.FullText)
  title!: string

  @Prop(TypeMarkup(), calendar.string.Description)
  @Index(IndexKind.FullText)
  description!: Markup

  @Prop(TypeString(), calendar.string.Location, calendar.icon.Location)
  @Index(IndexKind.FullText)
  location?: string

  @Prop(TypeDate(true), calendar.string.Date)
  date!: Timestamp

  @Prop(TypeDate(true), calendar.string.DueTo)
  dueDate!: Timestamp

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments)
  attachments?: number

  @Prop(Collection(chunter.class.Comment), chunter.string.Comments)
  comments?: number

  @Prop(ArrOf(TypeRef(contact.class.Employee)), calendar.string.Participants)
  participants!: Ref<Employee>[]
}

@Mixin(calendar.mixin.Reminder, calendar.class.Event)
@UX(calendar.string.Reminder, calendar.icon.Calendar)
export class TReminder extends TEvent implements Reminder {
  @Prop(TypeDate(true), calendar.string.Shift)
  shift!: Timestamp

  @Prop(TypeString(), calendar.string.State)
  @Index(IndexKind.Indexed)
  state!: 'active' | 'done'
}

export function createModel (builder: Builder): void {
  builder.createModel(TCalendar, TEvent, TReminder)

  builder.createDoc(workbench.class.Application, core.space.Model, {
    label: calendar.string.ApplicationLabelCalendar,
    icon: calendar.icon.Calendar,
    hidden: true,
    navigatorModel: {
      spaces: [
        {
          label: calendar.string.Calendars,
          spaceClass: calendar.class.Calendar,
          addSpaceLabel: calendar.string.CreateCalendar,
          createComponent: calendar.component.CreateCalendar
        }
      ]
    }
  }, calendar.app.Calendar)

  builder.createDoc(notification.class.NotificationType, core.space.Model, {
    label: calendar.string.Reminder
  }, calendar.ids.ReminderNotification)

  builder.createDoc(activity.class.TxViewlet, core.space.Model, {
    objectClass: calendar.mixin.Reminder,
    icon: calendar.icon.Reminder,
    txClass: core.class.TxMixin,
    label: calendar.string.CreatedReminder,
    component: calendar.activity.ReminderViewlet,
    display: 'emphasized',
    editable: false,
    hideOnRemove: true
  }, calendar.ids.ReminderViewlet)

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: calendar.string.Calendar,
      icon: calendar.icon.Calendar,
      component: calendar.component.CalendarView
    },
    calendar.viewlet.Calendar
  )

  builder.createDoc(
    view.class.Action,
    core.space.Model,
    {
      label: calendar.string.RemindMeAt,
      icon: calendar.icon.Reminder,
      action: calendar.actionImpl.SaveEventReminder,
      singleInput: true
    },
    calendar.action.SaveEventReminder
  )

  builder.createDoc(view.class.ActionTarget, core.space.Model, {
    target: calendar.class.Event,
    action: calendar.action.SaveEventReminder,
    context: {
      mode: 'context'
    }
  })

  builder.mixin(calendar.mixin.Reminder, core.class.Class, view.mixin.AttributePresenter, {
    presenter: calendar.component.ReminderPresenter
  })

  builder.mixin(calendar.class.Event, core.class.Class, view.mixin.ObjectEditor, {
    editor: calendar.component.EditEvent
  })

  // Use generic child presenter
  builder.mixin(calendar.class.Event, core.class.Class, view.mixin.AttributePresenter, {
    presenter: view.component.ObjectPresenter
  })
}

export default calendar
