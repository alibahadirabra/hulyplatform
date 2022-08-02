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

import type { Employee } from '@anticrm/contact'
import contact from '@anticrm/contact'
import { Domain, DOMAIN_MODEL, FindOptions, IndexKind, Markup, Ref, SortingOrder, Timestamp, Type } from '@anticrm/core'
import {
  ArrOf,
  Builder,
  Collection,
  Hidden,
  Index,
  Model,
  Prop,
  TypeDate,
  TypeMarkup,
  TypeNumber,
  TypeRef,
  TypeString,
  UX
} from '@anticrm/model'
import attachment from '@anticrm/model-attachment'
import chunter from '@anticrm/model-chunter'
import core, { DOMAIN_SPACE, TAttachedDoc, TDoc, TSpace, TType } from '@anticrm/model-core'
import view, { createAction } from '@anticrm/model-view'
import workbench, { createNavigateAction } from '@anticrm/model-workbench'
import notification from '@anticrm/notification'
import { Asset, IntlString } from '@anticrm/platform'
import setting from '@anticrm/setting'
import task from '@anticrm/task'
import {
  Document,
  Issue,
  IssueParentInfo,
  IssuePriority,
  IssueStatus,
  IssueStatusCategory,
  Project,
  ProjectStatus,
  Sprint,
  SprintStatus,
  Team,
  trackerId
} from '@anticrm/tracker'
import { KeyBinding } from '@anticrm/view'
import tags from '@anticrm/tags'
import tracker from './plugin'

import presentation from '@anticrm/model-presentation'
import { defaultPriorities, issuePriorities } from '@anticrm/tracker-resources/src/types'

export { trackerOperation } from './migration'
export { default } from './plugin'

export const DOMAIN_TRACKER = 'tracker' as Domain

/**
 * @public
 */
@Model(tracker.class.IssueStatus, core.class.AttachedDoc, DOMAIN_TRACKER)
export class TIssueStatus extends TAttachedDoc implements IssueStatus {
  name!: string
  description?: string
  color?: number

  @Prop(TypeRef(tracker.class.IssueStatusCategory), tracker.string.StatusCategory)
  category!: Ref<IssueStatusCategory>

  @Prop(TypeString(), tracker.string.Rank)
  @Hidden()
  rank!: string
}

/**
 * @public
 */
@Model(tracker.class.IssueStatusCategory, core.class.Doc, DOMAIN_MODEL)
export class TIssueStatusCategory extends TDoc implements IssueStatusCategory {
  label!: IntlString
  icon!: Asset
  color!: number
  defaultStatusName!: string
  order!: number
}

/**
 * @public
 */
export function TypeIssuePriority (): Type<IssuePriority> {
  return { _class: tracker.class.TypeIssuePriority, label: 'TypeIssuePriority' as IntlString }
}

/**
 * @public
 */
@Model(tracker.class.TypeIssuePriority, core.class.Type, DOMAIN_MODEL)
export class TTypeIssuePriority extends TType {}

/**
 * @public
 */
export function TypeProjectStatus (): Type<ProjectStatus> {
  return { _class: tracker.class.TypeProjectStatus, label: 'TypeProjectStatus' as IntlString }
}

/**
 * @public
 */
export function TypeSprintStatus (): Type<SprintStatus> {
  return { _class: tracker.class.TypeSprintStatus, label: 'TypeSprintStatus' as IntlString }
}

/**
 * @public
 */
@Model(tracker.class.TypeProjectStatus, core.class.Type, DOMAIN_MODEL)
export class TTypeProjectStatus extends TType {}

/**
 * @public
 */
@Model(tracker.class.TypeSprintStatus, core.class.Type, DOMAIN_MODEL)
export class TTypeSprintStatus extends TType {}

/**
 * @public
 */
@Model(tracker.class.Team, core.class.Space, DOMAIN_SPACE)
@UX(tracker.string.Team, tracker.icon.Team, tracker.string.Team)
export class TTeam extends TSpace implements Team {
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
  reamLogo!: IntlString

  @Prop(TypeString(), tracker.string.Identifier)
  @Index(IndexKind.FullText)
  identifier!: IntlString

  @Prop(TypeNumber(), tracker.string.Number)
  @Hidden()
  sequence!: number

  @Prop(Collection(tracker.class.IssueStatus), tracker.string.IssueStatuses)
  issueStatuses!: number

  @Prop(TypeRef(tracker.class.IssueStatus), tracker.string.DefaultIssueStatus)
  defaultIssueStatus!: Ref<IssueStatus>
}

