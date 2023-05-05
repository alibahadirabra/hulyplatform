//
// Copyright © 2022-2023 Hardcore Engineering Inc.
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

import { Employee, EmployeeAccount } from '@hcengineering/contact'
import type {
  AttachedDoc,
  Attribute,
  Class,
  Doc,
  Markup,
  Ref,
  RelatedDocument,
  Space,
  Status,
  StatusCategory,
  Timestamp,
  Type
} from '@hcengineering/core'
import type { Asset, IntlString, Plugin, Resource } from '@hcengineering/platform'
import { plugin } from '@hcengineering/platform'
import type { TagCategory, TagElement } from '@hcengineering/tags'
import { TagReference } from '@hcengineering/tags'
import { AnyComponent, Location, ResolvedLocation } from '@hcengineering/ui'
import { Action, ActionCategory } from '@hcengineering/view'

/**
 * @public
 */
export interface IssueStatus extends Status {}

/**
 * @public
 */
export interface Project extends Space {
  identifier: string // Project identifier
  sequence: number
  issueStatuses: number
  defaultIssueStatus: Ref<IssueStatus>
  defaultAssignee?: Ref<Employee>
  icon?: Asset
  color?: number
  defaultTimeReportDay: TimeReportDayType
}

/**
 * @public
 */
export enum TimeReportDayType {
  CurrentWorkDay = 'CurrentWorkDay',
  PreviousWorkDay = 'PreviousWorkDay'
}

/**
 * @public
 */
export enum IssuePriority {
  NoPriority,
  Urgent,
  High,
  Medium,
  Low
}

/**
 * @public
 */
export enum IssuesGrouping {
  Status = 'status',
  Assignee = 'assignee',
  Priority = 'priority',
  Component = 'component',
  Sprint = 'sprint',
  NoGrouping = '#no_category'
}

/**
 * @public
 */
export enum IssuesOrdering {
  Status = 'status',
  Priority = 'priority',
  LastUpdated = 'modifiedOn',
  DueDate = 'dueDate',
  Manual = 'rank'
}

/**
 * @public
 */
export enum IssuesDateModificationPeriod {
  All = 'all',
  PastWeek = 'pastWeek',
  PastMonth = 'pastMonth'
}

/**
 * @public
 */
export enum SprintStatus {
  Planned,
  InProgress,
  Completed,
  Canceled
}

/**
 * @public
 */
export interface Sprint extends Doc {
  label: string
  description?: Markup

  status: SprintStatus

  lead: Ref<Employee> | null
  members: Ref<Employee>[]

  space: Ref<Project>

  comments: number
  attachments?: number

  startDate: Timestamp
  targetDate: Timestamp

  // Capacity in man days.
  capacity: number
}

/**
 * @public
 */
export interface Issue extends AttachedDoc {
  title: string
  description: Markup
  status: Ref<IssueStatus>
  priority: IssuePriority

  number: number
  assignee: Ref<Employee> | null
  component: Ref<Component> | null

  // For subtasks
  subIssues: number
  blockedBy?: RelatedDocument[]
  relations?: RelatedDocument[]
  parents: IssueParentInfo[]

  comments: number
  attachments?: number
  labels?: number

  space: Ref<Project>

  dueDate: Timestamp | null

  rank: string

  sprint?: Ref<Sprint> | null

  // Estimation in man days
  estimation: number

  // ReportedTime time, auto updated using trigger.
  reportedTime: number
  // Collection of reportedTime entries, for proper time estimations per person.
  reports: number

  childInfo: IssueChildInfo[]

  createOn: Timestamp

  template?: {
    // A template issue is based on
    template: Ref<IssueTemplate>
    // Child id in template
    childId?: string
  }
}

/**
 * @public
 */
export interface IssueDraft {
  _id: Ref<Issue>
  title: string
  description: Markup
  status?: Ref<IssueStatus>
  priority: IssuePriority
  assignee: Ref<Employee> | null
  component: Ref<Component> | null
  space: Ref<Project>
  dueDate: Timestamp | null
  sprint?: Ref<Sprint> | null

