import { Class, Doc, DocumentQuery, Hierarchy, Ref } from '@hcengineering/core'
import { Asset, getResource, IntlString, Resource } from '@hcengineering/platform'
import { getClient, MessageBox, updateAttribute } from '@hcengineering/presentation'
import {
  AnyComponent,
  AnySvelteComponent,
  closeTooltip,
  isPopupPosAlignment,
  PopupAlignment,
  PopupPosAlignment,
  showPanel,
  showPopup
} from '@hcengineering/ui'
import { Action, ViewContext } from '@hcengineering/view'
import MoveView from './components/Move.svelte'
import { contextStore } from './context'
import view from './plugin'
import { FocusSelection, focusStore, previewDocument, SelectDirection, selectionStore } from './selection'
import { deleteObject } from './utils'

/**
 * Action to be used for copying text to clipboard.
 * In Safari a request to write to the clipboard must be triggered during a user gesture.
 * A call to clipboard.write or clipboard.writeText outside the scope of a user
 * gesture(such as "click" or "touch" event handlers) will result in the immediate
 * rejection of the promise returned by the API call.
 * https://webkit.org/blog/10855/async-clipboard-api/
 *
 *  * Require props:
 * - textProvider - a function that provides text to be copied.
 * - props - additional text provider props.
 */
async function CopyTextToClipboard (
  doc: Doc,
  evt: Event,
  props: {
    textProvider: Resource<(doc: Doc, props?: Record<string, any>) => Promise<string>>
    props?: Record<string, any>
  }
): Promise<void> {
  const getText = await getResource(props.textProvider)
  try {
    // Safari specific behavior
    // see https://bugs.webkit.org/show_bug.cgi?id=222262
    const clipboardItem = new ClipboardItem({
      'text/plain': getText(doc, props.props)
    })
    await navigator.clipboard.write([clipboardItem])
  } catch {
    // Fallback to default clipboard API implementation
    const text = await getText(doc, props.props)
    await navigator.clipboard.writeText(text)
  }
}

function Delete (object: Doc): void {
  showPopup(
    MessageBox,
    {
      label: view.string.DeleteObject,
      message: view.string.DeleteObjectConfirm,
      params: { count: Array.isArray(object) ? object.length : 1 }
    },
    undefined,
    (result?: boolean) => {
      if (result === true) {
        const objs = Array.isArray(object) ? object : [object]
        for (const o of objs) {
          deleteObject(getClient(), o).catch((err) => console.error(err))
        }
      }
    }
  )
}

async function Move (docs: Doc | Doc[]): Promise<void> {
  showPopup(MoveView, { selected: docs })
}

let $focusStore: FocusSelection
focusStore.subscribe((it) => {
  $focusStore = it
})

let $contextStore: ViewContext[]
contextStore.subscribe((it) => {
  $contextStore = it
})

export function select (evt: Event | undefined, offset: 1 | -1 | 0, of?: Doc, direction?: SelectDirection): void {
  closeTooltip()
  if ($focusStore.provider?.select !== undefined) {
    $focusStore.provider?.select(offset, of, direction)
    evt?.preventDefault()
    previewDocument.update((old) => {
      if (old !== undefined) {
        return $focusStore.focus
      }
    })
  }
}

function SelectItem (doc: Doc | undefined, evt: Event): void {
  if (doc !== undefined) {
    selectionStore.update((selection) => {
      const ind = selection.findIndex((it) => it._id === doc._id)
      if (ind === -1) {
        selection.push(doc)
      } else {
        selection.splice(ind, 1)
      }
      return selection
    })
  }
  evt.preventDefault()
}
function SelectItemNone (doc: Doc | undefined, evt: Event): void {
  selectionStore.set([])
  previewDocument.set(undefined)
  evt.preventDefault()
}
function SelectItemAll (doc: Doc | undefined, evt: Event): void {
  const docs = $focusStore.provider?.docs() ?? []
  selectionStore.set(docs)
  previewDocument.set(undefined)
  evt.preventDefault()
}

const MoveUp = (doc: Doc | undefined, evt: Event): void => select(evt, -1, doc, 'vertical')
const MoveDown = (doc: Doc | undefined, evt: Event): void => select(evt, 1, doc, 'vertical')
const MoveLeft = (doc: Doc | undefined, evt: Event): void => select(evt, -1, doc, 'horizontal')
const MoveRight = (doc: Doc | undefined, evt: Event): void => select(evt, 1, doc, 'horizontal')

function ShowActions (doc: Doc | Doc[] | undefined, evt: Event): void {
  evt.preventDefault()

  showPopup(view.component.ActionsPopup, { viewContext: $contextStore[$contextStore.length - 1] }, 'top')
}

function ShowPreview (doc: Doc | undefined, evt: Event): void {
  previewDocument.update((old) => {
    if (old?._id === doc?._id) {
      return undefined
    }
    return doc
  })
  evt.preventDefault()
}

function Open (doc: Doc, evt: Event): void {
  evt.preventDefault()
  showPanel(view.component.EditDoc, doc._id, Hierarchy.mixinOrClass(doc), 'content')
}

/**
 * Quick action for show panel
 * Require props:
 * - component - view.component.EditDoc or another component
 * - element - position
 * - right - some right component
 */
function ShowPanel (
  doc: Doc | Doc[],
  evt: Event,
  props: {
    component?: AnyComponent
    element: PopupPosAlignment
    rightSection?: AnyComponent
  }
): void {
  if (Array.isArray(doc)) {
    console.error('Wrong show Panel parameters')
    return
  }
  evt.preventDefault()
  showPanel(
    props.component ?? view.component.EditDoc,
    doc._id,
    Hierarchy.mixinOrClass(doc),
    props.element ?? 'content',
    props.rightSection
  )
}

