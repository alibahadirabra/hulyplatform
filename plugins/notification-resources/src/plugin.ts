/*!
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
*/

import type { IntlString } from '@hcengineering/platform'
import { mergeIds } from '@hcengineering/platform'

import notification, { notificationId } from '@hcengineering/notification'

export default mergeIds(notificationId, notification, {
  string: {
    NoNotifications: '' as IntlString,
    Track: '' as IntlString,
    Remove: '' as IntlString,
    RemoveAll: '' as IntlString,
    MarkAsRead: '' as IntlString,
    MarkAllAsRead: '' as IntlString,
    Change: '' as IntlString,
    AddedRemoved: '' as IntlString,
    You: '' as IntlString,
    YouAddedCollaborators: '' as IntlString,
    YouHaveStartedAConversation: '' as IntlString,
    ChangeCollaborators: '' as IntlString,
    Activity: '' as IntlString,
    People: '' as IntlString,
    All: '' as IntlString,
    Read: '' as IntlString,
    Unread: '' as IntlString
  }
})