  // Estimation in man days
  estimation: number
  parentIssue?: Ref<Issue>
  attachments?: number
  labels: TagReference[]
  subIssues: IssueDraft[]
  template?: {
    // A template issue is based on
    template: Ref<IssueTemplate>
    // Child id in template
    childId?: string
  }
}

/**
 * @public
 */
export interface IssueTemplateData {
  title: string
  description: Markup
  priority: IssuePriority

  assignee: Ref<Employee> | null
  component: Ref<Component> | null

  sprint?: Ref<Sprint> | null

  // Estimation in man days
  estimation: number

  labels?: Ref<TagElement>[]
}

/**
 * @public
 */
export interface IssueTemplateChild extends IssueTemplateData {
  id: Ref<Issue>
}

/**
 * @public
 */
export interface IssueTemplate extends Doc, IssueTemplateData {
  space: Ref<Project>

  children: IssueTemplateChild[]

  // Discussion stuff
  comments: number
  attachments?: number

  relations?: RelatedDocument[]
}

/**
 * @public
 *
 * Declares time spend entry
 */
export interface TimeSpendReport extends AttachedDoc {
  attachedTo: Ref<Issue>

  employee: Ref<Employee> | null

  date: Timestamp | null
  // Value in man days
  value: number

  description: string
}

/**
 * @public
 */
export interface IssueParentInfo {
  parentId: Ref<Issue>
  parentTitle: string
}

/**
 * @public
 */
export interface IssueChildInfo {
  childId: Ref<Issue>
  estimation: number
  reportedTime: number
}

/**
 * @public
 */
export interface Document extends Doc {
  title: string
  icon: string | null
  color: number
  content?: Markup

  space: Ref<Project>
}

/**
 * @public
 */
export enum ComponentStatus {
  Backlog,
  Planned,
  InProgress,
  Paused,
  Completed,
  Canceled
}

/**
 * @public
 */
export interface Component extends Doc {
  label: string
  description?: Markup

  status: ComponentStatus

  lead: Ref<Employee> | null
  members: Ref<Employee>[]

  space: Ref<Project>

  comments: number
  attachments?: number

  startDate: Timestamp | null
  targetDate: Timestamp | null

  // Ref<Document>[]
}

/**
 * @public
 */
export interface ScrumRecord extends AttachedDoc {
  label: string
  startTs: Timestamp
  endTs?: Timestamp
  scrumRecorder: Ref<EmployeeAccount>

  comments: number
  attachments?: number

  space: Ref<Project>
  attachedTo: Ref<Scrum>
}

/**
 * @public
 */
export interface Scrum extends Doc {
  title: string
  description?: Markup
  beginTime: Timestamp
  endTime: Timestamp
  members: Ref<Employee>[]
  space: Ref<Project>

  scrumRecords?: number
  attachments?: number
}

/**
 * @public
 */
export const trackerId = 'tracker' as Plugin

export * from './utils'

