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

import core, {
  AttachedDoc,
  Class,
  Client,
  Collection,
  Doc,
  Hierarchy,
  Lookup,
  Obj,
  Ref,
  RefTo,
  TxOperations
} from '@anticrm/core'
import type { IntlString } from '@anticrm/platform'
import { getResource } from '@anticrm/platform'
import { getAttributePresenterClass, KeyedAttribute } from '@anticrm/presentation'
import { AnyComponent, ErrorPresenter, getCurrentLocation, getPlatformColorForText, locationToUrl } from '@anticrm/ui'
import type { BuildModelOptions, Viewlet } from '@anticrm/view'
import view, { AttributeModel, BuildModelKey } from '@anticrm/view'
import plugin from './plugin'

/**
 * Define some properties to be used to show component until data is properly loaded.
 */
export interface LoadingProps {
  length: number
}

/**
 * @public
 */
export async function getObjectPresenter (
  client: Client,
  _class: Ref<Class<Obj>>,
  preserveKey: BuildModelKey,
  isCollectionAttr: boolean = false
): Promise<AttributeModel> {
  const hierarchy = client.getHierarchy()
  const mixin = isCollectionAttr ? view.mixin.CollectionPresenter : view.mixin.AttributePresenter
  const clazz = hierarchy.getClass(_class)
  let mixinClazz = hierarchy.getClass(_class)
  let presenterMixin = hierarchy.as(clazz, mixin)
  while (presenterMixin.presenter === undefined && mixinClazz.extends !== undefined) {
    presenterMixin = hierarchy.as(mixinClazz, mixin)
    mixinClazz = hierarchy.getClass(mixinClazz.extends)
  }
  if (presenterMixin.presenter === undefined) {
    throw new Error(
      `object presenter not found for class=${_class}, mixin=${mixin}, preserve key ${JSON.stringify(preserveKey)}`
    )
  }
  const presenter = await getResource(presenterMixin.presenter)
  const key = preserveKey.sortingKey ?? preserveKey.key
  const sortingKey = Array.isArray(key)
    ? key
    : clazz.sortingKey !== undefined
      ? key.length > 0
        ? key + '.' + clazz.sortingKey
        : clazz.sortingKey
      : key
  return {
    key: preserveKey.key,
    _class,
    label: preserveKey.label ?? clazz.label,
    presenter,
    props: preserveKey.props,
    sortingKey,
    collectionAttr: isCollectionAttr
  }
}

/**
 * @public
 */
export async function getObjectPreview (client: Client, _class: Ref<Class<Obj>>): Promise<AnyComponent | undefined> {
  const clazz = client.getHierarchy().getClass(_class)
  const presenterMixin = client.getHierarchy().as(clazz, view.mixin.PreviewPresenter)
  if (presenterMixin.presenter === undefined) {
    if (clazz.extends !== undefined) {
      return await getObjectPreview(client, clazz.extends)
    }
  }
  return presenterMixin?.presenter
}

async function getAttributePresenter (
  client: Client,
  _class: Ref<Class<Obj>>,
  key: string,
  preserveKey: BuildModelKey
): Promise<AttributeModel> {
  const hierarchy = client.getHierarchy()
  const attribute = hierarchy.getAttribute(_class, key)
  const presenterClass = getAttributePresenterClass(hierarchy, attribute)
  const isCollectionAttr = presenterClass.category === 'collection'
  const mixin = isCollectionAttr ? view.mixin.CollectionPresenter : view.mixin.AttributePresenter
  const clazz = hierarchy.getClass(presenterClass.attrClass)
  let presenterMixin = hierarchy.as(clazz, mixin)
  let parent = clazz.extends
  while (presenterMixin.presenter === undefined && parent !== undefined) {
    const pclazz = hierarchy.getClass(parent)
    presenterClass.attrClass = parent
    presenterMixin = hierarchy.as(pclazz, mixin)
    parent = pclazz.extends
  }
  if (presenterMixin.presenter === undefined) {
    throw new Error('attribute presenter not found for ' + JSON.stringify(preserveKey))
  }
  const resultKey = preserveKey.sortingKey ?? preserveKey.key
  const sortingKey = Array.isArray(resultKey)
    ? resultKey
    : attribute.type._class === core.class.ArrOf
      ? resultKey + '.length'
      : resultKey
  const presenter = await getResource(presenterMixin.presenter)

  return {
    key: preserveKey.key,
    sortingKey,
    _class: presenterClass.attrClass,
    label: preserveKey.label ?? attribute.shortLabel ?? attribute.label,
    presenter,
    props: {},
    icon: presenterMixin.icon,
    attribute,
    collectionAttr: isCollectionAttr
  }
}

