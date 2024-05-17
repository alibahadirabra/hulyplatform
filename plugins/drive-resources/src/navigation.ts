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

import type { Doc, Ref } from '@hcengineering/core'
import drive, { type Drive, type Folder, driveId } from '@hcengineering/drive'
import { getClient } from '@hcengineering/presentation'
import { type Location, type ResolvedLocation, getCurrentResolvedLocation, getPanelURI } from '@hcengineering/ui'
import view, { type ObjectPanel } from '@hcengineering/view'

export function getPanelFragment<T extends Doc> (object: Pick<T, '_class' | '_id'>): string {
  const hierarchy = getClient().getHierarchy()
  const objectPanelMixin = hierarchy.classHierarchyMixin<Doc, ObjectPanel>(object._class, view.mixin.ObjectPanel)
  const component = objectPanelMixin?.component ?? view.component.EditDoc
  return getPanelURI(component, object._id, object._class, 'content')
}

export function getFolderIdFromFragment (fragment: string): Ref<Folder> | undefined {
  const [, _id] = decodeURIComponent(fragment).split('|')
  return _id as Ref<Folder>
}

export function getDriveLink (_id: Ref<Drive>): Location {
  const loc = getCurrentResolvedLocation()
  loc.path.length = 2
  loc.fragment = undefined
  loc.query = undefined
  loc.path[2] = driveId
  loc.path[3] = _id

  return loc
}

export function getFolderLink (_id: Ref<Folder>): Location {
  const loc = getCurrentResolvedLocation()
  loc.path.length = 2
  loc.fragment = undefined
  loc.query = undefined
  loc.path[2] = driveId
  loc.path[3] = 'folder'
  loc.path[4] = _id

  return loc
}

export async function resolveLocation (loc: Location): Promise<ResolvedLocation | undefined> {
  if (loc.path[2] !== driveId) {
    return undefined
  }

  if (loc.path[3] === 'folder' && loc.path[4] !== undefined) {
    const folderId = loc.path[4] as Ref<Folder>
    return await generateFolderLocation(loc, folderId)
  }

  if (loc.path[3] !== undefined) {
    const driveId = loc.path[3] as Ref<Drive>
    return await generateDriveLocation(loc, driveId)
  }

  return undefined
}

export async function generateFolderLocation (loc: Location, id: Ref<Folder>): Promise<ResolvedLocation | undefined> {
  const client = getClient()

  const doc = await client.findOne(drive.class.Folder, { _id: id })
  if (doc === undefined) {
    console.error(`Could not find folder ${id}.`)
    return undefined
  }

  const appComponent = loc.path[0] ?? ''
  const workspace = loc.path[1] ?? ''

  return {
    loc: {
      path: [appComponent, workspace, driveId, doc.space],
      fragment: getPanelFragment(doc)
    },
    defaultLocation: {
      path: [appComponent, workspace, driveId],
      fragment: getPanelFragment(doc)
    }
  }
}

export async function generateDriveLocation (loc: Location, id: Ref<Drive>): Promise<ResolvedLocation | undefined> {
  const client = getClient()

  const doc = await client.findOne(drive.class.Drive, { _id: id })
  if (doc === undefined) {
    console.error(`Could not find drive ${id}.`)
    return undefined
  }

  const appComponent = loc.path[0] ?? ''
  const workspace = loc.path[1] ?? ''

  return {
    loc: {
      path: [appComponent, workspace, driveId, id],
      fragment: getPanelFragment(doc)
    },
    defaultLocation: {
      path: [appComponent, workspace, driveId],
      fragment: getPanelFragment(doc)
    }
  }
}
