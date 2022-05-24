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

// To help typescript locate view plugin properly
import type { Board, Card, CardLabel, MenuPage, CommonBoardPreference, CardCover } from '@anticrm/board'
import type { Employee } from '@anticrm/contact'
import { DOMAIN_MODEL, IndexKind, Markup, Ref, Type } from '@anticrm/core'
import {
  ArrOf,
  Builder,
  Collection,
  Index,
  Model,
  Prop,
  TypeBoolean,
  TypeMarkup,
  TypeRef,
  TypeString,
  UX
} from '@anticrm/model'
import attachment from '@anticrm/model-attachment'
import chunter from '@anticrm/model-chunter'
import contact from '@anticrm/model-contact'
import core, { TAttachedDoc, TDoc, TType } from '@anticrm/model-core'
import task, { TSpaceWithStates, TTask } from '@anticrm/model-task'
import view, { actionTemplates, createAction } from '@anticrm/model-view'
import workbench, { Application } from '@anticrm/model-workbench'
import { IntlString } from '@anticrm/platform'
import type { AnyComponent } from '@anticrm/ui'
import preference, { TPreference } from '@anticrm/model-preference'
import board from './plugin'

@Model(board.class.Board, task.class.SpaceWithStates)
@UX(board.string.Board, board.icon.Board)
export class TBoard extends TSpaceWithStates implements Board {
  color!: number
  background!: string
}

@Model(board.class.CardLabel, core.class.AttachedDoc, DOMAIN_MODEL)
@UX(board.string.Labels)
export class TCardLabel extends TAttachedDoc implements CardLabel {
  title!: string
  color!: number
  isHidden?: boolean
}

function TypeCardCover (): Type<CardCover> {
  return { _class: board.class.CardCover, label: board.string.Cover }
}

@UX(board.string.Cover)
@Model(board.class.CardCover, core.class.Type)
export class TCardCover extends TType implements CardCover {
  size!: 'large' | 'small'
  color!: number
}

@Model(board.class.CommonBoardPreference, preference.class.Preference)
export class TCommonBoardPreference extends TPreference implements CommonBoardPreference {
  @Prop(TypeRef(workbench.class.Application), board.string.CommonBoardPreference)
  attachedTo!: Ref<Application>

  cardLabelsCompactMode!: boolean
}

@Model(board.class.Card, task.class.Task)
@UX(board.string.Card, board.icon.Card, undefined, 'title')
export class TCard extends TTask implements Card {
  @Prop(TypeString(), board.string.Title)
  @Index(IndexKind.FullText)
  title!: string

  @Prop(TypeBoolean(), board.string.IsArchived)
  isArchived?: boolean

  @Prop(TypeMarkup(), board.string.Description)
  @Index(IndexKind.FullText)
  description!: Markup

  @Prop(Collection(board.class.CardLabel), board.string.Labels)
  labels!: Ref<CardLabel>[]

  @Prop(TypeString(), board.string.Location)
  @Index(IndexKind.FullText)
  location?: string

  @Prop(Collection(chunter.class.Comment), chunter.string.Comments)
  comments?: number

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, undefined, attachment.string.Files)
  attachments?: number

  @Prop(TypeRef(contact.class.Employee), board.string.Assignee)
  declare assignee: Ref<Employee> | null

  @Prop(ArrOf(TypeRef(contact.class.Employee)), board.string.Members)
  members?: Ref<Employee>[]

  @Prop(TypeCardCover(), board.string.Cover)
  cover?: CardCover
}

@Model(board.class.MenuPage, core.class.Doc, DOMAIN_MODEL)
export class TMenuPage extends TDoc implements MenuPage {
  component!: AnyComponent
  pageId!: string
  label!: IntlString
}