/**
 * @public
 */
@Model(tracker.class.Issue, core.class.AttachedDoc, DOMAIN_TRACKER)
@UX(tracker.string.Issue, tracker.icon.Issue, tracker.string.Issue)
export class TIssue extends TAttachedDoc implements Issue {
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
  title!: string

  @Prop(TypeMarkup(), tracker.string.Description)
  @Index(IndexKind.FullText)
  description!: Markup

  @Prop(TypeRef(tracker.class.IssueStatus), tracker.string.Status)
  status!: Ref<IssueStatus>

  @Prop(TypeIssuePriority(), tracker.string.Priority)
  priority!: IssuePriority

  @Prop(TypeNumber(), tracker.string.Number)
  number!: number

  @Prop(TypeRef(contact.class.Employee), tracker.string.Assignee)
  assignee!: Ref<Employee> | null

  @Prop(TypeRef(tracker.class.Project), tracker.string.Project)
  project!: Ref<Project> | null

  @Prop(Collection(tracker.class.Issue), tracker.string.SubIssues)
  subIssues!: number

  @Prop(ArrOf(TypeRef(tracker.class.Issue)), tracker.string.BlockedBy)
  blockedBy!: Ref<Issue>[]

  @Prop(ArrOf(TypeRef(tracker.class.Issue)), tracker.string.RelatedTo)
  relatedIssue!: Ref<Issue>[]

  parents!: IssueParentInfo[]

  @Prop(Collection(chunter.class.Comment), tracker.string.Comments)
  comments!: number

  @Prop(Collection(attachment.class.Attachment), tracker.string.Attachments)
  attachments!: number

  @Prop(Collection(tags.class.TagReference), tracker.string.Labels)
  labels?: number

  declare space: Ref<Team>

  @Prop(TypeDate(true), tracker.string.DueDate)
  dueDate!: Timestamp | null

  @Prop(TypeString(), tracker.string.Rank)
  @Hidden()
  rank!: string

  @Prop(TypeRef(tracker.class.Sprint), tracker.string.Sprint)
  sprint!: Ref<Sprint> | null
}

/**
 * @public
 */
@Model(tracker.class.Document, core.class.Doc, DOMAIN_TRACKER)
@UX(tracker.string.Document, tracker.icon.Document, tracker.string.Document)
export class TDocument extends TDoc implements Document {
  @Prop(TypeString(), tracker.string.Title)
  @Index(IndexKind.FullText)
  title!: string

  @Prop(TypeString(), tracker.string.DocumentIcon)
  icon!: string | null

  @Prop(TypeString(), tracker.string.DocumentColor)
  color!: number

  @Prop(TypeMarkup(), tracker.string.Description)
  @Index(IndexKind.FullText)
  content!: Markup

  declare space: Ref<Team>
}

/**
 * @public
 */
@Model(tracker.class.Project, core.class.Doc, DOMAIN_TRACKER)
@UX(tracker.string.Project, tracker.icon.Project, tracker.string.Project)
export class TProject extends TDoc implements Project {
  @Prop(TypeString(), tracker.string.Title)
  // @Index(IndexKind.FullText)
  label!: string

  @Prop(TypeMarkup(), tracker.string.Description)
  description?: Markup

  @Prop(TypeString(), tracker.string.AssetLabel)
  icon!: Asset

  @Prop(TypeProjectStatus(), tracker.string.Status)
  status!: ProjectStatus

  @Prop(TypeRef(contact.class.Employee), tracker.string.ProjectLead)
  lead!: Ref<Employee> | null

  @Prop(ArrOf(TypeRef(contact.class.Employee)), tracker.string.Members)
  members!: Ref<Employee>[]

  @Prop(Collection(chunter.class.Comment), chunter.string.Comments)
  comments!: number

  @Prop(Collection(tracker.class.Document), tracker.string.Document)
  documents!: number

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, undefined, attachment.string.Files)
  attachments?: number

  @Prop(TypeDate(true), tracker.string.StartDate)
  startDate!: Timestamp | null

  @Prop(TypeDate(true), tracker.string.TargetDate)
  targetDate!: Timestamp | null

  declare space: Ref<Team>
}

/**
 * @public
 */
@Model(tracker.class.Sprint, core.class.Doc, DOMAIN_TRACKER)
@UX(tracker.string.Sprint, tracker.icon.Sprint, tracker.string.Sprint)
export class TSprint extends TDoc implements Sprint {
  @Prop(TypeString(), tracker.string.Title)
  // @Index(IndexKind.FullText)
  label!: string

