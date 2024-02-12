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

import type { Person } from '@hcengineering/contact'
import contact from '@hcengineering/contact'
import {
  ClassifierKind,
  DOMAIN_MODEL,
  DOMAIN_STATUS,
  DOMAIN_TX,
  IndexKind,
  generateId,
  type Class,
  type Data,
  type Doc,
  type Domain,
  type Ref,
  type Status,
  type StatusCategory,
  type Timestamp,
  type TxCreateDoc,
  type TxMixin
} from '@hcengineering/core'
import {
  ArrOf,
  Collection,
  Hidden,
  Index,
  Mixin,
  Model,
  Prop,
  ReadOnly,
  TypeBoolean,
  TypeDate,
  TypeRecord,
  TypeRef,
  TypeString,
  UX,
  type Builder,
  type MigrationClient
} from '@hcengineering/model'
import attachment from '@hcengineering/model-attachment'
import chunter from '@hcengineering/model-chunter'
import core, { DOMAIN_SPACE, TAttachedDoc, TClass, TDoc, TSpace } from '@hcengineering/model-core'
import view, {
  classPresenter,
  createAction,
  template,
  actionTemplates as viewTemplates
} from '@hcengineering/model-view'
import { getEmbeddedLabel, type Asset, type IntlString, type Resource } from '@hcengineering/platform'
import setting from '@hcengineering/setting'
import tags from '@hcengineering/tags'
import {
  calculateStatuses,
  findStatusAttr,
  type KanbanCard,
  type Project,
  type ProjectStatus,
  type ProjectType,
  type ProjectTypeClass,
  type ProjectTypeDescriptor,
  type Sequence,
  type Task,
  type TaskStatusFactory,
  type TaskType,
  type TaskTypeClass,
  type TaskTypeDescriptor,
  type TaskTypeKind
} from '@hcengineering/task'
import type { AnyComponent } from '@hcengineering/ui'
import { PaletteColorIndexes } from '@hcengineering/ui/src/colors'
import { type ViewAction } from '@hcengineering/view'

import task from './plugin'

export { createProjectType, taskId } from '@hcengineering/task'
export { createSequence, taskOperation } from './migration'
export { default } from './plugin'

export const DOMAIN_TASK = 'task' as Domain
export const DOMAIN_KANBAN = 'kanban' as Domain

/**
 * @public
 */
@Model(task.class.Task, core.class.AttachedDoc, DOMAIN_TASK)
@UX(task.string.Task, task.icon.Task, task.string.Task)
export class TTask extends TAttachedDoc implements Task {
  @Prop(TypeRef(core.class.Status), task.string.TaskState, { _id: task.attribute.State })
  @Index(IndexKind.Indexed)
    status!: Ref<Status>

  @Prop(TypeRef(task.class.TaskType), task.string.TaskType)
  @Index(IndexKind.Indexed)
  @ReadOnly()
    kind!: Ref<TaskType>

  @Prop(TypeString(), task.string.TaskNumber)
  @Index(IndexKind.FullText)
  @Hidden()
    number!: number

  @Prop(TypeRef(contact.mixin.Employee), task.string.TaskAssignee)
    assignee!: Ref<Person> | null

  @Prop(TypeDate(), task.string.DueDate, { editor: task.component.DueDateEditor })
    dueDate!: Timestamp | null

  @Prop(TypeString(), task.string.Rank)
  @Index(IndexKind.IndexedDsc)
  @Hidden()
    rank!: string

  @Prop(Collection(tags.class.TagReference, task.string.TaskLabels), task.string.TaskLabels)
    labels?: number

  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments?: number

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, { shortLabel: attachment.string.Files })
    attachments?: number

  @Prop(TypeBoolean(), getEmbeddedLabel('isDone'))
  @Hidden()
    isDone?: boolean

  @Prop(TypeString(), task.string.Identifier)
  @ReadOnly()
  @Index(IndexKind.Indexed)
    identifier!: string
}

@Mixin(task.mixin.KanbanCard, core.class.Class)
export class TKanbanCard extends TClass implements KanbanCard {
  card!: AnyComponent
}