export function createModel (builder: Builder): void {
  builder.createModel(TBoard, TCard, TCardLabel, TMenuPage, TCommonBoardPreference, TCardCover)

  builder.createDoc(board.class.MenuPage, core.space.Model, {
    component: board.component.Archive,
    pageId: board.menuPageId.Archive,
    label: board.string.Archive
  })
  builder.createDoc(board.class.MenuPage, core.space.Model, {
    component: board.component.MenuMainPage,
    pageId: board.menuPageId.Main,
    label: board.string.Menu
  })

  builder.mixin(board.class.Board, core.class.Class, workbench.mixin.SpaceView, {
    view: {
      class: board.class.Card
      // createItemDialog: board.component.CreateCard,
      // createItemLabel: board.string.CardCreateLabel
    }
  })
  builder.mixin(board.class.Board, core.class.Class, view.mixin.SpaceHeader, {
    header: board.component.BoardHeader
  })

  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: board.string.BoardApplication,
      icon: board.icon.Board,
      hidden: false,
      navigatorModel: {
        spaces: [
          {
            label: board.string.MyBoards,
            spaceClass: board.class.Board,
            addSpaceLabel: board.string.BoardCreateLabel,
            createComponent: board.component.CreateBoard
          }
        ],
        aside: board.component.BoardMenu
      }
    },
    board.app.Board
  )

  // const leadLookup: Lookup<Card> =
  // {
  //   state: task.class.State,
  //   doneState: task.class.DoneState
  // }

  // builder.createDoc(view.class.Viewlet, core.space.Model, {
  //   attachTo: board.class.Card,
  //   descriptor: task.viewlet.StatusTable,
  //   // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //   options: {
  //     lookup: leadLookup
  //   } as FindOptions<Doc>, // TODO: fix
  //   config: [
  //     '',
  //     '$lookup.attachedTo',
  //     '$lookup.state',
  //     '$lookup.doneState',
  //     { presenter: attachment.component.AttachmentsPresenter, label: attachment.string.Files, sortingKey: 'attachments' },
  //     { presenter: chunter.component.CommentsPresenter, label: chunter.string.Comments, sortingKey: 'comments' },
  //     'modifiedOn',
  //     '$lookup.attachedTo.$lookup.channels'
  //   ]
  // })

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: board.class.Card,
    descriptor: board.viewlet.Kanban,
    config: []
  })

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: board.class.Card,
    descriptor: board.viewlet.Table,
    config: []
  })

  builder.mixin(board.class.Card, core.class.Class, task.mixin.KanbanCard, {
    card: board.component.KanbanCard
  })

  builder.mixin(board.class.Card, core.class.Class, view.mixin.ObjectEditor, {
    editor: board.component.EditCard
  })

  builder.mixin(board.class.Card, core.class.Class, view.mixin.AttributePresenter, {
    presenter: board.component.CardPresenter
  })

  builder.mixin(board.class.CardLabel, core.class.Class, view.mixin.AttributePresenter, {
    presenter: board.component.CardLabelPresenter
  })

  builder.mixin(board.class.CardLabel, core.class.Class, view.mixin.CollectionPresenter, {
    presenter: board.component.CardLabelPresenter
  })

  builder.mixin(board.class.Board, core.class.Class, view.mixin.AttributePresenter, {
    presenter: board.component.BoardPresenter
  })

  builder.mixin(board.class.CardCover, core.class.Class, view.mixin.AttributePresenter, {
    presenter: board.component.CardCoverPresenter
  })

  builder.mixin(board.class.CardCover, core.class.Class, view.mixin.AttributeEditor, {
    editor: board.component.CardCoverEditor
  })

  builder.createDoc(
    task.class.KanbanTemplateSpace,
    core.space.Model,
    {
      name: board.string.Boards,
      description: board.string.ManageBoardStatuses,
      icon: board.component.TemplatesIcon
    },
    board.space.BoardTemplates
  )

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: task.string.Kanban,
      icon: task.icon.Kanban,
      component: board.component.KanbanView
    },
    board.viewlet.Kanban
  )

  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: view.string.Table,
      icon: view.icon.Table,
      component: board.component.TableView
    },
    board.viewlet.Table
  )

  builder.createDoc(
    task.class.WonState,
    core.space.Model,
    {
      title: board.string.Completed,
      rank: '0'
    },
    board.state.Completed
  )

  // card actions
  createAction(
    builder,
    {
      action: view.actionImpl.ShowPanel,
      actionProps: {
        component: board.component.EditCard
      },
      label: view.string.Open,
      icon: board.icon.Card,
      input: 'any',
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: 'context', application: board.app.Board, group: 'top' }
    },
    board.action.Open
  )
  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: board.component.LabelsActionPopup,
        element: view.popup.PositionElementAlignment
      },
      label: board.string.Labels,
      icon: board.icon.Card,
      input: 'any',
      inline: true,
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: 'context', application: board.app.Board, group: 'top' }
    },
    board.action.Labels
  )
  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: board.component.DatesActionPopup,
        element: view.popup.PositionElementAlignment
      },
      label: board.string.Dates,
      icon: board.icon.Card,
      input: 'any',
      inline: true,
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: 'context', application: board.app.Board, group: 'top' }
    },
    board.action.Dates
  )
  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: board.component.CoverActionPopup,
        element: view.popup.PositionElementAlignment
      },
      label: board.string.Cover,
      icon: board.icon.Card,
      input: 'any',
      inline: true,
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: 'context', application: board.app.Board, group: 'top' }
    },
    board.action.Cover
  )
  createAction(
    builder,
    {
      ...actionTemplates.move,
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: board.component.MoveActionPopup,
        element: view.popup.PositionElementAlignment
      },
      input: 'any',
      inline: true,
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: ['context', 'editor'], application: board.app.Board, group: 'tools' }
    },
    board.action.Move
  )
  createAction(
    builder,
    {
      action: view.actionImpl.ShowPopup,
      actionProps: {
        component: board.component.CopyActionPopup,
        element: view.popup.PositionElementAlignment
      },
      label: board.string.Copy,
      icon: board.icon.Card,
      input: 'any',
      inline: true,
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: ['context', 'editor'], application: board.app.Board, group: 'tools' }
    },
    board.action.Copy
  )

  createAction(
    builder,
    {
      action: view.actionImpl.UpdateDocument,
      actionProps: {
        key: 'isArchived',
        value: true,
        ask: true,
        label: task.string.Archive,
        message: task.string.ArchiveConfirm
      },
      query: {
        isArchived: { $nin: [true] }
      },
      label: board.string.Archive,
      icon: view.icon.Archive,
      input: 'any',
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: ['context', 'editor'], application: board.app.Board, group: 'tools' }
    },
    board.action.Archive
  )
  createAction(
    builder,
    {
      action: view.actionImpl.UpdateDocument,
      actionProps: {
        key: 'isArchived',
        value: false
      },
      query: {
        isArchived: true
      },
      label: board.string.SendToBoard,
      icon: board.icon.Card,
      input: 'any',
      category: board.category.Card,
      target: board.class.Card,
      context: { mode: ['context', 'editor'], application: board.app.Board, group: 'tools' }
    },
    board.action.SendToBoard
  )

  createAction(
    builder,
    {
      action: view.actionImpl.Delete,
      query: {
        isArchived: true
      },
      label: view.string.Delete,
      icon: view.icon.Delete,
      keyBinding: ['Meta + Backspace', 'Ctrl + Backspace'],
      category: board.category.Card,
      input: 'any',
      target: board.class.Card,
      context: { mode: ['context', 'editor'], application: board.app.Board, group: 'tools' }
    },
    board.action.Delete
  )

  builder.mixin(board.class.Card, core.class.Class, view.mixin.IgnoreActions, {
    actions: [view.action.Delete, task.action.Move]
  })

  // TODO: update query when nested query is available
  createAction(
    builder,
    {
      action: board.actionImpl.ConvertToCard,
      label: board.string.ConvertToCard,
      icon: board.icon.Card,
      category: board.category.Card,
      query: {
        attachedToClass: task.class.TodoItem
      },
      input: 'any',
      target: task.class.TodoItem,
      context: { mode: ['context', 'browser'] }
    },
    board.action.ConvertToCard
  )
}

export { boardOperation } from './migration'
export { default } from './plugin'
