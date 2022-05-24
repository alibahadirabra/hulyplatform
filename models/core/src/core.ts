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

import {
  Account,
  AnyAttribute,
  ArrOf,
  AttachedDoc,
  Class,
  ClassifierKind,
  Collection,
  Doc,
  Domain,
  DOMAIN_MODEL,
  DOMAIN_BLOB,
  IndexKind,
  Interface,
  Mixin,
  Obj,
  PluginConfiguration,
  Ref,
  RefTo,
  Space,
  Timestamp,
  Type,
  Version,
  BlobData
} from '@anticrm/core'
import { Hidden, Index, Model, Prop, TypeIntlString, TypeRef, TypeString, TypeTimestamp, UX } from '@anticrm/model'
import type { IntlString } from '@anticrm/platform'
import core from './component'

// C O R E
@Model(core.class.Obj, core.class.Obj)
export class TObj implements Obj {
  @Prop(TypeRef(core.class.Class), core.string.ClassLabel)
  @Index(IndexKind.Indexed)
  _class!: Ref<Class<this>>
}

@Model(core.class.Doc, core.class.Obj)
export class TDoc extends TObj implements Doc {
  @Prop(TypeRef(core.class.Doc), core.string.Id)
  // @Index(IndexKind.Indexed) // - automatically indexed by default.
  _id!: Ref<this>

  @Prop(TypeRef(core.class.Space), core.string.Space)
  @Index(IndexKind.Indexed)
  space!: Ref<Space>

  @Prop(TypeTimestamp(), core.string.Modified)
  modifiedOn!: Timestamp

  @Prop(TypeRef(core.class.Account), core.string.ModifiedBy)
  modifiedBy!: Ref<Account>
}

@Model(core.class.AttachedDoc, core.class.Doc)
export class TAttachedDoc extends TDoc implements AttachedDoc {
  @Prop(TypeRef(core.class.Doc), core.string.AttachedTo)
  @Index(IndexKind.Indexed)
  attachedTo!: Ref<Doc>

  @Prop(TypeRef(core.class.Class), core.string.AttachedToClass)
  @Index(IndexKind.Indexed)
  attachedToClass!: Ref<Class<Doc>>

  @Prop(TypeString(), core.string.Collection)
  @Hidden()
  collection!: string
}

@Model(core.class.Class, core.class.Doc, DOMAIN_MODEL)
export class TClass extends TDoc implements Class<Obj> {
  kind!: ClassifierKind

  @Prop(TypeIntlString(), core.string.ClassPropertyLabel)
  label!: IntlString

  extends!: Ref<Class<Obj>>
  domain!: Domain
}

@Model(core.class.Mixin, core.class.Class)
export class TMixin extends TClass implements Mixin<Doc> {}

@Model(core.class.Interface, core.class.Class)
export class TInterface extends TDoc implements Interface<Doc> {
  kind!: ClassifierKind
  label!: IntlString
  extends?: Ref<Interface<Doc>>[]
}

@Model(core.class.Attribute, core.class.Doc, DOMAIN_MODEL)
export class TAttribute extends TDoc implements AnyAttribute {
  attributeOf!: Ref<Class<Obj>>
  name!: string
  type!: Type<any>
  label!: IntlString
  isCustom?: boolean
}

@Model(core.class.Type, core.class.Obj, DOMAIN_MODEL)
export class TType extends TObj implements Type<any> {
  label!: IntlString
}

@UX(core.string.String)
@Model(core.class.TypeString, core.class.Type)
export class TTypeString extends TType {}

@UX(core.string.IntlString)
@Model(core.class.TypeIntlString, core.class.Type)
export class TTypeIntlString extends TType {}

@UX(core.string.Number)
@Model(core.class.TypeNumber, core.class.Type)
export class TTypeNumber extends TType {}

@UX(core.string.Markup)
@Model(core.class.TypeMarkup, core.class.Type)
export class TTypeMarkup extends TType {}

@UX(core.string.Ref)
@Model(core.class.RefTo, core.class.Type)
export class TRefTo extends TType implements RefTo<Doc> {
  to!: Ref<Class<Doc>>
}

@UX(core.string.Collection)
@Model(core.class.Collection, core.class.Type)
export class TCollection extends TType implements Collection<AttachedDoc> {
  of!: Ref<Class<Doc>>
}

@UX(core.string.Array)
@Model(core.class.ArrOf, core.class.Type)
export class TArrOf extends TType implements ArrOf<Doc> {
  of!: Type<Doc>
}

@UX(core.string.Boolean)
@Model(core.class.TypeBoolean, core.class.Type)
export class TTypeBoolean extends TType {}

@UX(core.string.Timestamp)
@Model(core.class.TypeTimestamp, core.class.Type)
export class TTypeTimestamp extends TType {}

@UX(core.string.Date)
@Model(core.class.TypeDate, core.class.Type)
export class TTypeDate extends TType {}

@Model(core.class.Version, core.class.Doc, DOMAIN_MODEL)
export class TVersion extends TDoc implements Version {
  major!: number
  minor!: number
  patch!: number
}

@Model(core.class.PluginConfiguration, core.class.Doc, DOMAIN_MODEL)
export class TPluginConfiguration extends TDoc implements PluginConfiguration {
  pluginId!: string
  transactions!: Ref<Doc>[]
}

@Model(core.class.BlobData, core.class.Doc, DOMAIN_BLOB)
export class TBlobData extends TDoc implements BlobData {
  name!: string
  file!: string
  size!: number
  type!: string
  base64Data!: string
}
