//
// Copyright © 2022 Hardcore Engineering Inc.
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

import { type Ref, TxOperations } from '@hcengineering/core'
import {
  type MigrateOperation,
  type MigrationClient,
  type MigrationUpgradeClient,
  createOrUpdate
} from '@hcengineering/model'
import core from '@hcengineering/model-core'
import { createProjectType, createSequence } from '@hcengineering/model-task'
import tags from '@hcengineering/tags'
import task, { type ProjectType } from '@hcengineering/task'
import board from './plugin'
import { PaletteColorIndexes } from '@hcengineering/ui/src/colors'

async function createSpace (tx: TxOperations): Promise<void> {
  const current = await tx.findOne(core.class.Space, {
    _id: board.space.DefaultBoard
  })
  if (current === undefined) {
    const defaultType = await createDefaultProjectType(tx)
    await tx.createDoc(
      board.class.Board,
      core.space.Space,
      {
        name: 'Default',
        description: 'Default board',
        private: false,
        archived: false,
        members: [],
        type: defaultType
      },
      board.space.DefaultBoard
    )
  }
}

async function createDefaultProjectType (tx: TxOperations): Promise<Ref<ProjectType>> {
  return await createProjectType(
    tx,
    {
      name: 'Default board',
      category: board.category.BoardType,
      description: ''
    },
    [
      {
        color: PaletteColorIndexes.Blueberry,
        name: 'To do',
        category: task.statusCategory.Active,
        ofAttribute: board.attribute.State
      },
      {
        color: PaletteColorIndexes.Arctic,
        name: 'Done',
        category: task.statusCategory.Active,
        ofAttribute: board.attribute.State
      },
      {
        color: PaletteColorIndexes.Grass,
        name: 'Completed',
        category: board.statusCategory.Completed,
        ofAttribute: board.attribute.State
      }
    ],
    board.template.DefaultBoard
  )
}

async function createDefaults (tx: TxOperations): Promise<void> {
  await createSpace(tx)
  await createSequence(tx, board.class.Card)
  await createOrUpdate(
    tx,
    tags.class.TagCategory,
    tags.space.Tags,
    {
      icon: tags.icon.Tags,
      label: 'Other',
      targetClass: board.class.Card,
      tags: [],
      default: true
    },
    board.category.Other
  )
}

export const boardOperation: MigrateOperation = {
  async migrate (client: MigrationClient): Promise<void> {},
  async upgrade (client: MigrationUpgradeClient): Promise<void> {
    const ops = new TxOperations(client, core.account.System)
    await createDefaults(ops)
  }
}
