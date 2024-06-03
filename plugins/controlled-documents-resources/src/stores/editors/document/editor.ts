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

import { combine, createStore } from 'effector'
import {
  type ControlledDocument,
  ControlledDocumentState,
  type DocumentReviewRequest,
  type DocumentSection,
  DocumentState,
  type DocumentTemplate,
  type EditorMode,
  type DocumentApprovalRequest,
  type ControlledDocumentSnapshot,
  type Project,
  type ProjectDocument
} from '@hcengineering/controlled-documents'
import chunter from '@hcengineering/chunter'
import { type Ref, getCurrentAccount } from '@hcengineering/core'
import { type PersonAccount } from '@hcengineering/contact'
import { type Training } from '@hcengineering/training'
import { type IntlString } from '@hcengineering/platform'
import { getClient } from '@hcengineering/presentation'
import { type ButtonItem } from '@hcengineering/ui'
import { getDocumentTraining } from '../../../docutils'
import plugin from '../../../plugin'
import {
  RightPanelTab,
  approvalRequestUpdated,
  controlledDocumentClosed,
  controlledDocumentOpened,
  controlledDocumentSectionsUpdated,
  controlledDocumentUpdated,
  documentSectionCollapsed,
  documentSectionDescriptionEditingCompleted,
  documentSectionDescriptionEditingRequested,
  documentSectionExpanded,
  documentSectionToggled,
  documentAllVersionsUpdated,
  editorModeUpdated,
  reviewRequestUpdated,
  rightPanelTabChanged,
  documentSnapshotsUpdated,
  trainingUpdated,
  projectDocumentsUpdated,
  projectUpdated
} from './actions'
import { documentCompareFn, getCurrentEmployee } from '../../../utils'

