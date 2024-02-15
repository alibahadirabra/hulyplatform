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
import { getMetadata } from '@hcengineering/platform'
import presentation from '@hcengineering/presentation'
import { concatLink } from '@hcengineering/core'
import { ObservableV2 as Observable } from 'lib0/observable'
import { type Doc as YDoc, applyUpdate } from 'yjs'

interface EVENTS {
  synced: (...args: any[]) => void
}

async function fetchContent (doc: YDoc, name: string): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      const frontUrl = getMetadata(presentation.metadata.FrontUrl) ?? window.location.origin

      try {
        const res = await fetch(concatLink(frontUrl, `/files?file=${name}`))

        if (res.ok) {
          const blob = await res.blob()
          const buffer = await blob.arrayBuffer()
          applyUpdate(doc, new Uint8Array(buffer))
          return
        }
      } catch {}
    } catch (err: any) {
      console.error(err)
    }
    // White a while
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

export class MinioProvider extends Observable<EVENTS> {
  loaded: Promise<void>

  constructor (name: string, doc: YDoc) {
    super()

    if (name.startsWith('minio://')) {
      name = name.split('://', 2)[1]
      if (name.includes('/')) {
        // drop workspace part
        name = name.split('/', 2)[1]
      }
    }

    void fetchContent(doc, name).then(() => {
      this.emit('synced', [this])
    })

    this.loaded = new Promise((resolve) => {
      this.on('synced', resolve)
    })
  }
}
