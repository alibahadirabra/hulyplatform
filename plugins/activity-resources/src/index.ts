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
import ReactionAddedMessage from './components/reactions/ReactionAddedMessage.svelte'

import { attributesFilter, pinnedFilter } from './activityMessagesUtils'

export * from './activity'
export * from './utils'
export * from './activityMessagesUtils'

export { default as Reactions } from './components/reactions/Reactions.svelte'
export { default as ActivityMessageTemplate } from './components/activity-message/ActivityMessageTemplate.svelte'
export { default as ActivityMessagePresenter } from './components/activity-message/ActivityMessagePresenter.svelte'
export { default as ActivityExtension } from './components/ActivityExtension.svelte'

export default async (): Promise<Resources> => ({
  component: {
    Activity,
    ActivityMessagePresenter,
    DocUpdateMessagePresenter,
    ReactionAddedMessage,
    ActivityInfoMessagePresenter
  },
  filter: {
    AttributesFilter: attributesFilter,
    PinnedFilter: pinnedFilter
  }
})