/**
 * Quick action for show popup
 * Props:
 * - _id - object id will be placed into
 * - _class - object _class will be placed into
 * - value - object itself will be placed into
 * - values - all docs will be placed into
 * - props - some basic props, will be merged with key, _class, value, values
 */
async function ShowPopup (
  doc: Doc | Doc[],
  evt: Event,
  props: {
    component: AnyComponent
    element?: PopupPosAlignment | Resource<(e?: Event) => PopupAlignment | undefined>
    _id?: string
    _class?: string
    _space?: string
    value?: string
    values?: string
    props?: Record<string, any>
    fillProps?: Record<string, string>
  }
): Promise<void> {
  const docs = Array.isArray(doc) ? doc : doc !== undefined ? [doc] : []
  const element = await getPopupAlignment(props.element, evt)
  evt.preventDefault()
  const cprops = {
    ...(props?.props ?? {})
  }
  for (const [docKey, propKey] of Object.entries(props.fillProps ?? {})) {
    for (const dv of docs) {
      const dvv = (dv as any)[docKey]
      if (dvv !== undefined) {
        ;(cprops as any)[propKey] = dvv
      }
    }
    if (docKey === '_object') {
      ;(cprops as any)[propKey] = docs[0]
    } else if (docKey === '_objects') {
      ;(cprops as any)[propKey] = docs.length === 1 ? docs[0] : docs
    }
  }

  showPopup(props.component, cprops, element)
}

/**
 * Quick action for show popup
 * Props:
 * - attribute - to show editor for specific attribute
 * - props - some basic props, will be merged with key, _class, value, values
 */
async function ShowEditor (
  doc: Doc | Doc[],
  evt: Event,
  props: {
    element?: PopupPosAlignment | Resource<(e?: Event) => PopupAlignment | undefined>
    attribute: string
    props?: Record<string, any>
  }
): Promise<void> {
  const docs = Array.isArray(doc) ? doc : doc !== undefined ? [doc] : []
  evt.preventDefault()
  let cprops = {
    ...(props?.props ?? {})
  }
  if (docs.length === 1) {
    const client = getClient()
    const hierarchy = client.getHierarchy()
    const doc: Doc = docs[0]
    const attribute = hierarchy.getAttribute(doc._class, props.attribute)

    const typeClass = hierarchy.getClass(attribute.type._class)
    const attributeEditorMixin = hierarchy.as(typeClass, view.mixin.AttributeEditor)

    if (attributeEditorMixin === undefined || attributeEditorMixin.popup === undefined) {
      throw new Error(`failed to find editor popup for ${typeClass._id}`)
    }

    const editor: AnySvelteComponent = await getResource(attributeEditorMixin.popup)

    cprops = {
      ...cprops,
      ...{
        value: (doc as any)[props.attribute]
      }
    }
    if (editor !== undefined) {
      console.log('EVT', evt)
      showPopup(
        editor,
        cprops,
        {
          getBoundingClientRect: () => new DOMRect((evt as MouseEvent).clientX, (evt as MouseEvent).clientY)
        },
        (result) => {
          if (result != null) {
            void updateAttribute(client, doc, doc._class, { key: props.attribute, attr: attribute }, result)
          }
        }
      )
    }
  }
}

function UpdateDocument (doc: Doc | Doc[], evt: Event, props: Record<string, any>): void {
  async function update (): Promise<void> {
    if (props?.key !== undefined && props?.value !== undefined) {
      if (Array.isArray(doc)) {
        for (const d of doc) {
          await getClient().update(d, { [props.key]: props.value })
        }
      } else {
        await getClient().update(doc, { [props.key]: props.value })
      }
    }
  }
  if (props?.ask === true) {
    showPopup(
      MessageBox,
      {
        label: props.label ?? view.string.LabelYes,
        message: props.message ?? view.string.LabelYes
      },
      undefined,
      (result: boolean) => {
        if (result) {
          void update()
        }
      }
    )
  } else {
    void update()
  }
}

function ValueSelector (
  doc: Doc | Doc[],
  evt: Event,
  props: {
    action: Action

    attribute: string

    // Class object finder
    _class?: Ref<Class<Doc>>
    query?: DocumentQuery<Doc>
    // Will copy values from selection document to query
    // If set of docs passed, will do $in for values.
    fillQuery?: Record<string, string>

    // A list of fields with matched values to perform action.
    docMatches?: string[]
    searchField?: string

    // Or list of values to select from
    values?: Array<{ icon?: Asset, label: IntlString, id: number | string }>

    placeholder?: IntlString
  }
): void {
  if (props.action.actionPopup !== undefined) {
    showPopup(props.action.actionPopup, { ...props, ...props.action.actionProps, value: doc, width: 'large' }, 'top')
  }
}

async function getPopupAlignment (
  element?: PopupPosAlignment | Resource<(e?: Event) => PopupAlignment | undefined>,
  evt?: Event
): Promise<PopupAlignment | undefined> {
  if (element === undefined) {
    return undefined
  }
  if (isPopupPosAlignment(element)) {
    return element
  }
  try {
    const alignmentGetter: (e?: Event) => PopupAlignment | undefined = await getResource(element)
    return alignmentGetter(evt)
  } catch (e) {
    return element as PopupAlignment
  }
}

/**
 * @public
 */
export const actionImpl = {
  CopyTextToClipboard,
  Delete,
  Move,
  MoveUp,
  MoveDown,
  MoveLeft,
  MoveRight,
  SelectItem,
  SelectItemNone,
  SelectItemAll,
  ShowActions,
  ShowPreview,
  Open,
  UpdateDocument,
  ShowPanel,
  ShowPopup,
  ShowEditor,
  ValueSelector
}
