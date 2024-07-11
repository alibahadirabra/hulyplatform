//
// Copyright © 2022-2024 Hardcore Engineering Inc.
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

import core, { TxOperations } from '@hcengineering/core'
import {
  type MigrateOperation,
  type MigrationClient,
  type MigrationUpgradeClient,
  tryUpgrade
} from '@hcengineering/model'

import drive, { driveId } from './index'

async function migrateFileVersions (client: MigrationUpgradeClient): Promise<void> {
  const tx = new TxOperations(client, core.account.System)

  const version = 1

  const files = await client.findAll(drive.class.File, { version: { $exists: false } })

  for (const file of files) {
    await tx.update(file, { version })
    await tx.addCollection(
      drive.class.FileVersion,
      file.space,
      file._id,
      drive.class.File,
      'versions',
      {
        version,
        file: file.file,
        metadata: file.metadata
      }
    )
  }
}

export const driveOperation: MigrateOperation = {
  async migrate (client: MigrationClient): Promise<void> {},

  async upgrade (state: Map<string, Set<string>>, client: () => Promise<MigrationUpgradeClient>): Promise<void> {
    await tryUpgrade(state, client, driveId, [
      {
        state: 'file-versions',
        func: migrateFileVersions
      }
    ])
  }
}
