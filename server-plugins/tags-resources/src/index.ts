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

import { Class, Doc, DocumentQuery, FindOptions, FindResult, Hierarchy, Ref } from '@anticrm/core'
import tags, { TagElement } from '@anticrm/tags'

/**
 * @public
 */
export async function TagElementRemove (doc: Doc, hiearachy: Hierarchy, findAll: <T extends Doc> (clazz: Ref<Class<T>>, query: DocumentQuery<T>, options?: FindOptions<T>) => Promise<FindResult<T>>): Promise<Doc[]> {
  if (!hiearachy.isDerived(doc._class, tags.class.TagElement)) return []
  return await findAll(tags.class.TagReference, { tag: doc._id as Ref<TagElement> })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  function: {
    TagElementRemove
  }
})
