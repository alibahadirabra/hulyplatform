//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
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

import { Class, Client, DocumentQuery, Ref, RelatedDocument, TxOperations } from '@hcengineering/core'
import { Resources, translate } from '@hcengineering/platform'
import { getClient, MessageBox, ObjectSearchResult } from '@hcengineering/presentation'
import { Issue, Sprint, Team } from '@hcengineering/tracker'
import { showPopup } from '@hcengineering/ui'
import CreateIssue from './components/CreateIssue.svelte'
import CreateIssueTemplate from './components/templates/CreateIssueTemplate.svelte'
import Inbox from './components/inbox/Inbox.svelte'
import Active from './components/issues/Active.svelte'
import AssigneePresenter from './components/issues/AssigneePresenter.svelte'
import Backlog from './components/issues/Backlog.svelte'
import DueDatePresenter from './components/issues/DueDatePresenter.svelte'
import EditIssue from './components/issues/edit/EditIssue.svelte'
import IssueItem from './components/issues/IssueItem.svelte'
import IssuePresenter from './components/issues/IssuePresenter.svelte'
import IssuePreview from './components/issues/IssuePreview.svelte'
import Issues from './components/issues/Issues.svelte'
import IssuesView from './components/issues/IssuesView.svelte'
import KanbanView from './components/issues/KanbanView.svelte'
import ListView from './components/issues/ListView.svelte'
import ModificationDatePresenter from './components/issues/ModificationDatePresenter.svelte'
import PriorityEditor from './components/issues/PriorityEditor.svelte'
import PriorityPresenter from './components/issues/PriorityPresenter.svelte'
import StatusEditor from './components/issues/StatusEditor.svelte'
import StatusPresenter from './components/issues/StatusPresenter.svelte'
import TitlePresenter from './components/issues/TitlePresenter.svelte'
import MyIssues from './components/myissues/MyIssues.svelte'
import NewIssueHeader from './components/NewIssueHeader.svelte'
import NopeComponent from './components/NopeComponent.svelte'
import EditProject from './components/projects/EditProject.svelte'
import IconPresenter from './components/projects/IconPresenter.svelte'
import LeadPresenter from './components/projects/LeadPresenter.svelte'
import ProjectEditor from './components/projects/ProjectEditor.svelte'
import ProjectMembersPresenter from './components/projects/ProjectMembersPresenter.svelte'
import ProjectPresenter from './components/projects/ProjectPresenter.svelte'
import Projects from './components/projects/Projects.svelte'
import ProjectStatusEditor from './components/projects/ProjectStatusEditor.svelte'
import ProjectStatusPresenter from './components/projects/ProjectStatusPresenter.svelte'
import ProjectTitlePresenter from './components/projects/ProjectTitlePresenter.svelte'
import Roadmap from './components/projects/Roadmap.svelte'
import TargetDatePresenter from './components/projects/TargetDatePresenter.svelte'
import TeamProjects from './components/projects/TeamProjects.svelte'
import RelationsPopup from './components/RelationsPopup.svelte'
import SetDueDateActionPopup from './components/SetDueDateActionPopup.svelte'
import SetParentIssueActionPopup from './components/SetParentIssueActionPopup.svelte'
import Views from './components/views/Views.svelte'
import Statuses from './components/workflow/Statuses.svelte'
import {
  getIssueId,
  getIssueTitle,
  issueIdProvider,
  issueLinkProvider,
  issueTitleProvider,
  resolveLocation
} from './issues'
import tracker from './plugin'

import SprintEditor from './components/sprints/SprintEditor.svelte'
import SprintPresenter from './components/sprints/SprintPresenter.svelte'
import Sprints from './components/sprints/Sprints.svelte'
import SprintSelector from './components/sprints/SprintSelector.svelte'
import SprintStatusPresenter from './components/sprints/SprintStatusPresenter.svelte'
import SprintTitlePresenter from './components/sprints/SprintTitlePresenter.svelte'

import SubIssuesSelector from './components/issues/edit/SubIssuesSelector.svelte'
import GrowPresenter from './components/issues/GrowPresenter.svelte'
import EstimationEditor from './components/issues/timereport/EstimationEditor.svelte'
import ReportedTimeEditor from './components/issues/timereport/ReportedTimeEditor.svelte'
import TimeSpendReport from './components/issues/timereport/TimeSpendReport.svelte'

import RelatedIssues from './components/issues/related/RelatedIssues.svelte'
import RelatedIssueTemplates from './components/issues/related/RelatedIssueTemplates.svelte'

import ProjectSelector from './components/ProjectSelector.svelte'

import IssueTemplatePresenter from './components/templates/IssueTemplatePresenter.svelte'
import IssueTemplates from './components/templates/IssueTemplates.svelte'

import EditIssueTemplate from './components/templates/EditIssueTemplate.svelte'
import TemplateEstimationEditor from './components/templates/EstimationEditor.svelte'
import MoveAndDeleteSprintPopup from './components/sprints/MoveAndDeleteSprintPopup.svelte'
import { moveIssuesToAnotherSprint } from './utils'
import { deleteObject } from '@hcengineering/view-resources/src/utils'

import CreateTeam from './components/teams/CreateTeam.svelte'
import TeamPresenter from './components/teams/TeamPresenter.svelte'

