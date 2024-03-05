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

import { WorkspaceId } from '@hcengineering/core'
import { MinioService } from '@hcengineering/minio'
import { Doc as YDoc } from 'yjs'

import { yDocFromBuffer, yDocToBuffer } from './ydoc'

/** @public */
export async function yDocFromMinio (
  minio: MinioService,
  workspace: WorkspaceId,
  minioDocumentId: string,
  ydoc?: YDoc
): Promise<YDoc> {
  // no need to apply gc because we load existing document
  // it is either already gc-ed, or gc not needed and it is disabled
  ydoc ??= new YDoc({ gc: false })

  try {
    const buffer = await minio.read(workspace, minioDocumentId)
    return yDocFromBuffer(Buffer.concat(buffer), ydoc)
  } catch (err) {
    throw new Error('Failed to load ydoc from minio', { cause: err })
  }
}

/** @public */
export async function yDocToMinio (
  minio: MinioService,
  workspace: WorkspaceId,
  minioDocumentId: string,
  ydoc: YDoc
): Promise<void> {
  const buffer = yDocToBuffer(ydoc)
  const metadata = { 'content-type': 'application/ydoc' }
  await minio.put(workspace, minioDocumentId, buffer, buffer.length, metadata)
}
