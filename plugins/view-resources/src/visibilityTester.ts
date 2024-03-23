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

import core, { checkPermission, type Space, type Doc, type TypedSpace } from '@hcengineering/core'
import { getClient } from '@hcengineering/presentation'

function isTypedSpace (space: Space): space is TypedSpace {
  return getClient().getHierarchy().isDerived(space._class, core.class.TypedSpace)
}

export async function canDeleteObject (doc?: Doc | Doc[]): Promise<boolean> {
  if (doc === undefined) {
    return false
  }

  const client = getClient()
  const targets = Array.isArray(doc) ? doc : [doc]
  // Note: allow deleting objects in NOT typed spaces for now
  const targetSpaces = (await client.findAll(core.class.Space, { _id: { $in: targets.map((t) => t.space) } })).filter(
    isTypedSpace
  )

  return (
    await Promise.all(
      Array.from(new Set(targetSpaces.map((t) => t._id))).map(
        async (s) => await checkPermission(client, core.permission.DeleteObject, s)
      )
    )
  ).every((r) => r)
}