@Model(task.class.TaskTypeDescriptor, core.class.Doc, DOMAIN_MODEL)
export class TTaskTypeDescriptor extends TDoc implements TaskTypeDescriptor {
  name!: IntlString
  description!: IntlString
  icon!: Asset
  baseClass!: Ref<Class<Task>>

  // If specified, will allow to be created by users, system type overwize
  allowCreate!: boolean
  statusCategoriesFunc?: Resource<(project: ProjectType) => Ref<StatusCategory>[]>
}

@Mixin(task.mixin.TaskTypeClass, core.class.Class)
export class TTaskTypeClass extends TClass implements TaskTypeClass {
  taskType!: Ref<TaskType>
  projectType!: Ref<ProjectType>
}

@Mixin(task.mixin.ProjectTypeClass, core.class.Class)
export class TProjectTypeClass extends TClass implements ProjectTypeClass {
  projectType!: Ref<ProjectType>
}

@Model(task.class.Project, core.class.Space)
export class TProject extends TSpace implements Project {
  @Prop(TypeRef(task.class.ProjectType), task.string.ProjectType)
    type!: Ref<ProjectType>
}

@Model(task.class.ProjectType, core.class.Space)
export class TProjectType extends TSpace implements ProjectType {
  shortDescription?: string

  @Prop(TypeRef(task.class.ProjectTypeDescriptor), getEmbeddedLabel('Descriptor'))
    descriptor!: Ref<ProjectTypeDescriptor>

  @Prop(ArrOf(TypeRef(task.class.TaskType)), getEmbeddedLabel('Tasks'))
    tasks!: Ref<TaskType>[]

  @Prop(ArrOf(TypeRecord()), getEmbeddedLabel('Project statuses'))
    statuses!: ProjectStatus[]

  @Prop(TypeRef(core.class.Class), getEmbeddedLabel('Target Class'))
    targetClass!: Ref<Class<Project>>

  @Prop(TypeBoolean(), getEmbeddedLabel('Classic'))
    classic!: boolean
}

@Model(task.class.TaskType, core.class.Doc, DOMAIN_TASK)
export class TTaskType extends TDoc implements TaskType {
  @Prop(TypeString(), getEmbeddedLabel('Name'))
    name!: string

  @Prop(TypeRef(task.class.TaskTypeDescriptor), getEmbeddedLabel('Descriptor'))
    descriptor!: Ref<TaskTypeDescriptor>

  @Prop(TypeRef(task.class.ProjectType), getEmbeddedLabel('Task class'))
    parent!: Ref<ProjectType> // Base class for task

  @Prop(TypeString(), getEmbeddedLabel('Kind'))
    kind!: TaskTypeKind

  @Prop(ArrOf(TypeRef(task.class.TaskType)), getEmbeddedLabel('Parent'))
    allowedAsChildOf!: Ref<TaskType>[] // In case of specified, task type is for sub-tasks

  @Prop(TypeRef(core.class.Class), getEmbeddedLabel('Task class'))
    ofClass!: Ref<Class<Task>> // Base class for task

  @Prop(TypeRef(core.class.Class), getEmbeddedLabel('Task target class'))
    targetClass!: Ref<Class<Task>> // Class or Mixin mixin to hold all user defined attributes.

  @Prop(ArrOf(TypeRef(core.class.Status)), getEmbeddedLabel('Task statuses'))
    statuses!: Ref<Status>[]

  @Prop(TypeRef(core.class.Class), getEmbeddedLabel('Task status class'))
    statusClass!: Ref<Class<Status>>

  @Prop(TypeRef(core.class.StatusCategory), getEmbeddedLabel('Task status categories'))
    statusCategories!: Ref<StatusCategory>[]
}

@Model(task.class.ProjectTypeDescriptor, core.class.Doc, DOMAIN_MODEL)
export class TProjectTypeDescriptor extends TDoc implements ProjectTypeDescriptor {
  name!: IntlString
  description!: IntlString
  icon!: Asset
  editor?: AnyComponent
  allowedClassic?: boolean
  allowedTaskTypeDescriptors?: Ref<TaskTypeDescriptor>[] // if undefined we allow all possible
  baseClass!: Ref<Class<Task>>
}

@Model(task.class.Sequence, core.class.Doc, DOMAIN_KANBAN)
export class TSequence extends TDoc implements Sequence {
  attachedTo!: Ref<Class<Doc>>
  sequence!: number
}

