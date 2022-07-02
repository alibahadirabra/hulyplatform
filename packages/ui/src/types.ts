//
// Copyright © 2020 Anticrm Platform Contributors.
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
import type { Asset, IntlString } from '@anticrm/platform'
import { /* Metadata, Plugin, plugin, */ Resource /*, Service */ } from '@anticrm/platform'
import { /* getContext, */ SvelteComponent } from 'svelte'

/**
 * Describe a browser URI location parsed to path, query and fragment.
 */
export interface Location {
  path: string[] // A useful path value
  query?: Record<string, string | null> // a value of query parameters, no duplication are supported
  fragment?: string // a value of fragment
}

/**
 * Returns true if locations are equal.
 */
export function areLocationsEqual (loc1: Location, loc2: Location): boolean {
  if (loc1 === loc2) {
    return true
  }
  if (loc1.fragment !== loc2.fragment) {
    return false
  }
  if (loc1.path.length !== loc2.path.length) {
    return false
  }
  if (loc1.path.findIndex((v, i) => v !== loc2.path[i]) >= 0) {
    return false
  }
  const keys1 = Object.keys(loc1.query ?? {})
  const keys2 = Object.keys(loc2.query ?? {})
  if (keys1.length !== keys2.length) {
    return false
  }
  return keys1.findIndex((k) => loc1.query?.[k] !== loc2.query?.[k]) < 0
}

export type AnySvelteComponent = typeof SvelteComponent
export type Component<C extends AnySvelteComponent> = Resource<C>
export type AnyComponent = Resource<AnySvelteComponent>

/**
 * Allow to pass component with some predefined properties.
 * @public
 */
export interface AnySvelteComponentWithProps {
  component: AnySvelteComponent
  props?: Record<string, any>
}

export interface Action {
  label: IntlString
  icon: Asset | AnySvelteComponent
  action: (props: any, ev: Event) => Promise<void>
  inline?: boolean
  link?: string

  // Submenu component
  component?: AnyComponent | AnySvelteComponent
  props?: Record<string, any>

  group?: string
}

export interface IPopupItem {
  _id?: number
  title?: IntlString | undefined
  component?: AnySvelteComponent | undefined
  props?: Object
  selected?: boolean
  action?: Function
}

export interface Tab {
  label: IntlString
  icon?: Asset
  component: AnyComponent
  props: any
}

export type TabModel = Tab[]

export interface TabItem {
  id: string
  label?: string
  labelIntl?: IntlString
  icon?: Asset | AnySvelteComponent
  color?: string
  tooltip?: IntlString
}

export type ButtonKind =
  | 'primary'
  | 'secondary'
  | 'no-border'
  | 'transparent'
  | 'link'
  | 'link-bordered'
  | 'dangerous'
  | 'list'
export type ButtonSize = 'inline' | 'small' | 'medium' | 'large' | 'x-large'
export type ButtonShape = 'rectangle' | 'rectangle-left' | 'rectangle-right' | 'circle' | 'round' | undefined
export type EditStyle = 'editbox' | 'large-style' | 'small-style' | 'search-style' | 'underline'
export interface PopupPositionElement {
  getBoundingClientRect: () => DOMRect
  position?: {
    v: VerticalAlignment
    h: HorizontalAlignment
  }
  kind?: 'submenu'
}

export type PopupPosAlignment = 'right' | 'top' | 'float' | 'account' | 'full' | 'content' | 'middle'

export function isPopupPosAlignment (x: any): x is PopupPosAlignment {
  return (
    typeof x === 'string' &&
    (x === 'right' ||
      x === 'top' ||
      x === 'float' ||
      x === 'account' ||
      x === 'full' ||
      x === 'content' ||
      x === 'middle')
  )
}

export type PopupAlignment = PopupPosAlignment | PopupPositionElement | null

export type TooltipAlignment = 'top' | 'bottom' | 'left' | 'right'
export type VerticalAlignment = 'top' | 'bottom'
export type HorizontalAlignment = 'left' | 'right'

export type IconSize = 'inline' | 'tiny' | 'x-small' | 'small' | 'medium' | 'large' | 'x-large' | 'full'

export interface DateOrShift {
  date?: number
  shift?: number
}

export interface LabelAndProps {
  label?: IntlString
  element?: HTMLElement
  direction?: TooltipAlignment
  component?: AnySvelteComponent | AnyComponent
  props?: any
  anchor?: HTMLElement
  onUpdate?: (result: any) => void
  kind?: 'tooltip' | 'submenu'
}

export interface ListItem {
  _id: string
  label: string
  image?: string
  isSelectable?: boolean
  fontWeight?: 'normal' | 'medium' | 'semi-bold'
  paddingLeft?: number
}

export interface DropdownTextItem {
  id: string
  label: string
}

export interface DropdownIntlItem {
  id: string
  label: IntlString
}

export interface PopupOptions {
  props: Record<string, string | number>
  showOverlay: boolean
  direction: string
  fullSize?: boolean
}
