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

import activity, { activityId } from '@hcengineering/activity'
import type { IntlString } from '@hcengineering/platform'
import { mergeIds } from '@hcengineering/platform'

export default mergeIds(activityId, activity, {
  string: {
    DocCreated: '' as IntlString,
    DocDeleted: '' as IntlString,
    CollectionUpdated: '' as IntlString,
    Changed: '' as IntlString,
    To: '' as IntlString,
    Unset: '' as IntlString,
    System: '' as IntlString,
    Added: '' as IntlString,
    Removed: '' as IntlString,
    From: '' as IntlString
  }
})
