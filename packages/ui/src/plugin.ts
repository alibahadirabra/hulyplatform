//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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

import type { IntlString, Plugin } from '@anticrm/platform'
import { plugin } from '@anticrm/platform'

/**
 * @public
 */
export const uiId = 'ui' as Plugin

export default plugin(uiId, {
  string: {
    EditBoxPlaceholder: '' as IntlString,
    Cancel: '' as IntlString,
    Minutes: '' as IntlString,
    Hours: '' as IntlString,
    Days: '' as IntlString,
    ShowMore: '' as IntlString,
    ShowLess: '' as IntlString,
    Search: '' as IntlString,
    SearchDots: '' as IntlString,
    Suggested: '' as IntlString,
    TimeTooltip: '' as IntlString
  }
})
