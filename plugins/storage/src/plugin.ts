//
// Copyright © 2024 Hardcore Engineering Inc.
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

import type { Class, Doc, Mixin, Ref, SpaceType, SpaceTypeDescriptor } from '@hcengineering/core'
import type { Asset, IntlString, Plugin } from '@hcengineering/platform'
import { plugin } from '@hcengineering/platform'
import { Storage } from './types'

export * from './types'

/**
 * @public
 */
export const storageId = 'storage' as Plugin

export const storagePlugin = plugin(storageId, {
  class: {
    Storage: '' as Ref<Class<Storage>>
  },
  mixin: {
    DefaultStorageTypeData: '' as Ref<Mixin<Storage>>
  },
  icon: {
    Storage: '' as Asset
  },
  app: {
    Storage: '' as Ref<Doc>
  },
  string: {
    Storage: '' as IntlString
  },
  descriptor: {
    StorageType: '' as Ref<SpaceTypeDescriptor>
  },
  spaceType: {
    DefaultStorage: '' as Ref<SpaceType>
  }
})

export default storagePlugin