export async function queryIssue<D extends Issue> (
  _class: Ref<Class<D>>,
  client: Client,
  search: string,
  filter?: { in?: RelatedDocument[], nin?: RelatedDocument[] }
): Promise<ObjectSearchResult[]> {
  const teams = await client.findAll<Team>(tracker.class.Team, {})

  const q: DocumentQuery<Issue> = { title: { $like: `%${search}%` } }
  if (filter?.in !== undefined || filter?.nin !== undefined) {
    q._id = {}
    if (filter.in !== undefined) {
      q._id.$in = filter.in?.map((it) => it._id as Ref<Issue>)
    }
    if (filter.nin !== undefined) {
      q._id.$nin = filter.nin?.map((it) => it._id as Ref<Issue>)
    }
  }

  const named = new Map(
    (
      await client.findAll<Issue>(_class, q, {
        limit: 200,
        lookup: { space: tracker.class.Team }
      })
    ).map((e) => [e._id, e])
  )
  for (const currentTeam of teams) {
    const nids: number[] = []
    for (let n = 0; n <= currentTeam.sequence; n++) {
      const v = `${currentTeam.identifier}-${n}`
      if (v.includes(search)) {
        nids.push(n)
      }
    }
    if (nids.length > 0) {
      const q2: DocumentQuery<Issue> = { number: { $in: nids } }
      if (q._id !== undefined) {
        q2._id = q._id
      }
      const numbered = await client.findAll<Issue>(_class, q2, { limit: 200, lookup: { space: tracker.class.Team } })
      for (const d of numbered) {
        if (!named.has(d._id)) {
          named.set(d._id, d)
        }
      }
    }
  }

  return Array.from(named.values()).map((e) => ({
    doc: e,
    title: getIssueId(e.$lookup?.space as Team, e),
    icon: tracker.icon.TrackerApplication,
    component: IssueItem
  }))
}

async function editWorkflowStatuses (team: Team | undefined): Promise<void> {
  if (team !== undefined) {
    showPopup(Statuses, { teamId: team._id, teamClass: team._class }, 'float')
  }
}

async function moveAndDeleteSprint (client: TxOperations, oldSprint: Sprint, newSprint?: Sprint): Promise<void> {
  const noSprintLabel = await translate(tracker.string.NoSprint, {})

  showPopup(
    MessageBox,
    {
      label: tracker.string.MoveAndDeleteSprint,
      message: tracker.string.MoveAndDeleteSprintConfirm,
      labelProps: { newSprint: newSprint?.label ?? noSprintLabel, deleteSprint: oldSprint.label }
    },
    undefined,
    (result?: boolean) => {
      if (result === true) {
        void moveIssuesToAnotherSprint(client, oldSprint, newSprint).then((succes) => {
          if (succes) {
            void deleteObject(client, oldSprint)
          }
        })
      }
    }
  )
}

async function deleteSprint (sprint: Sprint): Promise<void> {
  const client = getClient()
  // Check if available to move issues to another sprint
  const firstSearchedSprint = await client.findOne(tracker.class.Sprint, { _id: { $nin: [sprint._id] } })
  if (firstSearchedSprint !== undefined) {
    showPopup(MoveAndDeleteSprintPopup, {
      sprint,
      moveAndDeleteSprint: async (selectedSprint?: Sprint) => await moveAndDeleteSprint(client, sprint, selectedSprint)
    }, 'top')
  } else {
    await moveAndDeleteSprint(client, sprint)
  }
}

export default async (): Promise<Resources> => ({
  component: {
    NopeComponent,
    Issues,
    Active,
    Backlog,
    Inbox,
    MyIssues,
    Projects,
    Views,
    IssuePresenter,
    ProjectPresenter,
    ProjectTitlePresenter,
    TitlePresenter,
    ModificationDatePresenter,
    PriorityPresenter,
    PriorityEditor,
    ProjectEditor,
    StatusPresenter,
    StatusEditor,
    AssigneePresenter,
    DueDatePresenter,
    EditIssue,
    NewIssueHeader,
    IconPresenter,
    LeadPresenter,
    TargetDatePresenter,
    ProjectMembersPresenter,
    ProjectStatusPresenter,
    ProjectStatusEditor,
    SetDueDateActionPopup,
    SetParentIssueActionPopup,
    EditProject,
    IssuesView,
    ListView,
    KanbanView,
    TeamProjects,
    Roadmap,
    IssuePreview,
    RelationsPopup,
    CreateIssue,
    CreateIssueTemplate,
    Sprints,
    SprintPresenter,
    SprintStatusPresenter,
    SprintTitlePresenter,
    SprintSelector,
    SprintEditor,
    ReportedTimeEditor,
    TimeSpendReport,
    EstimationEditor,
    SubIssuesSelector,
    GrowPresenter,
    RelatedIssues,
    RelatedIssueTemplates,
    ProjectSelector,
    IssueTemplates,
    IssueTemplatePresenter,
    EditIssueTemplate,
    TemplateEstimationEditor,
    CreateTeam,
    TeamPresenter
  },
  completion: {
    IssueQuery: async (client: Client, query: string, filter?: { in?: RelatedDocument[], nin?: RelatedDocument[] }) =>
      await queryIssue(tracker.class.Issue, client, query, filter)
  },
  function: {
    IssueTitleProvider: getIssueTitle,
    GetIssueId: issueIdProvider,
    GetIssueLink: issueLinkProvider,
    GetIssueTitle: issueTitleProvider
  },
  actionImpl: {
    EditWorkflowStatuses: editWorkflowStatuses,
    DeleteSprint: deleteSprint
  },
  resolver: {
    Location: resolveLocation
  }
})
