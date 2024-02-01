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

import { type Resources } from '@hcengineering/platform'

import Activity from './components/Activity.svelte'
import ActivityMessagePresenter from './components/activity-message/ActivityMessagePresenter.svelte'
import DocUpdateMessagePresenter from './components/doc-update-message/DocUpdateMessagePresenter.svelte'
import ActivityInfoMessagePresenter from './components/activity-message/ActivityInfoMessagePresenter.svelte'
import ReactionPresenter from './components/reactions/ReactionPresenter.svelte'
import ReactionNotificationPresenter from './components/reactions/ReactionNotificationPresenter.svelte'
import ActivityMessageNotificationLabel from './components/activity-message/ActivityMessageNotificationLabel.svelte'

import { getMessageFragment, attributesFilter, pinnedFilter, allFilter } from './activityMessagesUtils'

export * from './activity'
export * from './utils'
export * from './activityMessagesUtils'

export { default as Reactions } from './components/reactions/Reactions.svelte'
export { default as ActivityMessageTemplate } from './components/activity-message/ActivityMessageTemplate.svelte'
export { default as ActivityMessagePresenter } from './components/activity-message/ActivityMessagePresenter.svelte'
export { default as ActivityExtension } from './components/ActivityExtension.svelte'
export { default as ActivityDocLink } from './components/ActivityDocLink.svelte'
export { default as ReactionPresenter } from './components/reactions/ReactionPresenter.svelte'
export { default as ActivityMessageNotificationLabel } from './components/activity-message/ActivityMessageNotificationLabel.svelte'
export { default as ActivityMessageHeader } from './components/activity-message/ActivityMessageHeader.svelte'
export { default as AddReactionAction } from './components/reactions/AddReactionAction.svelte'
export { default as ActivityMessageAction } from './components/ActivityMessageAction.svelte'
export { default as ActivityMessagesFilterPopup } from './components/FilterPopup.svelte'

export default async (): Promise<Resources> => ({
  component: {
    Activity,
    ActivityMessagePresenter,
    DocUpdateMessagePresenter,
    ReactionPresenter,
    ActivityInfoMessagePresenter,
    ReactionNotificationPresenter,
    ActivityMessageNotificationLabel
  },
  filter: {
    AttributesFilter: attributesFilter,
    PinnedFilter: pinnedFilter,
    AllFilter: allFilter
  },
  function: {
    GetFragment: getMessageFragment
  }
})
