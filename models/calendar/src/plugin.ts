//
// Copyright © 2020 Anticrm Platform Contributors.
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

import { TxViewlet } from '@anticrm/activity'
import { calendarId } from '@anticrm/calendar'
import calendar from '@anticrm/calendar-resources/src/plugin'
import { Ref } from '@anticrm/core'
import type { IntlString } from '@anticrm/platform'
import { mergeIds } from '@anticrm/platform'
import { AnyComponent } from '@anticrm/ui'
import { Action, ActionCategory, ViewAction, Viewlet, ViewletDescriptor } from '@anticrm/view'

export default mergeIds(calendarId, calendar, {
  component: {
    CreateCalendar: '' as AnyComponent,
    CalendarView: '' as AnyComponent,
    EditEvent: '' as AnyComponent,
    ReminderPresenter: '' as AnyComponent,
    EventPresenter: '' as AnyComponent
  },
  action: {
    SaveEventReminder: '' as Ref<Action>
  },
  category: {
    Calendar: '' as Ref<ActionCategory>
  },
  actionImpl: {
    SaveEventReminder: '' as ViewAction
  },
  string: {
    ApplicationLabelCalendar: '' as IntlString,
    Event: '' as IntlString,
    Reminder: '' as IntlString,
    Shift: '' as IntlString,
    State: '' as IntlString,
    CreatedReminder: '' as IntlString
  },
  viewlet: {
    Calendar: '' as Ref<ViewletDescriptor>,
    CalendarEvent: '' as Ref<Viewlet>
  },
  ids: {
    ReminderViewlet: '' as Ref<TxViewlet>
  }
})
