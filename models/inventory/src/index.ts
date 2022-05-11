//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
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

import { Doc, Domain, FindOptions, IndexKind, Ref } from '@anticrm/core'
import type { Category, Product, Variant } from '@anticrm/inventory'
import { Builder, Collection, Index, Model, Prop, TypeRef, TypeString, UX } from '@anticrm/model'
import attachment from '@anticrm/model-attachment'
import core, { TAttachedDoc } from '@anticrm/model-core'
import workbench from '@anticrm/model-workbench'
import type {} from '@anticrm/view'
import view from '@anticrm/view'
import inventory from './plugin'
import { createAction } from '@anticrm/model-view'

export const DOMAIN_INVENTORY = 'inventory' as Domain
@Model(inventory.class.Category, core.class.AttachedDoc, DOMAIN_INVENTORY)
@UX(inventory.string.Category, inventory.icon.Categories, undefined, 'name')
export class TCategory extends TAttachedDoc implements Category {
  @Prop(TypeString(), core.string.Name)
  @Index(IndexKind.FullText)
  name!: string
}

@Model(inventory.class.Product, core.class.AttachedDoc, DOMAIN_INVENTORY)
@UX(inventory.string.Product, inventory.icon.Products, undefined, 'name')
export class TProduct extends TAttachedDoc implements Product {
  // We need to declare, to provide property with label
  @Prop(TypeRef(inventory.class.Category), inventory.string.Category)
  declare attachedTo: Ref<Category>

  @Prop(TypeString(), core.string.Name)
  @Index(IndexKind.FullText)
  name!: string

  @Prop(Collection(attachment.class.Photo), attachment.string.Photos)
  photos?: number

  @Prop(Collection(inventory.class.Variant), inventory.string.Variants)
  variants?: number

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments)
  attachments?: number
}

@Model(inventory.class.Variant, core.class.AttachedDoc, DOMAIN_INVENTORY)
@UX(inventory.string.Variant, inventory.icon.Variant, undefined, 'name')
export class TVariant extends TAttachedDoc implements Variant {
  // We need to declare, to provide property with label
  @Prop(TypeRef(inventory.class.Product), inventory.string.Product)
  declare attachedTo: Ref<Product>

  @Prop(TypeString(), core.string.Name)
  @Index(IndexKind.FullText)
  name!: string

  @Prop(TypeString(), inventory.string.SKU)
  @Index(IndexKind.FullText)
  sku!: string
}

export function createModel (builder: Builder): void {
  builder.createModel(TCategory, TProduct, TVariant)

  builder.mixin(inventory.class.Category, core.class.Class, view.mixin.AttributePresenter, {
    presenter: inventory.component.CategoryPresenter
  })

  builder.mixin(inventory.class.Product, core.class.Class, view.mixin.AttributePresenter, {
    presenter: inventory.component.ProductPresenter
  })

  builder.mixin(inventory.class.Variant, core.class.Class, view.mixin.AttributePresenter, {
    presenter: inventory.component.VariantPresenter
  })

  builder.mixin(inventory.class.Variant, core.class.Class, view.mixin.CollectionEditor, {
    editor: inventory.component.Variants
  })

  builder.mixin(inventory.class.Product, core.class.Class, view.mixin.ObjectEditor, {
    editor: inventory.component.EditProduct
  })

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: inventory.class.Product,
    descriptor: view.viewlet.Table,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    options: {
      lookup: { attachedTo: inventory.class.Category }
    } as FindOptions<Doc>,
    config: ['', '$lookup.attachedTo', 'modifiedOn']
  })

  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: inventory.string.Inventory,
      icon: inventory.icon.InventoryApplication,
      hidden: false,
      navigatorModel: {
        specials: [
          {
            id: 'Categories',
            label: inventory.string.Categories,
            icon: inventory.icon.Categories,
            component: inventory.component.Categories
          },
          {
            id: 'Products',
            label: inventory.string.Products,
            icon: inventory.icon.Products,
            component: inventory.component.Products
          }
        ],
        spaces: []
      }
    },
    inventory.app.Inventory
  )

  builder.createDoc(
    view.class.ActionCategory,
    core.space.Model,
    { label: inventory.string.Inventory, visible: true },
    inventory.category.Inventory
  )

  createAction(builder, {
    label: inventory.string.CreateSubcategory,
    icon: inventory.icon.Categories,
    action: inventory.actionImpl.CreateSubcategory,
    input: 'focus',
    category: inventory.category.Inventory,
    target: inventory.class.Category,
    context: {
      mode: ['context', 'browser']
    }
  })
}

export { default } from './plugin'