/**
 * @public
 */
export const actionTemplates = template({
  editStatus: {
    label: task.string.EditStates,
    icon: view.icon.Statuses,
    action: task.actionImpl.EditStatuses,
    input: 'focus',
    category: task.category.Task
  },
  archiveSpace: {
    label: task.string.Archive,
    icon: view.icon.Archive,
    action: view.actionImpl.UpdateDocument as ViewAction,
    actionProps: {
      key: 'archived',
      value: true,
      ask: true,
      label: task.string.Archive,
      message: task.string.ArchiveConfirm
    },
    input: 'any',
    category: task.category.Task,
    query: {
      archived: false
    },
    context: {
      mode: ['context', 'browser'],
      group: 'tools'
    },
    override: [view.action.Archive, view.action.Delete]
  },
  unarchiveSpace: {
    label: task.string.Unarchive,
    icon: view.icon.Archive,
    action: view.actionImpl.UpdateDocument as ViewAction,
    actionProps: {
      key: 'archived',
      ask: true,
      value: false,
      label: task.string.Unarchive,
      message: task.string.UnarchiveConfirm
    },
    input: 'any',
    category: task.category.Task,
    query: {
      archived: true
    },
    context: {
      mode: ['context', 'browser'],
      group: 'tools'
    }
  }
})

