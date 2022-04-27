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

import { Doc, Ref, Space, TxOperations } from '@anticrm/core'
import { MigrateOperation, MigrationClient, MigrationUpgradeClient } from '@anticrm/model'
import core from '@anticrm/model-core'
import { createKanbanTemplate, createSequence, DOMAIN_TASK } from '@anticrm/model-task'
import task, { createKanban, KanbanTemplate } from '@anticrm/task'
import board from './plugin'

async function createSpace (tx: TxOperations): Promise<void> {
  const current = await tx.findOne(core.class.Space, {
    _id: board.space.DefaultBoard
  })
  if (current === undefined) {
    await tx.createDoc(
      board.class.Board,
      core.space.Space,
      {
        name: 'Default',
        description: 'Default board',
        private: false,
        archived: false,
        members: []
      },
      board.space.DefaultBoard
    )
  }
}

async function createDefaultKanbanTemplate (tx: TxOperations): Promise<Ref<KanbanTemplate>> {
  const defaultKanban = {
    states: [
      { color: 9, title: 'To do' },
      { color: 9, title: 'Done' }
    ],
    doneStates: [
      { isWon: true, title: 'Won' },
      { isWon: false, title: 'Lost' }
    ]
  }

  return await createKanbanTemplate(tx, {
    kanbanId: board.template.DefaultBoard,
    space: board.space.BoardTemplates as Ref<Doc> as Ref<Space>,
    title: 'Default board',
    states: defaultKanban.states,
    doneStates: defaultKanban.doneStates
  })
}

async function createDefaultKanban (tx: TxOperations): Promise<void> {
  const current = await tx.findOne(task.class.Kanban, {
    attachedTo: board.space.DefaultBoard
  })
  if (current !== undefined) return
  const defaultTmpl = await createDefaultKanbanTemplate(tx)
  await createKanban(tx, board.space.DefaultBoard, defaultTmpl)
}

async function createDefaults (tx: TxOperations): Promise<void> {
  await createSpace(tx)
  await createSequence(tx, board.class.Card)
  await createDefaultKanban(tx)
}

async function migrateLabels (client: MigrationClient): Promise<void> {
  const cards = await client.find(DOMAIN_TASK, { _class: board.class.Card, labels: { $exists: false, $in: [null] } })
  for (const card of cards) {
    await client.update(
      DOMAIN_TASK,
      {
        _id: card._id
      },
      {
        labels: []
      }
    )
  }
}

async function migrateChecklists (client: MigrationClient): Promise<void> {
  const cards = await client.find(DOMAIN_TASK, { _class: board.class.Card, checklists: { $exists: false, $in: [null] } })
  for (const card of cards) {
    await client.update(
      DOMAIN_TASK,
      {
        _id: card._id
      },
      {
        checklists: []
      }
    )
  }
}

export const boardOperation: MigrateOperation = {
  async migrate (client: MigrationClient): Promise<void> {
    await Promise.all([migrateLabels(client), migrateChecklists(client)])
  },
  async upgrade (client: MigrationUpgradeClient): Promise<void> {
    const ops = new TxOperations(client, core.account.System)
    await createDefaults(ops)
  }
}
