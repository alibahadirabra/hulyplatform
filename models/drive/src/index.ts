//
// Copyright © 2024 Hardcore Engineering Inc.
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

import core, {
  type Domain,
  type Role,
  type RolesAssignment,
  type Type,
  Account,
  AccountRole,
  Ref,
  IndexKind,
  DOMAIN_MODEL,
  type Blob
} from '@hcengineering/core'
import { type Drive, type File, type Folder, type Resource, driveId } from '@hcengineering/drive'
import { type Builder, Model, UX, Mixin, Prop, TypeString, Index, TypeRef, ReadOnly } from '@hcengineering/model'
import { TDoc, TType, TTypedSpace } from '@hcengineering/model-core'
import tracker from '@hcengineering/model-tracker'
import view, { type Viewlet, classPresenter, createAction } from '@hcengineering/model-view'
import workbench from '@hcengineering/model-workbench'
import { getEmbeddedLabel } from '@hcengineering/platform'

import drive from './plugin'

export { driveId } from '@hcengineering/drive'
export { drive as default }

export const DOMAIN_DRIVE = 'drive' as Domain

/** @public */
export function TypeFilesize (): Type<number> {
  return { _class: drive.class.TypeFileSize, label: drive.string.Size }
}

@Model(drive.class.TypeFileSize, core.class.Type, DOMAIN_MODEL)
export class TTypeFileSize extends TType {}

@Model(drive.class.Drive, core.class.TypedSpace)
@UX(drive.string.Drive)
export class TDrive extends TTypedSpace implements Drive {}

@Mixin(drive.mixin.DefaultDriveTypeData, drive.class.Drive)
@UX(getEmbeddedLabel('Default drive type'))
export class TDefaultDriveTypeData extends TDrive implements RolesAssignment {
  [key: Ref<Role>]: Ref<Account>[]
}

@Model(drive.class.Resource, core.class.Doc, DOMAIN_DRIVE)
@UX(drive.string.Resource)
export class TResource extends TDoc implements Resource {
  declare space: Ref<Drive>

  @Prop(TypeString(), drive.string.Name)
  @Index(IndexKind.FullText)
    name!: string

  @Prop(TypeRef(core.class.Blob), drive.string.File)
  @ReadOnly()
    file?: Ref<Blob>

  @Prop(TypeRef(drive.class.Resource), drive.string.Parent)
  @Index(IndexKind.Indexed)
  @ReadOnly()
    parent!: Ref<Resource>

  @Prop(TypeRef(drive.class.Resource), drive.string.Path)
  @ReadOnly()
    path!: Ref<Resource>[]
}

@Model(drive.class.Folder, drive.class.Resource, DOMAIN_DRIVE)
@UX(drive.string.Folder)
export class TFolder extends TResource implements Folder {
  @Prop(TypeRef(drive.class.Folder), drive.string.Parent)
  @Index(IndexKind.Indexed)
  @ReadOnly()
  declare parent: Ref<Folder>

  @Prop(TypeRef(drive.class.Folder), drive.string.Path)
  @ReadOnly()
  declare path: Ref<Folder>[]

  declare file: undefined
}

@Model(drive.class.File, drive.class.Resource, DOMAIN_DRIVE)
@UX(drive.string.File)
export class TFile extends TResource implements File {
  @Prop(TypeRef(core.class.Blob), drive.string.File)
  @ReadOnly()
  declare file: Ref<Blob>

  @Prop(TypeRef(drive.class.Folder), drive.string.Parent)
  @Index(IndexKind.Indexed)
  @ReadOnly()
  declare parent: Ref<Folder>

  @Prop(TypeRef(drive.class.Folder), drive.string.Path)
  @ReadOnly()
  declare path: Ref<Folder>[]
}

function defineDrive (builder: Builder): void {
  builder.createModel(TDrive, TDefaultDriveTypeData)

  builder.mixin(drive.class.Drive, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: drive.component.DrivePresenter
  })

  builder.mixin(drive.class.Drive, core.class.Class, view.mixin.ObjectPanel, {
    component: drive.component.DrivePanel
  })

  builder.mixin(drive.class.Drive, core.class.Class, view.mixin.LinkProvider, {
    encode: drive.function.DriveLinkProvider
  })

  // Space type

  builder.createDoc(
    core.class.SpaceTypeDescriptor,
    core.space.Model,
    {
      name: drive.string.Drive,
      description: drive.string.Description,
      icon: drive.icon.Drive,
      baseClass: drive.class.Drive,
      availablePermissions: [
        core.permission.UpdateSpace,
        core.permission.ArchiveSpace,
        core.permission.ForbidDeleteObject
      ]
    },
    drive.descriptor.DriveType
  )

  builder.createDoc(
    core.class.SpaceType,
    core.space.Model,
    {
      name: 'Default drive type',
      descriptor: drive.descriptor.DriveType,
      roles: 0,
      targetClass: drive.mixin.DefaultDriveTypeData
    },
    drive.spaceType.DefaultDrive
  )

  // Navigator

  builder.mixin(drive.class.Drive, core.class.Class, view.mixin.SpacePresenter, {
    presenter: drive.component.DriveSpacePresenter
  })

  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: drive.class.Drive,
      descriptor: view.viewlet.Table,
      configOptions: {
        hiddenKeys: ['name', 'description']
      },
      config: ['', 'members', 'owners', 'private', 'archived']
    },
    drive.viewlet.DriveTable
  )

  // Actions

  builder.mixin(drive.class.Drive, core.class.Class, view.mixin.IgnoreActions, {
    actions: [tracker.action.EditRelatedTargets, tracker.action.NewRelatedIssue]
  })

  createAction(
    builder,
    {
      action: drive.actionImpl.EditDrive,
      label: drive.string.EditDrive,
      icon: view.icon.Edit,
      input: 'focus',
      category: drive.category.Drive,
      target: drive.class.Drive,
      visibilityTester: view.function.CanEditSpace,
      query: {},
      context: {
        mode: ['context', 'browser'],
        group: 'edit'
      }
    },
    drive.action.EditDrive
  )

  createAction(
    builder,
    {
      action: drive.actionImpl.CreateRootFolder,
      label: drive.string.CreateFolder,
      icon: drive.icon.Folder,
      category: drive.category.Drive,
      input: 'none',
      target: drive.class.Drive,
      context: {
        mode: ['context', 'browser'],
        application: drive.app.Drive,
        group: 'create'
      }
    },
    drive.action.CreateRootFolder
  )
}