export function createModel (builder: Builder): void {
  builder.createModel(
    TKanbanCard,
    TSequence,
    TTask,
    TProject,
    TProjectType,
    TTaskType,
    TProjectTypeDescriptor,
    TTaskTypeDescriptor,
    TTaskTypeClass,
    TProjectTypeClass
  )

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: task.string.States,
      icon: task.icon.ManageTemplates,
      component: task.component.StatusTableView
    },
    task.viewlet.StatusTable
  )

  builder.mixin(task.class.Task, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: view.component.ObjectPresenter
  })

  builder.mixin(task.class.ProjectType, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: task.component.KanbanTemplatePresenter
  })

  builder.mixin(task.class.Task, core.class.Class, view.mixin.ObjectEditorHeader, {
    editor: task.component.TaskHeader
  })

  builder.mixin(task.class.ProjectType, core.class.Class, view.mixin.IgnoreActions, {
    actions: [view.action.Open]
  })

  builder.createDoc(
    view.class.ActionCategory,
    core.space.Model,
    { label: task.string.Task, visible: true },
    task.category.Task
  )

  createAction(
    builder,
    {
      ...actionTemplates.editStatus,
      target: task.class.Project,
      query: {
        archived: false
      },
      context: {
        mode: ['context', 'browser'],
        group: 'edit'
      }
    },
    task.action.EditStatuses
  )

  builder.mixin(core.class.Status, core.class.Class, view.mixin.AttributeEditor, {
    inlineEditor: task.component.StateEditor
  })

  builder.mixin(core.class.Status, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: task.component.StatePresenter
  })

  builder.mixin(core.class.Status, core.class.Class, view.mixin.AttributePresenter, {
    presenter: task.component.StateRefPresenter
  })

  builder.mixin(core.class.Status, core.class.Class, view.mixin.IgnoreActions, {
    actions: [view.action.Delete]
  })

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: task.string.Kanban,
      icon: task.icon.Kanban,
      component: task.component.KanbanView
    },
    task.viewlet.Kanban
  )

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: task.string.Dashboard,
      icon: task.icon.Dashboard,
      component: task.component.Dashboard
    },
    task.viewlet.Dashboard
  )

  builder.mixin(task.class.TaskType, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: task.component.TaskTypePresenter
  })

  builder.mixin(task.class.ProjectType, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: task.component.ProjectTypePresenter
  })

  classPresenter(builder, task.class.TaskType, task.component.TaskTypePresenter, task.component.TaskTypePresenter)

  createAction(
    builder,
    {
      ...viewTemplates.move,
      target: task.class.Task,
      context: {
        mode: ['context', 'browser'],
        group: 'tools'
      }
    },
    task.action.Move
  )

  builder.createDoc(
    core.class.StatusCategory,
    core.space.Model,
    {
      ofAttribute: task.attribute.State,
      label: task.string.StateBacklog,
      icon: task.icon.TaskState,
      color: PaletteColorIndexes.Cloud,
      defaultStatusName: 'Backlog',
      order: 0
    },
    task.statusCategory.UnStarted
  )

  builder.createDoc(
    core.class.StatusCategory,
    core.space.Model,
    {
      ofAttribute: task.attribute.State,
      label: task.string.StateUnstarted,
      icon: task.icon.TaskState,
      color: PaletteColorIndexes.Porpoise,
      defaultStatusName: 'Todo',
      order: 1
    },
    task.statusCategory.ToDo
  )

  builder.createDoc(
    core.class.StatusCategory,
    core.space.Model,
    {
      ofAttribute: task.attribute.State,
      label: task.string.StateActive,
      icon: task.icon.TaskState,
      color: PaletteColorIndexes.Cerulean,
      defaultStatusName: 'New state',
      order: 2
    },
    task.statusCategory.Active
  )

  builder.createDoc(
    core.class.StatusCategory,
    core.space.Model,
    {
      ofAttribute: task.attribute.State,
      label: task.string.DoneStatesWon,
      icon: task.icon.TaskState,
      color: PaletteColorIndexes.Grass,
      defaultStatusName: 'Won',
      order: 3
    },
    task.statusCategory.Won
  )

  builder.createDoc(
    core.class.StatusCategory,
    core.space.Model,
    {
      ofAttribute: task.attribute.State,
      label: task.string.DoneStatesLost,
      icon: task.icon.TaskState,
      color: PaletteColorIndexes.Coin,
      defaultStatusName: 'Lost',
      order: 4
    },
    task.statusCategory.Lost
  )

  builder.mixin(core.class.Status, core.class.Class, view.mixin.SortFuncs, {
    func: task.function.StatusSort
  })

  builder.mixin(core.class.Status, core.class.Class, view.mixin.AttributeFilter, {
    component: task.component.StatusFilter
  })

  builder.mixin(core.class.Status, core.class.Class, view.mixin.AllValuesFunc, {
    func: task.function.GetAllStates
  })

  // builder.createDoc(
  //   notification.class.NotificationType,
  //   core.space.Model,
  //   {
  //     label: task.string.Assigned,
  //     hidden: false,
  //     textTemplate: '{doc} was assigned to you by {sender}',
  //     htmlTemplate: '<p>{doc} was assigned to you by {sender}</p>',
  //     subjectTemplate: '{doc} was assigned to you'
  //   },
  //   task.ids.AssigneedNotification
  // )

  builder.mixin(task.mixin.TaskTypeClass, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: task.component.TaskTypeClassPresenter
  })
  builder.mixin(task.mixin.ProjectTypeClass, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: task.component.ProjectTypeClassPresenter
  })

  builder.mixin(task.class.Task, core.class.Class, setting.mixin.Editable, {
    value: true
  })

  builder.mixin(task.class.Project, core.class.Class, setting.mixin.Editable, {
    value: true
  })

  builder.createDoc(
    setting.class.SettingsCategory,
    core.space.Model,
    {
      name: 'statuses',
      label: task.string.ManageProjects,
      icon: task.icon.ManageTemplates,
      component: task.component.ManageProjectsContent,
      extraComponents: {
        navigation: task.component.ManageProjects,
        tools: task.component.ManageProjectsTools
      },
      group: 'settings-editor',
      secured: false,
      order: 6000,
      expandable: true
    },
    task.ids.ManageProjects
  )
}

/**
 * @public
 */
export type FixTaskData = Omit<Data<TaskType>, 'space' | 'statuses' | 'statusCategories' | 'parent'> & {
  _id?: TaskType['_id']
  statusCategories: TaskType['statusCategories'] | TaskStatusFactory[]
}
export interface FixTaskResult {
  taskTypes: TaskType[]
  projectTypes: ProjectType[]
  projects: Project[]
}
/**
 * @public
 */