export async function getPresenter<T extends Doc> (
  client: Client,
  _class: Ref<Class<T>>,
  key: BuildModelKey,
  preserveKey: BuildModelKey,
  lookup?: Lookup<T>,
  isCollectionAttr: boolean = false
): Promise<AttributeModel> {
  if (key.presenter !== undefined) {
    const { presenter, label, sortingKey } = key
    return {
      key: key.key ?? '',
      sortingKey: sortingKey ?? '',
      _class,
      label: label as IntlString,
      presenter: await getResource(presenter),
      props: key.props,
      collectionAttr: isCollectionAttr
    }
  }
  if (key.key.length === 0) {
    return await getObjectPresenter(client, _class, preserveKey, isCollectionAttr)
  } else {
    if (key.key.startsWith('$lookup')) {
      if (lookup === undefined) {
        throw new Error(`lookup class does not provided for ${key.key}`)
      }
      return await getLookupPresenter(client, _class, key, preserveKey, lookup)
    }
    return await getAttributePresenter(client, _class, key.key, preserveKey)
  }
}

function getKeyLookup<T extends Doc> (
  hierarchy: Hierarchy,
  _class: Ref<Class<T>>,
  key: string,
  lookup: Lookup<T>,
  lastIndex: number = 1
): Lookup<T> {
  if (!key.startsWith('$lookup')) return lookup
  const parts = key.split('.')
  const attrib = parts[1]
  const attribute = hierarchy.getAttribute(_class, attrib)
  if (hierarchy.isDerived(attribute.type._class, core.class.RefTo)) {
    const lookupClass = (attribute.type as RefTo<Doc>).to
    const index = key.indexOf('$lookup', lastIndex)
    if (index === -1) {
      if ((lookup as any)[attrib] === undefined) {
        ;(lookup as any)[attrib] = lookupClass
      }
    } else {
      let nested = Array.isArray((lookup as any)[attrib]) ? (lookup as any)[attrib][1] : {}
      nested = getKeyLookup(hierarchy, lookupClass, key.slice(index), nested)
      ;(lookup as any)[attrib] = [lookupClass, nested]
    }
  } else if (hierarchy.isDerived(attribute.type._class, core.class.Collection)) {
    if ((lookup as any)._id === undefined) {
      ;(lookup as any)._id = {}
    }
    ;(lookup as any)._id[attrib] = (attribute.type as Collection<AttachedDoc>).of
  }
  return lookup
}

export function buildConfigLookup<T extends Doc> (
  hierarchy: Hierarchy,
  _class: Ref<Class<T>>,
  config: Array<BuildModelKey | string>
): Lookup<T> {
  let res: Lookup<T> = {}
  for (const key of config) {
    if (typeof key === 'string') {
      res = getKeyLookup(hierarchy, _class, key, res)
    } else {
      res = getKeyLookup(hierarchy, _class, key.key, res)
    }
  }
  return res
}

