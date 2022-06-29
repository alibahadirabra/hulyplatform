import { IntlString } from '@anticrm/platform'
import { writable } from 'svelte/store'
import type { AnyComponent, AnySvelteComponent, LabelAndProps, TooltipAlignment } from './types'

const emptyTooltip: LabelAndProps = {
  label: undefined,
  element: undefined,
  direction: undefined,
  component: undefined,
  props: undefined,
  anchor: undefined,
  onUpdate: undefined,
  kind: 'tooltip'
}
let storedValue: LabelAndProps = emptyTooltip
export const tooltipstore = writable<LabelAndProps>(emptyTooltip)

export function tooltip (node: HTMLElement, options?: LabelAndProps): any {
  let toHandler: any
  if (options === undefined) {
    return {}
  }
  let opt = options
  const show = (): void => {
    const shown = !!(storedValue.label !== undefined || storedValue.component !== undefined)
    if (!shown) {
      if (opt.kind !== 'submenu') {
        clearTimeout(toHandler)
        toHandler = setTimeout(() => {
          showTooltip(opt.label, node, opt.direction, opt.component, opt.props, opt.anchor, opt.onUpdate, opt.kind)
        }, 250)
      } else {
        showTooltip(opt.label, node, opt.direction, opt.component, opt.props, opt.anchor, opt.onUpdate, opt.kind)
      }
    }
  }
  const hide = (): void => {
    clearTimeout(toHandler)
  }
  node.addEventListener('mouseleave', hide)
  node.addEventListener('mousemove', show)
  return {
    update (options: LabelAndProps) {
      opt = options
      const shown = !!(storedValue.label !== undefined || storedValue.component !== undefined)
      if (shown) {
        showTooltip(opt.label, node, opt.direction, opt.component, opt.props, opt.anchor, opt.onUpdate, opt.kind)
      }
    },

    destroy () {
      node.removeEventListener('mousemove', show)
      node.removeEventListener('mouseleave', hide)
    }
  }
}

export function showTooltip (
  label: IntlString | undefined,
  element: HTMLElement,
  direction?: TooltipAlignment,
  component?: AnySvelteComponent | AnyComponent,
  props?: any,
  anchor?: HTMLElement,
  onUpdate?: (result: any) => void,
  kind?: 'tooltip' | 'submenu'
): void {
  storedValue = {
    label: label,
    element: element,
    direction: direction,
    component: component,
    props: props,
    anchor: anchor,
    onUpdate: onUpdate,
    kind: kind ?? 'tooltip'
  }
  tooltipstore.set(storedValue)
}

export function closeTooltip (): void {
  storedValue = emptyTooltip
  tooltipstore.set(emptyTooltip)
}