function defineResource (builder: Builder): void {
  builder.createModel(TTypeFileSize, TResource)

  classPresenter(builder, drive.class.TypeFileSize, drive.component.FileSizePresenter)

  builder.mixin(drive.class.Resource, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: drive.component.ResourcePresenter
  })

  builder.createDoc<Viewlet>(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: drive.class.Resource,
      descriptor: view.viewlet.Table,
      config: [
        {
          key: '',
          presenter: drive.component.ResourcePresenter,
          label: drive.string.Name
        },
        {
          key: '$lookup.file.size',
          presenter: drive.component.FileSizePresenter,
          label: drive.string.Size
        },
        {
          key: '$lookup.file.modifiedOn'
        },
        'createdBy'
      ],
      configOptions: {
        hiddenKeys: ['name', 'file', 'parent', 'path'],
        sortable: true
      }
    },
    drive.viewlet.FileTable
  )

  // builder.createDoc<Viewlet>(
  //   view.class.Viewlet,
  //   core.space.Model,
  //   {
  //     attachTo: drive.class.Resource,
  //     descriptor: drive.viewlet.Grid,
  //     config: ['', 'type', 'size', 'lastModified', 'createdBy'],
  //     configOptions: {
  //       hiddenKeys: ['name', 'file', 'parent', 'path'],
  //       sortable: true
  //     }
  //   },
  //   drive.viewlet.FileGrid
  // )
}

function defineFolder (builder: Builder): void {
  builder.createModel(TFolder)

  builder.mixin(drive.class.Folder, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: drive.component.FolderPresenter
  })

  builder.mixin(drive.class.Folder, core.class.Class, view.mixin.ObjectEditor, {
    editor: drive.component.EditFolder
  })

  builder.mixin(drive.class.Folder, core.class.Class, view.mixin.ObjectPanel, {
    component: drive.component.FolderPanel
  })

  builder.mixin(drive.class.Folder, core.class.Class, view.mixin.LinkProvider, {
    encode: drive.function.FolderLinkProvider
  })

  // Actions

  builder.mixin(drive.class.Folder, core.class.Class, view.mixin.IgnoreActions, {
    actions: [
      view.action.Open,
      view.action.OpenInNewTab,
      tracker.action.EditRelatedTargets,
      tracker.action.NewRelatedIssue
    ]
  })

  createAction(
    builder,
    {
      action: drive.actionImpl.CreateChildFolder,
      label: drive.string.CreateFolder,
      icon: drive.icon.Folder,
      category: drive.category.Drive,
      input: 'none',
      target: drive.class.Folder,
      context: {
        mode: ['context', 'browser'],
        application: drive.app.Drive,
        group: 'create'
      }
    },
    drive.action.CreateChildFolder
  )
}

function defineFile (builder: Builder): void {
  builder.createModel(TFile)

  builder.mixin(drive.class.File, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: drive.component.FilePresenter
  })

  // Actions

  builder.mixin(drive.class.File, core.class.Class, view.mixin.IgnoreActions, {
    actions: [view.action.OpenInNewTab, tracker.action.EditRelatedTargets, tracker.action.NewRelatedIssue]
  })

  createAction(
    builder,
    {
      action: drive.actionImpl.DownloadFile,
      label: drive.string.Download,
      icon: drive.icon.Download,
      category: drive.category.Drive,
      input: 'none',
      target: drive.class.File,
      context: {
        mode: ['context', 'browser'],
        application: drive.app.Drive,
        group: 'tools'
      }
    },
    drive.action.DownloadFile
  )
}

function defineApplication (builder: Builder): void {
  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: drive.string.Drive,
      icon: drive.icon.Drive,
      alias: driveId,
      hidden: false,
      locationResolver: drive.resolver.Location,
      navigatorModel: {
        specials: [
          {
            id: 'browser',
            accessLevel: AccountRole.User,
            label: drive.string.Drives,
            icon: view.icon.List,
            component: workbench.component.SpecialView,
            componentProps: {
              _class: drive.class.Drive,
              label: drive.string.Drives
            },
            position: 'top'
          }
        ],
        spaces: [
          {
            id: 'drives',
            label: drive.string.Drive,
            spaceClass: drive.class.Drive,
            addSpaceLabel: drive.string.CreateDrive,
            createComponent: drive.component.CreateDrive,
            icon: drive.icon.Drive,
            // intentionally left empty in order to make space presenter working
            specials: []
          }
        ]
      },
      navHeaderComponent: drive.component.DriveSpaceHeader
    },
    drive.app.Drive
  )
}

export function createModel (builder: Builder): void {
  builder.createDoc(
    view.class.ViewletDescriptor,
    core.space.Model,
    {
      label: view.string.Grid,
      icon: view.icon.Table,
      component: drive.component.GridView
    },
    drive.viewlet.Grid
  )

  defineDrive(builder)
  defineResource(builder)
  defineFolder(builder)
  defineFile(builder)
  defineApplication(builder)
}
