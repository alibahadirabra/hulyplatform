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

import { type Doc, type Domain, type MeasureContext, type Ref, type StorageIterator } from '@hcengineering/core'
import { PlatformError, unknownStatus } from '@hcengineering/platform'
import type { Middleware, PipelineContext } from '@hcengineering/server-core'
import { BaseMiddleware } from '@hcengineering/server-core'

/**
 * Will perform a find inside adapters
 * @public
 */
export class LowLevelMiddleware extends BaseMiddleware implements Middleware {
  static async create (
    ctx: MeasureContext,
    context: PipelineContext,
    next: Middleware | undefined
  ): Promise<Middleware | undefined> {
    if (context.adapterManager == null) {
      throw new PlatformError(unknownStatus('No AdapterManager'))
    }
    const adapterManager = context.adapterManager
    context.lowLevelStorage = {
      find (ctx: MeasureContext, domain: Domain, recheck?: boolean): StorageIterator {
        return adapterManager.getAdapter(domain, false).find(ctx, domain, recheck)
      },

      async load (ctx: MeasureContext, domain: Domain, docs: Ref<Doc>[]): Promise<Doc[]> {
        return await adapterManager.getAdapter(domain, false).load(ctx, domain, docs)
      },

      async upload (ctx: MeasureContext, domain: Domain, docs: Doc[]): Promise<void> {
        await adapterManager.getAdapter(domain, true).upload(ctx, domain, docs)
      },

      async clean (ctx: MeasureContext, domain: Domain, docs: Ref<Doc>[]): Promise<void> {
        await adapterManager.getAdapter(domain, true).clean(ctx, domain, docs)
      },
      async groupBy (ctx, domain, field) {
        return await adapterManager.getAdapter(domain, false).groupBy(ctx, domain, field)
      }
    }
    return undefined
  }
}