  @Prop(TypeMarkup(), tracker.string.Description)
  description?: Markup

  @Prop(TypeSprintStatus(), tracker.string.Status)
  status!: SprintStatus

  @Prop(TypeRef(contact.class.Employee), tracker.string.ProjectLead)
  lead!: Ref<Employee> | null

  @Prop(Collection(chunter.class.Comment), chunter.string.Comments)
  comments!: number

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, undefined, attachment.string.Files)
  attachments?: number

  @Prop(TypeDate(false), tracker.string.StartDate)
  startDate!: Timestamp

  @Prop(TypeDate(false), tracker.string.TargetDate)
  targetDate!: Timestamp

  declare space: Ref<Team>
}

export function createModel (builder: Builder): void {
  builder.createModel(
    TTeam,
    TProject,
    TIssue,
    TIssueStatus,
    TIssueStatusCategory,
    TTypeIssuePriority,
    TTypeProjectStatus,
    TSprint,
    TTypeSprintStatus
  )

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: tracker.class.Issue,
    descriptor: tracker.viewlet.List,
    config: [
      { key: '', presenter: tracker.component.PriorityEditor, props: { kind: 'list', size: 'small' } },
      { key: '', presenter: tracker.component.IssuePresenter },
      {
        key: '',
        presenter: tracker.component.StatusEditor,
        props: { kind: 'list', size: 'small', justify: 'center' }
      },
      { key: '', presenter: tracker.component.TitlePresenter, props: { shouldUseMargin: true, fixed: 'left' } },
      { key: '', presenter: tracker.component.DueDatePresenter, props: { kind: 'list' } },
      {
        key: '',
        presenter: tracker.component.ProjectEditor,
        props: { kind: 'list', size: 'small', shape: 'round', shouldShowPlaceholder: false }
      },
      {
        key: '',
        presenter: tracker.component.SprintEditor,
        props: { kind: 'list', size: 'small', shape: 'round', shouldShowPlaceholder: false }
      },
      { key: 'modifiedOn', presenter: tracker.component.ModificationDatePresenter, props: { fixed: 'right' } },
      {
        key: '$lookup.assignee',
        presenter: tracker.component.AssigneePresenter,
        props: { defaultClass: contact.class.Employee, shouldShowLabel: false }
      }
    ]
  })

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: tracker.string.List,
      icon: view.icon.Table,
      component: tracker.component.ListView
    },
    tracker.viewlet.List
  )

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: tracker.class.Issue,
    descriptor: tracker.viewlet.Kanban,
    config: []
  })

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: tracker.string.Board,
      icon: task.icon.Kanban,
      component: tracker.component.KanbanView
    },
    tracker.viewlet.Kanban
  )

  builder.createDoc(
    tracker.class.IssueStatusCategory,
    core.space.Model,
    {
      label: tracker.string.CategoryBacklog,
      icon: tracker.icon.CategoryBacklog,
      color: 12,
      defaultStatusName: 'Backlog',
      order: 0
    },
    tracker.issueStatusCategory.Backlog
  )

  builder.createDoc(
    tracker.class.IssueStatusCategory,
    core.space.Model,
    {
      label: tracker.string.CategoryUnstarted,
      icon: tracker.icon.CategoryUnstarted,
      color: 13,
      defaultStatusName: 'Todo',
      order: 1
    },
    tracker.issueStatusCategory.Unstarted
  )

  builder.createDoc(
    tracker.class.IssueStatusCategory,
    core.space.Model,
    {
      label: tracker.string.CategoryStarted,
      icon: tracker.icon.CategoryStarted,
      color: 14,
      defaultStatusName: 'In Progress',
      order: 2
    },
    tracker.issueStatusCategory.Started
  )

  builder.createDoc(
    tracker.class.IssueStatusCategory,
    core.space.Model,
    {
      label: tracker.string.CategoryCompleted,
      icon: tracker.icon.CategoryCompleted,
      color: 15,
      defaultStatusName: 'Done',
      order: 3
    },
    tracker.issueStatusCategory.Completed
  )

  builder.createDoc(
    tracker.class.IssueStatusCategory,
    core.space.Model,
    {
      label: tracker.string.CategoryCanceled,
      icon: tracker.icon.CategoryCanceled,
      color: 16,
      defaultStatusName: 'Canceled',
      order: 4
    },
    tracker.issueStatusCategory.Canceled
  )

  const issuesId = 'issues'
  const activeId = 'active'
  const backlogId = 'backlog'
  const boardId = 'board'
  const projectsId = 'projects'
  const sprintsId = 'sprints'

  builder.mixin(tracker.class.Issue, core.class.Class, view.mixin.AttributePresenter, {
    presenter: tracker.component.IssuePresenter
  })

  builder.mixin(tracker.class.Issue, core.class.Class, view.mixin.PreviewPresenter, {
    presenter: tracker.component.IssuePreview
  })

  builder.mixin(tracker.class.Issue, core.class.Class, view.mixin.ObjectTitle, {
    titleProvider: tracker.function.IssueTitleProvider
  })

  builder.mixin(tracker.class.TypeIssuePriority, core.class.Class, view.mixin.AttributePresenter, {
    presenter: tracker.component.PriorityPresenter
  })

  builder.mixin(tracker.class.TypeIssuePriority, core.class.Class, view.mixin.AttributeFilter, {
    component: view.component.ValueFilter
  })

  builder.mixin(tracker.class.IssueStatus, core.class.Class, view.mixin.AttributePresenter, {
    presenter: tracker.component.StatusPresenter
  })

  builder.mixin(tracker.class.Project, core.class.Class, view.mixin.AttributePresenter, {
    presenter: tracker.component.ProjectTitlePresenter
  })

  builder.mixin(tracker.class.Sprint, core.class.Class, view.mixin.AttributePresenter, {
    presenter: tracker.component.SprintTitlePresenter
  })

  builder.mixin(tracker.class.Issue, core.class.Class, setting.mixin.Editable, {})

  builder.mixin(tracker.class.TypeProjectStatus, core.class.Class, view.mixin.AttributeEditor, {
    inlineEditor: tracker.component.ProjectStatusEditor
  })

  builder.mixin(tracker.class.Issue, core.class.Class, notification.mixin.LastViewAttached, {})
  builder.mixin(tracker.class.Issue, core.class.Class, notification.mixin.AnotherUserNotifications, {
    fields: ['assignee']
  })

  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: tracker.string.TrackerApplication,
      icon: tracker.icon.TrackerApplication,
      alias: trackerId,
      hidden: false,
      locationResolver: tracker.resolver.Location,
      navigatorModel: {
        specials: [
          // {
          //   id: 'inbox',
          //   position: 'top',
          //   label: tracker.string.Inbox,
          //   icon: tracker.icon.Inbox,
          //   component: tracker.component.Inbox
          // },
          {
            id: 'my-issues',
            position: 'top',
            label: tracker.string.MyIssues,
            icon: tracker.icon.MyIssues,
            component: tracker.component.MyIssues
          },
          // {
          //   id: 'views',
          //   position: 'top',
          //   label: tracker.string.Views,
          //   icon: tracker.icon.Views,
          //   component: tracker.component.Views
          // },
          {
            id: 'roadmap',
            position: 'top',
            label: tracker.string.Roadmap,
            icon: tracker.icon.Projects,
            component: tracker.component.Roadmap
          }
        ],
        spaces: [
          {
            label: tracker.string.Teams,
            spaceClass: tracker.class.Team,
            addSpaceLabel: tracker.string.CreateTeam,
            createComponent: tracker.component.CreateTeam,
            icon: tracker.icon.Home,
            specials: [
              {
                id: issuesId,
                label: tracker.string.Issues,
                icon: tracker.icon.Issues,
                component: tracker.component.Issues
              },
              {
                id: activeId,
                label: tracker.string.Active,
                // icon: tracker.icon.TrackerApplication,
                component: tracker.component.Active
              },
              {
                id: backlogId,
                label: tracker.string.Backlog,
                // icon: tracker.icon.TrackerApplication,
                component: tracker.component.Backlog
              },
              {
                id: projectsId,
                label: tracker.string.Projects,
                icon: tracker.icon.Projects,
                component: tracker.component.TeamProjects
              },
              {
                id: sprintsId,
                label: tracker.string.Sprints,
                icon: tracker.icon.Sprint,
                component: tracker.component.Sprints
              }
            ]
          }
        ]
      },
      navHeaderComponent: tracker.component.NewIssueHeader
    },
    tracker.app.Tracker
  )

  function createGotoSpecialAction (builder: Builder, id: string, key: KeyBinding, label: IntlString): void {
    createNavigateAction(builder, key, label, tracker.app.Tracker, {
      application: trackerId,
      mode: 'space',
      spaceSpecial: id,
      spaceClass: tracker.class.Team
    })
  }

  createGotoSpecialAction(builder, issuesId, 'g->e', tracker.string.GotoIssues)
  createGotoSpecialAction(builder, activeId, 'g->a', tracker.string.GotoActive)
  createGotoSpecialAction(builder, backlogId, 'g->b', tracker.string.GotoBacklog)
  createGotoSpecialAction(builder, boardId, 'g->d', tracker.string.GotoBoard)
  createGotoSpecialAction(builder, projectsId, 'g->p', tracker.string.GotoProjects)

  createAction(builder, {
    action: workbench.actionImpl.Navigate,
    actionProps: {
      mode: 'app',
      application: trackerId
    },
    label: tracker.string.GotoTrackerApplication,
    icon: view.icon.ArrowRight,
    input: 'none',
    category: view.category.Navigation,
    target: core.class.Doc,
    context: {
      mode: ['workbench', 'browser', 'editor', 'panel', 'popup']
    }
  })

  createAction(
    builder,
    {
      action: tracker.actionImpl.EditWorkflowStatuses,
      label: tracker.string.EditWorkflowStatuses,
      icon: view.icon.Statuses,
      input: 'focus',
      category: tracker.category.Tracker,
      target: tracker.class.Team,
      query: {
        archived: false
      },
      context: {
        mode: ['context', 'browser'],
        group: 'edit'
      }
    },
    tracker.action.EditWorkflowStatuses
  )

  builder.createDoc(
    view.class.ActionCategory,
    core.space.Model,
    { label: tracker.string.TrackerApplication, visible: true },
    tracker.category.Tracker
  )

  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: tracker.component.CreateIssue,
        element: 'top',
        fillProps: {
          _object: 'parentIssue',
          space: 'space'
        }
      },
      label: tracker.string.NewSubIssue,
      icon: tracker.icon.Issue,
      keyBinding: [],
      input: 'focus',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context', 'browser'],
        application: tracker.app.Tracker,
        group: 'associate'
      }
    },
    tracker.action.NewSubIssue
  )

  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: tracker.component.SetParentIssueActionPopup,
        element: 'top',
        fillProps: {
          _object: 'value'
        }
      },
      label: tracker.string.SetParent,
      icon: tracker.icon.Parent,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context'],
        application: tracker.app.Tracker,
        group: 'associate'
      }
    },
    tracker.action.SetParent
  )

  createAction(builder, {
    action: view.actionImpl.ShowPopup,
    actionPopup: tracker.component.SetParentIssueActionPopup,
    actionProps: {
      component: tracker.component.SetParentIssueActionPopup,
      element: 'top',
      fillProps: {
        _object: 'value'
      }
    },
    label: tracker.string.SetParent,
    icon: tracker.icon.Parent,
    keyBinding: [],
    input: 'none',
    category: tracker.category.Tracker,
    target: tracker.class.Issue,
    override: [tracker.action.SetParent],
    context: {
      mode: ['browser'],
      application: tracker.app.Tracker,
      group: 'associate'
    }
  })

  builder.mixin(tracker.class.Issue, core.class.Class, view.mixin.ClassFilters, {
    filters: ['status', 'priority', 'assignee', 'project', 'dueDate', 'modifiedOn']
  })

  builder.createDoc(
    presentation.class.ObjectSearchCategory,
    core.space.Model,
    {
      icon: tracker.icon.TrackerApplication,
      label: tracker.string.SearchIssue,
      query: tracker.completion.IssueQuery
    },
    tracker.completion.IssueCategory
  )

  const statusOptions: FindOptions<IssueStatus> = {
    lookup: {
      category: tracker.class.IssueStatusCategory
    },
    sort: { rank: SortingOrder.Ascending }
  }

  createAction(
    builder,
    {
      action: view.actionImpl.ValueSelector,
      actionPopup: view.component.ValueSelector,
      actionProps: {
        attribute: 'status',
        _class: tracker.class.IssueStatus,
        placeholder: tracker.string.SetStatus,
        fillQuery: {
          space: 'space'
        },
        queryOptions: statusOptions
      },
      label: tracker.string.Status,
      icon: tracker.icon.CategoryBacklog,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context'],
        application: tracker.app.Tracker,
        group: 'edit'
      }
    },
    tracker.action.SetStatus
  )
  createAction(
    builder,
    {
      action: view.actionImpl.ValueSelector,
      actionPopup: view.component.ValueSelector,
      actionProps: {
        attribute: 'priority',
        values: defaultPriorities.map((p) => ({ id: p, ...issuePriorities[p] })),
        placeholder: tracker.string.SetPriority
      },
      label: tracker.string.Priority,
      icon: tracker.icon.PriorityHigh,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context'],
        application: tracker.app.Tracker,
        group: 'edit'
      }
    },
    tracker.action.SetPriority
  )
  createAction(
    builder,
    {
      action: view.actionImpl.ValueSelector,
      actionPopup: view.component.ValueSelector,
      actionProps: {
        attribute: 'assignee',
        _class: contact.class.Employee,
        query: {},
        placeholder: tracker.string.AssignTo
      },
      label: tracker.string.Assignee,
      icon: contact.icon.Person,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context'],
        application: tracker.app.Tracker,
        group: 'edit'
      }
    },
    tracker.action.SetAssignee
  )

  createAction(
    builder,
    {
      action: view.actionImpl.ValueSelector,
      actionPopup: view.component.ValueSelector,
      actionProps: {
        attribute: 'project',
        _class: tracker.class.Project,
        query: {},
        searchField: 'label',
        placeholder: tracker.string.Project
      },
      label: tracker.string.Project,
      icon: tracker.icon.Project,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context'],
        application: tracker.app.Tracker,
        group: 'edit'
      }
    },
    tracker.action.SetProject
  )

  createAction(
    builder,
    {
      action: view.actionImpl.ValueSelector,
      actionPopup: view.component.ValueSelector,
      actionProps: {
        attribute: 'sprint',
        _class: tracker.class.Sprint,
        query: {},
        searchField: 'label',
        placeholder: tracker.string.Sprint
      },
      label: tracker.string.Sprint,
      icon: tracker.icon.Sprint,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context'],
        application: tracker.app.Tracker,
        group: 'edit'
      }
    },
    tracker.action.SetSprint
  )

  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: tracker.component.SetDueDateActionPopup,
        props: { mondayStart: true, withTime: false },
        element: 'top',
        fillProps: {
          _object: 'value'
        }
      },
      label: tracker.string.SetDueDate,
      icon: tracker.icon.DueDate,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context', 'browser'],
        application: tracker.app.Tracker,
        group: 'edit'
      }
    },
    tracker.action.SetDueDate
  )
  createAction(
    builder,
    {
      action: tracker.actionImpl.CopyToClipboard,
      actionProps: {
        type: 'id'
      },
      label: tracker.string.CopyIssueId,
      icon: tracker.icon.CopyID,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context', 'browser'],
        application: tracker.app.Tracker,
        group: 'copy'
      }
    },
    tracker.action.CopyIssueId
  )
  createAction(
    builder,
    {
      action: tracker.actionImpl.CopyToClipboard,
      actionProps: {
        type: 'title'
      },
      label: tracker.string.CopyIssueTitle,
      icon: tracker.icon.CopyBranch,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context', 'browser'],
        application: tracker.app.Tracker,
        group: 'copy'
      }
    },
    tracker.action.CopyIssueTitle
  )
  createAction(
    builder,
    {
      action: tracker.actionImpl.CopyToClipboard,
      actionProps: {
        type: 'link'
      },
      label: tracker.string.CopyIssueUrl,
      icon: tracker.icon.CopyURL,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context', 'browser'],
        application: tracker.app.Tracker,
        group: 'copy'
      }
    },
    tracker.action.CopyIssueLink
  )
  createAction(
    builder,
    {
      action: view.actionImpl.Move,
      label: tracker.string.MoveToTeam,
      icon: view.icon.Move,
      keyBinding: [],
      input: 'none',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context', 'browser'],
        application: tracker.app.Tracker,
        group: 'associate'
      }
    },
    tracker.action.MoveToTeam
  )
  // TODO: fix icon
  createAction(
    builder,
    {
      action: view.actionImpl.ValueSelector,
      actionPopup: tracker.component.RelationsPopup,
      actionProps: {
        attribute: ''
      },
      label: tracker.string.Relations,
      icon: tracker.icon.Document,
      keyBinding: [],
      input: 'focus',
      category: tracker.category.Tracker,
      target: tracker.class.Issue,
      context: {
        mode: ['context', 'browser'],
        application: tracker.app.Tracker,
        group: 'associate'
      }
    },
    tracker.action.Relations
  )
}