export async function buildModel (options: BuildModelOptions): Promise<AttributeModel[]> {
  // eslint-disable-next-line array-callback-return
  const model = options.keys
    .map((key) => (typeof key === 'string' ? { key: key } : key))
    .map(async (key) => {
      try {
        return await getPresenter(options.client, options._class, key, key, options.lookup)
      } catch (err: any) {
        if (options.ignoreMissing ?? false) {
          return undefined
        }
        const stringKey = key.label ?? key.key
        console.error('Failed to find presenter for', key, err)
        const errorPresenter: AttributeModel = {
          key: '',
          sortingKey: '',
          presenter: ErrorPresenter,
          label: stringKey as IntlString,
          _class: core.class.TypeString,
          props: { error: err },
          collectionAttr: false
        }
        return errorPresenter
      }
    })
  return (await Promise.all(model)).filter((a) => a !== undefined) as AttributeModel[]
}

export async function deleteObject (client: TxOperations, object: Doc): Promise<void> {
  if (client.getHierarchy().isDerived(object._class, core.class.AttachedDoc)) {
    const adoc = object as AttachedDoc
    await client
      .removeCollection(object._class, object.space, adoc._id, adoc.attachedTo, adoc.attachedToClass, adoc.collection)
      .catch((err) => console.error(err))
  } else {
    await client.removeDoc(object._class, object.space, object._id).catch((err) => console.error(err))
  }
}

export function getMixinStyle (id: Ref<Class<Doc>>, selected: boolean): string {
  const color = getPlatformColorForText(id as string)
  return `
    color: ${selected ? '#fff' : 'var(--theme-caption-color)'};
    background: ${color + (selected ? 'ff' : '33')};
    border: 1px solid ${color + (selected ? '0f' : '66')};
  `
}

async function getLookupPresenter<T extends Doc> (
  client: Client,
  _class: Ref<Class<T>>,
  key: BuildModelKey,
  preserveKey: BuildModelKey,
  lookup: Lookup<T>
): Promise<AttributeModel> {
  const lookupClass = getLookupClass(key.key, lookup, _class)
  const lookupProperty = getLookupProperty(key.key)
  const lookupKey = { ...key, key: lookupProperty[0] }
  const model = await getPresenter(client, lookupClass[0], lookupKey, preserveKey, undefined, lookupClass[2])
  model.label = getLookupLabel(client, lookupClass[1], lookupClass[0], lookupKey, lookupProperty[1])
  return model
}

export function getLookupLabel<T extends Doc> (
  client: Client,
  _class: Ref<Class<T>>,
  lookupClass: Ref<Class<Doc>>,
  key: BuildModelKey,
  attrib: string
): IntlString {
  if (key.label !== undefined) return key.label
  if (key.key === '') {
    try {
      const attribute = client.getHierarchy().getAttribute(_class, attrib)
      return attribute.label
    } catch {}
    const clazz = client.getHierarchy().getClass(lookupClass)
    return clazz.label
  } else {
    const attribute = client.getHierarchy().getAttribute(lookupClass, key.key)
    return attribute.label
  }
}

export function getLookupClass<T extends Doc> (
  key: string,
  lookup: Lookup<T>,
  parent: Ref<Class<T>>
): [Ref<Class<Doc>>, Ref<Class<Doc>>, boolean] {
  const _class = getLookup(key, lookup, parent)
  if (_class === undefined) {
    throw new Error('lookup class does not provided for ' + key)
  }
  return _class
}

export function getLookupProperty (key: string): [string, string] {
  const parts = key.split('$lookup')
  const lastPart = parts[parts.length - 1]
  const split = lastPart.split('.').filter((p) => p.length > 0)
  const prev = split.shift() ?? ''
  const result = split.join('.')
  return [result, prev]
}

