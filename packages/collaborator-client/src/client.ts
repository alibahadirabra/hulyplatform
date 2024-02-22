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

import {
  Account,
  Class,
  CollaborativeDoc,
  Doc,
  Hierarchy,
  Markup,
  Ref,
  Timestamp,
  WorkspaceId,
  concatLink,
  toCollaborativeDocVersion
} from '@hcengineering/core'
import { DocumentURI, collaborativeDocumentUri, mongodbDocumentUri } from './uri'

/** @public */
export interface GetContentRequest {
  documentId: DocumentURI
  field: string
}

/** @public */
export interface GetContentResponse {
  html: string
}

/** @public */
export interface UpdateContentRequest {
  documentId: DocumentURI
  field: string
  html: string
}

/** @public */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UpdateContentResponse {}

/** @public */
export interface CopyContentRequest {
  documentId: DocumentURI
  sourceField: string
  targetField: string
}

/** @public */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CopyContentResponse {}

/** @public */
export interface BranchDocumentRequest {
  sourceDocumentId: DocumentURI
  targetDocumentId: DocumentURI
}

/** @public */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BranchDocumentResponse {}

/** @public */
export interface RemoveDocumentRequest {
  documentId: DocumentURI
  collaborativeDoc: CollaborativeDoc
}

/** @public */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RemoveDocumentResponse {}

/** @public */
export interface TakeSnapshotRequest {
  documentId: DocumentURI
  collaborativeDoc: CollaborativeDoc
  createdBy: string
  snapshotName: string
}

/** @public */
export interface TakeSnapshotResponse {
  versionId: string
  name: string

  createdBy: string
  createdOn: Timestamp
}

/** @public */
export interface CollaborativeDocSnapshotParams {
  snapshotName: string
  createdBy: Ref<Account>
}

/** @public */
export interface CollaboratorClient {
  // field operations
  getContent: (collaborativeDoc: CollaborativeDoc, field: string) => Promise<Markup>
  updateContent: (collaborativeDoc: CollaborativeDoc, field: string, value: Markup) => Promise<void>
  copyContent: (collaborativeDoc: CollaborativeDoc, sourceField: string, targetField: string) => Promise<void>

  // document operations
  branch: (source: CollaborativeDoc, target: CollaborativeDoc) => Promise<void>
  remove: (collaborativeDoc: CollaborativeDoc) => Promise<void>
  snapshot: (collaborativeDoc: CollaborativeDoc, params: CollaborativeDocSnapshotParams) => Promise<CollaborativeDoc>
}

/** @public */
export function getClient (
  hierarchy: Hierarchy,
  workspaceId: WorkspaceId,
  token: string,
  collaboratorUrl: string
): CollaboratorClient {
  return new CollaboratorClientImpl(hierarchy, workspaceId, token, collaboratorUrl)
}

class CollaboratorClientImpl implements CollaboratorClient {
  constructor (
    private readonly hierarchy: Hierarchy,
    private readonly workspace: WorkspaceId,
    private readonly token: string,
    private readonly collaboratorUrl: string
  ) {}

  initialContentId (workspace: string, classId: Ref<Class<Doc>>, docId: Ref<Doc>, attribute: string): DocumentURI {
    const domain = this.hierarchy.getDomain(classId)
    return mongodbDocumentUri(workspace, domain, docId, attribute)
  }

  private async rpc (method: string, payload: any): Promise<any> {
    const url = concatLink(this.collaboratorUrl, '/rpc')

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ method, payload })
    })

    const result = await res.json()

    if (result.error != null) {
      throw new Error(result.error)
    }

    return result
  }

  async getContent (collaborativeDoc: CollaborativeDoc, field: string): Promise<Markup> {
    const workspace = this.workspace.name
    const documentId = collaborativeDocumentUri(workspace, collaborativeDoc)

    const payload: GetContentRequest = { documentId, field }
    const res = (await this.rpc('getContent', payload)) as GetContentResponse

    return res.html ?? ''
  }

  async updateContent (collaborativeDoc: CollaborativeDoc, field: string, value: Markup): Promise<void> {
    const workspace = this.workspace.name
    const documentId = collaborativeDocumentUri(workspace, collaborativeDoc)

    const payload: UpdateContentRequest = { documentId, field, html: value }
    await this.rpc('updateContent', payload)
  }

  async copyContent (collaborativeDoc: CollaborativeDoc, sourceField: string, targetField: string): Promise<void> {
    const workspace = this.workspace.name
    const documentId = collaborativeDocumentUri(workspace, collaborativeDoc)

    const payload: CopyContentRequest = { documentId, sourceField, targetField }
    await this.rpc('copyContent', payload)
  }

  async branch (source: CollaborativeDoc, target: CollaborativeDoc): Promise<void> {
    const workspace = this.workspace.name
    const sourceDocumentId = collaborativeDocumentUri(workspace, source)
    const targetDocumentId = collaborativeDocumentUri(workspace, target)

    const payload: BranchDocumentRequest = { sourceDocumentId, targetDocumentId }
    await this.rpc('branchDocument', payload)
  }

  async remove (collaborativeDoc: CollaborativeDoc): Promise<void> {
    const workspace = this.workspace.name
    const documentId = collaborativeDocumentUri(workspace, collaborativeDoc)

    const payload: RemoveDocumentRequest = { documentId, collaborativeDoc }
    await this.rpc('removeDocument', payload)
  }

  async snapshot (
    collaborativeDoc: CollaborativeDoc,
    params: CollaborativeDocSnapshotParams
  ): Promise<CollaborativeDoc> {
    const workspace = this.workspace.name
    const documentId = collaborativeDocumentUri(workspace, collaborativeDoc)

    const payload: TakeSnapshotRequest = { documentId, collaborativeDoc, ...params }
    const res = (await this.rpc('takeSnapshot', payload)) as TakeSnapshotResponse

    return toCollaborativeDocVersion(collaborativeDoc, res.versionId)
  }
}
