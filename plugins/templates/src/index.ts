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

import type { Class, Doc, Ref, Space } from '@hcengineering/core'
import type { Plugin } from '@hcengineering/platform'
import { Asset, plugin } from '@hcengineering/platform'

/**
 * @public
 */
export interface MessageTemplate extends Doc {
  title: string
  message: string
}

/**
 * @public
 */
export const templatesId = 'templates' as Plugin

export default plugin(templatesId, {
  class: {
    MessageTemplate: '' as Ref<Class<MessageTemplate>>
  },
  space: {
    Templates: '' as Ref<Space>
  },
  icon: {
    Templates: '' as Asset,
    Template: '' as Asset
  }
})
