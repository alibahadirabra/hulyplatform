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

import { MeasureContext } from '@hcengineering/core'
import { Context } from '../../context'
import { RpcMethodParams } from '../rpc'

export interface GetDocumentContentRequest {
  documentId: string
  initialContentId: string
  field: string
}

export interface GetDocumentContentResponse {
  html: string
}

export async function getDocumentContent (
  ctx: MeasureContext,
  context: Context,
  payload: GetDocumentContentRequest,
  params: RpcMethodParams
): Promise<GetDocumentContentResponse> {
  const { documentId, field } = payload
  const { hocuspocus, transformer } = params

  context = { ...context, initialContentId: payload.initialContentId ?? '' }

  const connection = await ctx.with('connect', {}, async () => {
    return await hocuspocus.openDirectConnection(documentId, context)
  })

  try {
    const html = await ctx.with('transform', {}, async () => {
      let content = ''
      await connection.transact((document) => {
        content = transformer.fromYdoc(document, field)
      })
      return content
    })

    return { html }
  } finally {
    await connection.disconnect()
  }
}
