//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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

import type { Ref, Space } from '@anticrm/core'
import { mergeIds } from '@anticrm/platform'
import { TagCategory } from '@anticrm/tags'
import { KanbanTemplate, taskId } from '@anticrm/task'
import task from '@anticrm/task-resources/src/plugin'
import type { AnyComponent } from '@anticrm/ui'
import type { Action, ActionCategory, ViewAction, Viewlet } from '@anticrm/view'

export default mergeIds(taskId, task, {
  action: {
    EditStatuses: '' as Ref<Action>,
    ArchiveSpace: '' as Ref<Action>,
    UnarchiveSpace: '' as Ref<Action>,
    ArchiveState: '' as Ref<Action>,
    Move: '' as Ref<Action>
  },
  actionImpl: {
    EditStatuses: '' as ViewAction,
    TodoItemMarkDone: '' as ViewAction,
    TodoItemMarkUnDone: '' as ViewAction,
    ArchiveSpace: '' as ViewAction,
    UnarchiveSpace: '' as ViewAction
  },
  category: {
    Task: '' as Ref<ActionCategory>,
    TaskTag: '' as Ref<TagCategory>
  },
  component: {
    ProjectView: '' as AnyComponent,
    CreateProject: '' as AnyComponent,
    EditIssue: '' as AnyComponent,
    TaskPresenter: '' as AnyComponent,
    KanbanCard: '' as AnyComponent,
    TemplatesIcon: '' as AnyComponent,
    StatePresenter: '' as AnyComponent,
    DoneStatePresenter: '' as AnyComponent,
    StateEditor: '' as AnyComponent,
    DoneStateEditor: '' as AnyComponent,
    KanbanView: '' as AnyComponent,
    Todos: '' as AnyComponent,
    TodoItemPresenter: '' as AnyComponent,
    StatusTableView: '' as AnyComponent,
    TaskHeader: '' as AnyComponent,
    Dashboard: '' as AnyComponent
  },
  space: {
    TasksPublic: '' as Ref<Space>
  },
  template: {
    DefaultProject: '' as Ref<KanbanTemplate>
  },
  viewlet: {
    TableIssue: '' as Ref<Viewlet>
  }
})
