//
// Copyright © 2022 Hardcore Engineering Inc.
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

import core, { Class, Doc } from '@anticrm/core'
import { Builder } from '@anticrm/model'
import serverCore, { ObjectDDParticipant } from '@anticrm/server-core'
import serverTags from '@anticrm/server-tags'
import tags from '@anticrm/tags'

export function createModel (builder: Builder): void {
  builder.createDoc(serverCore.class.Trigger, core.space.Model, {
    trigger: serverTags.trigger.onTagReference
  })

  builder.mixin<Class<Doc>, ObjectDDParticipant>(
    tags.class.TagElement,
    core.class.Class,
    serverCore.mixin.ObjectDDParticipant,
    {
      collectDocs: serverTags.function.TagElementRemove
    }
  )
}