export const $controlledDocument = createStore<ControlledDocument | null>(null)
  .on(controlledDocumentUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $controlledDocumentTemplate = createStore<DocumentTemplate | null>(null)
  .on(controlledDocumentUpdated, (_, payload) => payload?.$lookup?.template ?? null)
  .reset(controlledDocumentClosed)

export const $controlledDocumentSections = createStore<DocumentSection[]>([])
  .on(controlledDocumentSectionsUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $controlledDocumentSectionIds = $controlledDocumentSections.map(
  (sections) => sections?.map((section) => section._id) ?? []
)

const $documentAllVersions = createStore<ControlledDocument[]>([])
  .on(documentAllVersionsUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $documentAllVersionsDescSorted = $documentAllVersions.map((docs) =>
  docs.toSorted((a, b) => documentCompareFn(a, b) * -1)
)

export const $documentSnapshots = createStore<ControlledDocumentSnapshot[]>([])
  .on(documentSnapshotsUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $documentComparisonVersions = combine(
  $controlledDocument,
  $documentAllVersions,
  $documentSnapshots,
  (doc, versions, snapshots) => {
    const result: Array<ControlledDocument | ControlledDocumentSnapshot> = []

    if (doc?.state === DocumentState.Draft) {
      result.push(doc, ...snapshots)
    }

    result.push(...versions.filter((d) => d.state !== DocumentState.Draft))

    return result
  }
)

export const $documentReleasedVersions = $documentAllVersions.map((docs) =>
  docs.filter((d) => [DocumentState.Effective, DocumentState.Archived].includes(d.state))
)

export const $documentLatestVersion = combine($documentAllVersions, (versions) => {
  return versions[0]
})

export const $projectRef = createStore<Ref<Project> | null>(null)
  .on(controlledDocumentOpened, (_, payload) => payload.project)
  .reset(controlledDocumentClosed)

export const $project = createStore<Project | null>(null)
  .on(projectUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $projectDocuments = createStore<ProjectDocument[]>([])
  .on(projectDocumentsUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $documentTraining = $controlledDocument.map((document) =>
  document === null ? null : getDocumentTraining(getClient().getHierarchy(), document) ?? null
)

export const $training = createStore<Training | null>(null)
  .on(trainingUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $reviewRequest = createStore<DocumentReviewRequest | null>(null)
  .on(reviewRequestUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $approvalRequest = createStore<DocumentApprovalRequest | null>(null)
  .on(approvalRequestUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $editorMode = createStore<EditorMode>('viewing')
  .on(editorModeUpdated, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $documentSectionEditingDescription = createStore<Ref<DocumentSection> | null>(null)
  .on(documentSectionDescriptionEditingRequested, (_, payload) => payload)
  .reset([controlledDocumentClosed, documentSectionDescriptionEditingCompleted])

export const $activeRightPanelTab = createStore<RightPanelTab | null>(RightPanelTab.INFO)
  .on(rightPanelTabChanged, (_, payload) => payload)
  .reset(controlledDocumentClosed)

export const $isLatestVersion = combine($controlledDocument, $documentAllVersions, (doc, versions) => {
  if (doc == null || versions.length === 0) return false
  return doc._id === versions[0]._id
})

export const $isDocumentOwner = $controlledDocument.map((doc) => {
  if (doc == null) {
    return false
  }

  const employee = getCurrentEmployee()

  return doc.owner === employee
})

export const $isDocumentCoAuthor = $controlledDocument.map((doc) => {
  if (doc == null) {
    return false
  }

  const employee = getCurrentEmployee()

  if (employee === undefined) {
    return false
  }

  return doc.coAuthors.includes(employee)
})

export const $isDocumentReviewer = $controlledDocument.map((doc) => {
  if (doc == null) {
    return false
  }

  const employee = getCurrentEmployee()
  if (employee == null) {
    return false
  }
  return doc.reviewers?.includes(employee) ?? false
})

export const $documentStateForCurrentUser = combine($controlledDocument, $reviewRequest, (doc, reviewRequest) => {
  if (doc == null) {
    return null
  }

  if (doc.controlledState === ControlledDocumentState.InReview) {
    if (reviewRequest == null) {
      return ControlledDocumentState.InReview
    }

    const currentAccount = getCurrentAccount()._id as Ref<PersonAccount>
    if (reviewRequest.approved?.includes(currentAccount)) {
      return ControlledDocumentState.Reviewed
    }
  }

  if (doc.controlledState != null) {
    return doc.controlledState
  }

  return doc.state
})

export const $documentState = $controlledDocument.map((doc) => {
  if (doc == null) {
    return null
  }

  if (doc.controlledState != null) {
    return doc.controlledState
  }

  return doc.state
})

export const $documentReviewIsActive = combine($reviewRequest, $documentStateForCurrentUser, (reviewReq, state) => {
  const me = getCurrentAccount()._id as Ref<PersonAccount>

  if (reviewReq == null) {
    return false
  }

  return (
    state === ControlledDocumentState.InReview && reviewReq.requested.includes(me) && !reviewReq.approved.includes(me)
  )
})

export const $documentApprovalIsActive = combine(
  $controlledDocument,
  $approvalRequest,
  $documentStateForCurrentUser,
  (doc, approvalReq, state) => {
    const me = getCurrentAccount()._id as Ref<PersonAccount>

    if (approvalReq == null) {
      return false
    }

    return (
      doc?.state === DocumentState.Draft &&
      state === ControlledDocumentState.InApproval &&
      approvalReq.requested.includes(me) &&
      !approvalReq.approved.includes(me)
    )
  }
)

export const $availableEditorModes = combine(
  $documentStateForCurrentUser,
  $documentComparisonVersions,
  $isDocumentOwner,
  $isDocumentCoAuthor,
  (state, versions, isOwner, isCoAuthor) => {
    const modes: Array<{
      id: EditorMode
      label: IntlString
    }> = []

    if (state === DocumentState.Draft && (isOwner || isCoAuthor)) {
      modes.push({
        id: 'editing',
        label: plugin.string.EditMode
      })
    } else {
      modes.push({
        id: 'viewing',
        label: plugin.string.ViewMode
      })
    }

    if (versions.length > 1) {
      modes.push({
        id: 'comparing',
        label: plugin.string.ComparisonMode
      })
    }

    return modes
  }
)

export const $isProjectEditable = combine(
  $projectRef,
  $project,
  (projectRef, project) => project == null || !project.readonly
)

export const $isEditable = combine(
  $documentStateForCurrentUser,
  $editorMode,
  $isDocumentOwner,
  $isDocumentCoAuthor,
  (state, mode, isOwner, isCoAuthor) => (isOwner || isCoAuthor) && mode === 'editing' && state === DocumentState.Draft
)

export const $collapsedDocumentSectionIds = createStore<Set<Ref<DocumentSection>>>(new Set())
  .on(documentSectionToggled, (collapsed, sectionId) => {
    if (collapsed.has(sectionId)) {
      collapsed.delete(sectionId)
    } else {
      collapsed.add(sectionId)
    }

    return new Set(collapsed)
  })
  .on(documentSectionCollapsed, (collapsed, sectionId) => {
    if (collapsed.has(sectionId)) {
      return
    }

    collapsed.add(sectionId)

    return new Set(collapsed)
  })
  .on(documentSectionExpanded, (collapsed, sectionId) => {
    if (!collapsed.has(sectionId)) {
      return
    }

    collapsed.delete(sectionId)

    return new Set(collapsed)
  })
  .reset(controlledDocumentClosed)

export const $canViewDocumentComments = combine(
  $editorMode,
  $isDocumentOwner,
  $isDocumentCoAuthor,
  $isDocumentReviewer,
  (mode, isOwner, isCoAuthor, isReviewer) =>
    (isOwner || isCoAuthor || isReviewer) && (mode === 'viewing' || mode === 'editing')
)

export const $canAddDocumentComments = combine(
  $canViewDocumentComments,
  $documentStateForCurrentUser,
  $isDocumentOwner,
  $isDocumentCoAuthor,
  $isDocumentReviewer,
  (canView, state, isOwner, isCoAuthor, isReviewer) => {
    if (!canView) {
      return false
    }

    if (state === DocumentState.Draft) {
      return isOwner || isCoAuthor
    }

    if (state === ControlledDocumentState.InReview) {
      return isOwner || isCoAuthor || isReviewer
    }

    return false
  }
)

export const $canAddDocumentCommentsFeedback = combine(
  $canViewDocumentComments,
  $documentStateForCurrentUser,
  $isDocumentOwner,
  $isDocumentCoAuthor,
  $isDocumentReviewer,
  (canView, state, isOwner, isCoAuthor, isReviewer) => {
    if (!canView) {
      return false
    }

    if (
      state !== DocumentState.Draft &&
      state !== ControlledDocumentState.InReview &&
      state !== ControlledDocumentState.Reviewed
    ) {
      return false
    }

    return isOwner || isCoAuthor || isReviewer
  }
)

export const $availableRightPanelTabs = combine($canViewDocumentComments, (canViewComments) => {
  const tabs: ButtonItem[] = [
    { id: RightPanelTab.INFO, icon: plugin.icon.Document, showTooltip: { label: plugin.string.GeneralInfo } }
  ]

  if (canViewComments) {
    tabs.push({
      id: RightPanelTab.COMMENT,
      icon: chunter.icon.Chunter,
      showTooltip: { label: chunter.string.Comments }
    })
  }

  tabs.push({
    id: RightPanelTab.APPROVALS,
    icon: plugin.icon.Approvals,
    showTooltip: { label: plugin.string.DocumentApprovals }
  })

  return tabs
})