export default plugin(trackerId, {
  class: {
    Project: '' as Ref<Class<Project>>,
    Issue: '' as Ref<Class<Issue>>,
    IssueTemplate: '' as Ref<Class<IssueTemplate>>,
    Component: '' as Ref<Class<Component>>,
    IssueStatus: '' as Ref<Class<IssueStatus>>,
    TypeIssuePriority: '' as Ref<Class<Type<IssuePriority>>>,
    TypeComponentStatus: '' as Ref<Class<Type<ComponentStatus>>>,
    Sprint: '' as Ref<Class<Sprint>>,
    Scrum: '' as Ref<Class<Scrum>>,
    ScrumRecord: '' as Ref<Class<ScrumRecord>>,
    TypeSprintStatus: '' as Ref<Class<Type<SprintStatus>>>,
    TimeSpendReport: '' as Ref<Class<TimeSpendReport>>,
    TypeReportedTime: '' as Ref<Class<Type<number>>>
  },
  ids: {
    NoParent: '' as Ref<Issue>,
    IssueDraft: '',
    IssueDraftChild: ''
  },
  component: {
    Tracker: '' as AnyComponent,
    TrackerApp: '' as AnyComponent,
    RelatedIssues: '' as AnyComponent,
    RelatedIssuesSection: '' as AnyComponent,
    RelatedIssueSelector: '' as AnyComponent,
    RelatedIssueTemplates: '' as AnyComponent,
    EditIssue: '' as AnyComponent,
    CreateIssue: '' as AnyComponent,
    CreateIssueTemplate: '' as AnyComponent
  },
  attribute: {
    IssueStatus: '' as Ref<Attribute<Status>>
  },
  issueStatusCategory: {
    Backlog: '' as Ref<StatusCategory>,
    Unstarted: '' as Ref<StatusCategory>,
    Started: '' as Ref<StatusCategory>,
    Completed: '' as Ref<StatusCategory>,
    Canceled: '' as Ref<StatusCategory>
  },
  icon: {
    TrackerApplication: '' as Asset,
    Component: '' as Asset,
    Issue: '' as Asset,
    Project: '' as Asset,
    Document: '' as Asset,
    Inbox: '' as Asset,
    MyIssues: '' as Asset,
    Views: '' as Asset,
    Issues: '' as Asset,
    Components: '' as Asset,
    NewIssue: '' as Asset,
    Magnifier: '' as Asset,
    Labels: '' as Asset,
    DueDate: '' as Asset,
    Parent: '' as Asset,
    Sprint: '' as Asset,
    IssueTemplates: '' as Asset,
    Scrum: '' as Asset,
    Start: '' as Asset,
    Stop: '' as Asset,

    CategoryBacklog: '' as Asset,
    CategoryUnstarted: '' as Asset,
    CategoryStarted: '' as Asset,
    CategoryCompleted: '' as Asset,
    CategoryCanceled: '' as Asset,

    PriorityNoPriority: '' as Asset,
    PriorityUrgent: '' as Asset,
    PriorityHigh: '' as Asset,
    PriorityMedium: '' as Asset,
    PriorityLow: '' as Asset,

    ComponentsList: '' as Asset,
    ComponentsTimeline: '' as Asset,

    ComponentStatusBacklog: '' as Asset,
    ComponentStatusPlanned: '' as Asset,
    ComponentStatusInProgress: '' as Asset,
    ComponentStatusPaused: '' as Asset,
    ComponentStatusCompleted: '' as Asset,
    ComponentStatusCanceled: '' as Asset,

    SprintStatusPlanned: '' as Asset,
    SprintStatusInProgress: '' as Asset,
    SprintStatusPaused: '' as Asset,
    SprintStatusCompleted: '' as Asset,
    SprintStatusCanceled: '' as Asset,

    CopyID: '' as Asset,
    CopyURL: '' as Asset,
    CopyBranch: '' as Asset,
    Duplicate: '' as Asset,

    TimeReport: '' as Asset,
    Estimation: '' as Asset,

    Timeline: '' as Asset,

    // Project icons
    Home: '' as Asset,
    RedCircle: '' as Asset
  },
  category: {
    Other: '' as Ref<TagCategory>,
    Tracker: '' as Ref<ActionCategory>
  },
  action: {
    SetDueDate: '' as Ref<Action>,
    SetParent: '' as Ref<Action>,
    SetStatus: '' as Ref<Action>,
    SetPriority: '' as Ref<Action>,
    SetAssignee: '' as Ref<Action>,
    SetComponent: '' as Ref<Action>,
    CopyIssueId: '' as Ref<Action>,
    CopyIssueTitle: '' as Ref<Action>,
    CopyIssueLink: '' as Ref<Action>,
    MoveToProject: '' as Ref<Action>,
    Duplicate: '' as Ref<Action>,
    Relations: '' as Ref<Action>,
    NewSubIssue: '' as Ref<Action>,
    EditWorkflowStatuses: '' as Ref<Action>,
    EditProject: '' as Ref<Action>,
    SetSprint: '' as Ref<Action>,
    SetLabels: '' as Ref<Action>
  },
  project: {
    DefaultProject: '' as Ref<Project>
  },
  resolver: {
    Location: '' as Resource<(loc: Location) => Promise<ResolvedLocation | undefined>>
  },
  string: {
    NewRelatedIssue: '' as IntlString
  }
})
