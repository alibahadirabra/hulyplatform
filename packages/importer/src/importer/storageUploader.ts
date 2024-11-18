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
import { saveCollaborativeDoc } from '@hcengineering/collaboration'
import { CollaborativeDoc, Doc, MeasureContext, Blob as PlatformBlob, Ref, WorkspaceIdWithUrl } from '@hcengineering/core'
import type { StorageAdapter } from '@hcengineering/server-core'
import { Doc as YDoc } from 'yjs'
import { FileUploader, UploadResult } from './uploader'

export class StorageFileUploader implements FileUploader {
  constructor (
    private readonly ctx: MeasureContext,
    private readonly storageAdapter: StorageAdapter,
    private readonly wsUrl: WorkspaceIdWithUrl
  ) {
    this.uploadFile = this.uploadFile.bind(this)
  }

  public async uploadFile (id: Ref<Doc>, name: string, file: File, contentType?: string): Promise<UploadResult> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const type = contentType ?? file.type
      await this.storageAdapter.put(this.ctx, this.wsUrl, id, buffer, type, buffer.byteLength)
      return { success: true, id: id as Ref<PlatformBlob> }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  public async uploadCollaborativeDoc (id: Ref<Doc>, collabId: CollaborativeDoc, yDoc: YDoc): Promise<UploadResult> {
    try {
      await saveCollaborativeDoc(this.ctx, this.storageAdapter, this.wsUrl, collabId, yDoc)
      return { success: true, id: id as Ref<PlatformBlob> }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  public getFileUrl (id: string): string {
    return '' // todo: check
  }
}
