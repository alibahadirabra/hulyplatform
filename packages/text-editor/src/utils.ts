//
// Copyright © 2023 Hardcore Engineering Inc.
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

import { type onStatelessParameters } from '@hocuspocus/provider'
import { type Attribute } from '@tiptap/core'
import { get } from 'svelte/store'
import * as Y from 'yjs'

import contact, { type PersonAccount, formatName, AvatarType } from '@hcengineering/contact'
import { getCurrentAccount } from '@hcengineering/core'
import { getClient } from '@hcengineering/presentation'
import {
  type ColorDefinition,
  getPlatformAvatarColorByName,
  getPlatformAvatarColorForTextDef,
  themeStore
} from '@hcengineering/ui'

import { type DocumentId, TiptapCollabProvider } from './provider/tiptap'
import { type CollaborationUser } from './types'

type ProviderData = (
  | {
    provider: TiptapCollabProvider
  }
  | {
    collaboratorURL: string
    token: string
  }
) & { ydoc?: Y.Doc }

function getProvider (
  documentId: DocumentId,
  providerData: ProviderData,
  initialContentId?: DocumentId,
  targetContentId?: DocumentId
): TiptapCollabProvider {
  if (!('provider' in providerData)) {
    const provider = new TiptapCollabProvider({
      url: providerData.collaboratorURL,
      name: documentId,
      document: providerData.ydoc ?? new Y.Doc(),
      token: providerData.token,
      parameters: {
        initialContentId,
        targetContentId
      },
      onStateless (data: onStatelessParameters) {
        try {
          const payload = JSON.parse(data.payload)
          if ('status' in payload && payload.status === 'completed') {
            provider.destroy()
          }
        } catch (e) {
          console.error('Failed to check provider operation status', e)
        }
      }
    })

    return provider
  } else {
    return providerData.provider
  }
}

export function copyDocumentField (
  documentId: DocumentId,
  srcFieldId: string,
  dstFieldId: string,
  providerData: ProviderData,
  initialContentId?: DocumentId
): void {
  const provider = getProvider(documentId, providerData, initialContentId)
  provider.copyField(documentId, srcFieldId, dstFieldId)
}

export function copyDocumentContent (
  documentId: DocumentId,
  snapshotId: DocumentId,
  providerData: ProviderData,
  initialContentId?: DocumentId
): void {
  const provider = getProvider(documentId, providerData, initialContentId)
  provider.copyContent(documentId, snapshotId)
}

export function getDataAttribute (
  name: string,
  options?: Omit<Attribute, 'parseHTML' | 'renderHTML'>
): Partial<Attribute> {
  const dataName = `data-${name}`

  return {
    default: null,
    parseHTML: (element) => element.getAttribute(dataName),
    renderHTML: (attributes) => {
      // eslint-disable-next-line
      if (!attributes[name]) {
        return {}
      }

      return {
        [dataName]: attributes[name]
      }
    },
    ...(options ?? {})
  }
}

function getAvatarColor (name: string, avatar: string, darkTheme: boolean): ColorDefinition {
  const [type, color] = avatar.split('://')
  if (type === AvatarType.COLOR) {
    return getPlatformAvatarColorByName(color, darkTheme)
  }
  return getPlatformAvatarColorForTextDef(name, darkTheme)
}

export async function getCollaborationUser (): Promise<CollaborationUser> {
  const client = getClient()

  const me = getCurrentAccount() as PersonAccount
  const person = await client.findOne(contact.class.Person, { _id: me.person })
  const name = person !== undefined ? formatName(person.name) : me.email
  const color = getAvatarColor(name, person?.avatar ?? '', get(themeStore).dark)

  return {
    id: me._id,
    name,
    email: me.email,
    color: color.icon ?? 'var(--theme-button-default)'
  }
}