export async function fixTaskTypes (
  client: MigrationClient,
  descriptor: Ref<ProjectTypeDescriptor>,
  dataFactory: (t: ProjectType) => Promise<FixTaskData[]>,
  migrateTasks?: (projects: Project[], taskType: TaskType) => Promise<void>
): Promise<FixTaskResult> {
  const categoryObj = client.model.findObject(descriptor)
  if (categoryObj === undefined) {
    throw new Error('category is not found in model')
  }

  const projectTypes = await client.find<ProjectType>(DOMAIN_SPACE, {
    _class: task.class.ProjectType,
    descriptor
  })
  const baseClassClass = client.hierarchy.getClass(categoryObj.baseClass)

  const resultTaskTypes: TaskType[] = []
  const resultProjects: Project[] = []

  for (const t of projectTypes) {
    t.tasks = [...(t.tasks ?? [])]
    if (t.targetClass === undefined) {
      const targetProjectClassId: Ref<Class<Doc>> = generateId()
      t.targetClass = targetProjectClassId

      await client.create<TxCreateDoc<Doc>>(DOMAIN_TX, {
        _id: generateId(),
        objectId: targetProjectClassId,
        _class: core.class.TxCreateDoc,
        objectClass: core.class.Class,
        objectSpace: core.space.Model,
        modifiedBy: core.account.ConfigUser,
        modifiedOn: Date.now(),
        space: core.space.Model,
        attributes: {
          extends: categoryObj.baseClass,
          kind: ClassifierKind.MIXIN,
          label: baseClassClass.label,
          icon: baseClassClass.icon
        }
      })

      await client.create<TxMixin<Class<ProjectType>, ProjectTypeClass>>(DOMAIN_TX, {
        _class: core.class.TxMixin,
        _id: generateId(),
        space: core.space.Model,
        modifiedBy: core.account.ConfigUser,
        modifiedOn: Date.now(),
        objectId: targetProjectClassId,
        objectClass: core.class.Class,
        objectSpace: core.space.Model,
        mixin: task.mixin.ProjectTypeClass,
        attributes: {
          projectType: t._id
        }
      })
      await client.update(
        DOMAIN_SPACE,
        {
          _id: t._id
        },
        { $set: { targetClass: targetProjectClassId } }
      )
    }

    const newTaskTypes = await dataFactory(t)

    const projects = await client.find<Project>(DOMAIN_SPACE, { type: t._id })
    resultProjects.push(...projects)

    for (const data of newTaskTypes) {
      // Check and skip if already had task type for same class
      const tt = await client.find<TaskType>(DOMAIN_TASK, {
        _class: task.class.TaskType,
        ofClass: data.ofClass,
        parent: t._id
      })
      if (tt.length > 0) {
        continue
      }

      const taskTypeId: Ref<TaskType> = data._id ?? generateId()
      const descr = client.model.getObject(data.descriptor)

      const statuses = await client.find<Status>(DOMAIN_STATUS, {
        _id: { $in: t.statuses.map((it) => it._id) },
        _class: data.statusClass
      })

      const dStatuses: Ref<Status>[] = []
      const statusAttr = findStatusAttr(client.hierarchy, data.ofClass)
      // Ensure we have at leas't one item in every category.
      for (const c of data.statusCategories) {
        const category = typeof c === 'string' ? c : c.category
        const cat = await client.model.findOne(core.class.StatusCategory, { _id: category })

        const st = statuses.filter((it) => it.category === category)
        const newStatuses: Ref<Status>[] = []
        if (st.length === 0 || typeof c === 'object') {
          if (typeof c === 'string') {
            // We need to add new status into missing category
            const statusId: Ref<Status> = generateId()
            await client.create<Status>(DOMAIN_STATUS, {
              _id: statusId,
              _class: data.statusClass,
              category,
              modifiedBy: core.account.ConfigUser,
              modifiedOn: Date.now(),
              name: cat?.defaultStatusName ?? 'New state',
              space: task.space.Statuses,
              ofAttribute: statusAttr._id
            })
            newStatuses.push(statusId)
            dStatuses.push(statusId)

            await client.update(
              DOMAIN_SPACE,
              {
                _id: t._id
              },
              { $push: { statuses: newStatuses.map((it) => ({ _id: it })) } }
            )
            t.statuses.push(...newStatuses.map((it) => ({ _id: it, taskType: taskTypeId })))
          } else {
            for (const sts of c.statuses) {
              const stsName = Array.isArray(sts) ? sts[0] : sts
              const color = Array.isArray(sts) ? sts[1] : undefined
              const st = statuses.find((it) => it.name.toLowerCase() === stsName.toLowerCase())
              if (st === undefined) {
                // We need to add new status into missing category
                const statusId: Ref<Status> = generateId()
                await client.create<Status>(DOMAIN_STATUS, {
                  _id: statusId,
                  _class: data.statusClass,
                  category,
                  modifiedBy: core.account.ConfigUser,
                  modifiedOn: Date.now(),
                  name: stsName,
                  color,
                  space: task.space.Statuses,
                  ofAttribute: statusAttr._id
                })
                newStatuses.push(statusId)
                dStatuses.push(statusId)
              } else {
                dStatuses.push(st._id)
              }

              await client.update(
                DOMAIN_SPACE,
                {
                  _id: t._id
                },
                { $push: { statuses: newStatuses.map((it) => ({ _id: it })) } }
              )
              t.statuses.push(...newStatuses.map((it) => ({ _id: it, taskType: taskTypeId })))
            }
          }
        } else {
          for (const sss of st.map((it) => it._id)) {
            if (!dStatuses.includes(sss)) {
              dStatuses.push(sss)
            }
          }
        }
      }
      const taskType: TaskType = {
        ...data,
        statusCategories: data.statusCategories.map((it) => (typeof it === 'string' ? it : it.category)),
        parent: t._id,
        _id: taskTypeId,
        _class: task.class.TaskType,
        space: t._id,
        statuses: dStatuses,
        modifiedBy: core.account.System,
        modifiedOn: Date.now(),
        kind: 'both',
        icon: data.icon ?? descr.icon
      }

      const ofClassClass = client.hierarchy.getClass(data.ofClass)

      taskType.icon = ofClassClass.icon

      // Create target class for custom field.
      const targetClassId: Ref<Class<Doc>> = generateId()
      taskType.targetClass = targetClassId

      await client.create<TxCreateDoc<Doc>>(DOMAIN_TX, {
        _id: generateId(),
        objectId: targetClassId,
        _class: core.class.TxCreateDoc,
        objectClass: core.class.Class,
        objectSpace: core.space.Model,
        modifiedBy: core.account.ConfigUser,
        modifiedOn: Date.now(),
        space: core.space.Model,
        attributes: {
          extends: data.ofClass,
          kind: ClassifierKind.MIXIN,
          label: getEmbeddedLabel(data.name),
          icon: ofClassClass.icon
        }
      })

      await client.create<TxMixin<Class<TaskType>, TaskTypeClass>>(DOMAIN_TX, {
        _class: core.class.TxMixin,
        _id: generateId(),
        space: core.space.Model,
        modifiedBy: core.account.ConfigUser,
        modifiedOn: Date.now(),
        objectId: targetClassId,
        objectClass: core.class.Class,
        objectSpace: core.space.Model,
        mixin: task.mixin.TaskTypeClass,
        attributes: {
          taskType: taskTypeId,
          projectType: t._id
        }
      })

      await client.create(DOMAIN_TASK, taskType)
      resultTaskTypes.push(taskType)

      await client.update(
        DOMAIN_SPACE,
        {
          _id: t._id
        },
        { $push: { tasks: taskTypeId } }
      )
      t.tasks.push(taskTypeId)
      // Update kind and target classId
      const projectsToUpdate = projects.filter((it) => it.type === t._id)
      await client.update(
        DOMAIN_TASK,
        { space: { $in: projectsToUpdate.map((it) => it._id) }, _class: data.ofClass },
        { $set: { kind: taskTypeId } }
      )
      await migrateTasks?.(projectsToUpdate, taskType)
    }

    // We need to fix project statuses field, for proper icon calculation.
  }
  for (const t of projectTypes) {
    const ttypes = await client.find<TaskType>(DOMAIN_TASK, { _id: { $in: t.tasks } })
    const newStatuses = calculateStatuses(t, new Map(ttypes.map((it) => [it._id, it])), [])
    await client.update(
      DOMAIN_SPACE,
      { _id: t._id },
      {
        $set: {
          statuses: newStatuses
        }
      }
    )
  }
  return { taskTypes: resultTaskTypes, projectTypes, projects: resultProjects }
}