function getLookup (
  key: string,
  lookup: Lookup<any>,
  parent: Ref<Class<Doc>>
): [Ref<Class<Doc>>, Ref<Class<Doc>>, boolean] | undefined {
  const parts = key.split('$lookup.').filter((p) => p.length > 0)
  const currentKey = parts[0].split('.').filter((p) => p.length > 0)[0]
  const current = (lookup as any)[currentKey]
  const nestedKey = parts.slice(1).join('$lookup.')
  if (nestedKey.length > 0) {
    if (!Array.isArray(current)) {
      return
    }
    return getLookup(nestedKey, current[1], current[0])
  }
  if (Array.isArray(current)) {
    return [current[0], parent, false]
  }
  if (current === undefined && lookup._id !== undefined) {
    const reverse = (lookup._id as any)[currentKey]
    return reverse !== undefined
      ? Array.isArray(reverse)
        ? [reverse[0], parent, true]
        : [reverse, parent, true]
      : undefined
  }
  return current !== undefined ? [current, parent, false] : undefined
}

export function getBooleanLabel (value: boolean | undefined): IntlString {
  if (value === true) return plugin.string.LabelYes
  if (value === false) return plugin.string.LabelNo
  return plugin.string.LabelNA
}
export function getCollectionCounter (hierarchy: Hierarchy, object: Doc, key: KeyedAttribute): number {
  if (hierarchy.isMixin(key.attr.attributeOf)) {
    return (hierarchy.as(object, key.attr.attributeOf) as any)[key.key]
  }
  return (object as any)[key.key] ?? 0
}

function filterKeys (hierarchy: Hierarchy, keys: KeyedAttribute[], ignoreKeys: string[]): KeyedAttribute[] {
  const docKeys: Set<string> = new Set<string>(hierarchy.getAllAttributes(core.class.AttachedDoc).keys())
  keys = keys.filter((k) => !docKeys.has(k.key))
  keys = keys.filter((k) => !ignoreKeys.includes(k.key))
  return keys
}

export function getFiltredKeys (
  hierarchy: Hierarchy,
  objectClass: Ref<Class<Doc>>,
  ignoreKeys: string[],
  to?: Ref<Class<Doc>>
): KeyedAttribute[] {
  const keys = [...hierarchy.getAllAttributes(objectClass, to).entries()]
    .filter(([, value]) => value.hidden !== true)
    .map(([key, attr]) => ({ key, attr }))

  return filterKeys(hierarchy, keys, ignoreKeys)
}

export function collectionsFilter (
  hierarchy: Hierarchy,
  keys: KeyedAttribute[],
  get: boolean,
  include: string[]
): KeyedAttribute[] {
  const result: KeyedAttribute[] = []
  for (const key of keys) {
    if (include.includes(key.key)) {
      result.push(key)
    } else if (isCollectionAttr(hierarchy, key) === get) {
      result.push(key)
    }
  }
  return result
}

export function isCollectionAttr (hierarchy: Hierarchy, key: KeyedAttribute): boolean {
  return hierarchy.isDerived(key.attr.type._class, core.class.Collection)
}

function makeViewletKey (): string {
  const loc = getCurrentLocation()
  loc.fragment = undefined
  loc.query = undefined
  return 'viewlet' + locationToUrl(loc)
}

export function setActiveViewletId (viewletId: Ref<Viewlet> | null): void {
  const key = makeViewletKey()
  if (viewletId !== null) {
    localStorage.setItem(key, viewletId)
  } else {
    localStorage.removeItem(key)
  }
}

export function getActiveViewletId (): Ref<Viewlet> | null {
  const key = makeViewletKey()
  return localStorage.getItem(key) as Ref<Viewlet> | null
}

function makeViewOptionsKey (viewletId: Ref<Viewlet>): string {
  const loc = getCurrentLocation()
  loc.fragment = undefined
  loc.query = undefined
  return `viewOptions:${viewletId}:${locationToUrl(loc)}`
}

export function setViewOptions (viewletId: Ref<Viewlet>, options: string | null): void {
  const key = makeViewOptionsKey(viewletId)
  if (options !== null) {
    localStorage.setItem(key, options)
  } else {
    localStorage.removeItem(key)
  }
}

export function getViewOptions (viewletId: Ref<Viewlet>): string | null {
  const key = makeViewOptionsKey(viewletId)
  return localStorage.getItem(key)
}
