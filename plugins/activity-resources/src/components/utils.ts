import type { TxViewlet } from '@anticrm/activity'
import core, {
  AttachedDoc,
  Class,
  Collection,
  Doc,
  Ref,
  TxCollectionCUD,
  TxCreateDoc,
  TxCUD,
  TxMixin,
  TxOperations,
  TxProcessor,
  TxUpdateDoc
} from '@anticrm/core'
import { Asset, IntlString, translate } from '@anticrm/platform'
import { AnyComponent, AnySvelteComponent } from '@anticrm/ui'
import { AttributeModel } from '@anticrm/view'
import { buildModel, getObjectPresenter } from '@anticrm/view-resources'
import { ActivityKey, activityKey, DisplayTx } from '../activity'
import activity from '../plugin'

export type TxDisplayViewlet =
  | (Pick<TxViewlet, 'icon' | 'label' | 'display' | 'editable' | 'hideOnRemove' | 'labelComponent' | 'labelParams'> & {
    component?: AnyComponent | AnySvelteComponent
    pseudo: boolean
  })
  | undefined

async function createPseudoViewlet (
  client: TxOperations,
  dtx: DisplayTx,
  label: IntlString,
  display: 'inline' | 'content' | 'emphasized' = 'inline'
): Promise<TxDisplayViewlet> {
  const doc = dtx.doc
  if (doc === undefined) {
    return
  }
  const docClass: Class<Doc> = client.getModel().getObject(doc._class)

  let trLabel = await translate(docClass.label, {})
  if (dtx.collectionAttribute !== undefined) {
    const itemLabel = (dtx.collectionAttribute.type as Collection<AttachedDoc>).itemLabel
    if (itemLabel !== undefined) {
      trLabel = await translate(itemLabel, {})
    }
  }

  // Check if it is attached doc and collection have title override.
  const presenter = await getObjectPresenter(client, doc._class, { key: 'doc-presenter' })
  if (presenter !== undefined) {
    let collection = ''
    if (dtx.collectionAttribute?.label !== undefined) {
      collection = await translate(dtx.collectionAttribute.label, {})
    }
    return {
      display,
      icon: docClass.icon ?? activity.icon.Activity,
      label: label,
      labelParams: {
        _class: trLabel,
        collection
      },
      component: presenter.presenter,
      pseudo: true
    }
  }
}

export function getDTxProps (dtx: DisplayTx): any {
  return { tx: dtx.tx, value: dtx.doc }
}

function getViewlet (viewlets: Map<ActivityKey, TxViewlet>, dtx: DisplayTx): TxDisplayViewlet | undefined {
  let key: string
  if (dtx.mixinTx?.mixin !== undefined && dtx.tx._id === dtx.mixinTx._id) {
    key = activityKey(dtx.mixinTx.mixin, dtx.tx._class)
  } else {
    key = activityKey(dtx.tx.objectClass, dtx.tx._class)
  }
  const vl = viewlets.get(key)
  if (vl !== undefined) {
    return { ...vl, pseudo: false }
  }
}

export async function updateViewlet (
  client: TxOperations,
  viewlets: Map<ActivityKey, TxViewlet>,
  dtx: DisplayTx
): Promise<{
    viewlet: TxDisplayViewlet
    id: Ref<TxCUD<Doc>>
    model: AttributeModel[]
    props: any
    modelIcon: Asset | undefined
  }> {
  let viewlet = getViewlet(viewlets, dtx)

  let props = getDTxProps(dtx)
  let model: AttributeModel[] = []
  let modelIcon: Asset | undefined

  if (viewlet === undefined) {
    ;({ viewlet, model } = await checkInlineViewlets(dtx, viewlet, client, model))
    // Only value is necessary for inline viewlets
    props = { value: dtx.doc }
    if (model !== undefined) {
      // Check for State attribute
      for (const a of model) {
        if (a.icon !== undefined) {
          modelIcon = a.icon
          break
        }
      }
    }
  }
  return { viewlet, id: dtx.tx._id, model, props, modelIcon }
}

async function checkInlineViewlets (
  dtx: DisplayTx,
  viewlet: TxDisplayViewlet,
  client: TxOperations,
  model: AttributeModel[]
): Promise<{ viewlet: TxDisplayViewlet, model: AttributeModel[] }> {
  if (dtx.collectionAttribute !== undefined && (dtx.txDocIds?.size ?? 0) > 1) {
    // Check if we have a class presenter we could have a pseudo viewlet based on class presenter.
    viewlet = await createPseudoViewlet(client, dtx, activity.string.CollectionUpdated, 'content')
  } else if (dtx.tx._class === core.class.TxCreateDoc) {
    // Check if we have a class presenter we could have a pseudo viewlet based on class presenter.
    viewlet = await createPseudoViewlet(client, dtx, activity.string.DocCreated)
  } else if (dtx.tx._class === core.class.TxRemoveDoc) {
    viewlet = await createPseudoViewlet(client, dtx, activity.string.DocDeleted)
  } else if (dtx.tx._class === core.class.TxUpdateDoc || dtx.tx._class === core.class.TxMixin) {
    model = await createUpdateModel(dtx, client, model)
  }
  return { viewlet, model }
}

async function createUpdateModel (
  dtx: DisplayTx,
  client: TxOperations,
  model: AttributeModel[]
): Promise<AttributeModel[]> {
  if (dtx.updateTx !== undefined) {
    const _class = dtx.updateTx.objectClass
    const ops = {
      client,
      _class,
      keys: Object.entries(dtx.updateTx.operations)
        .flatMap(([id, val]) => (['$push', '$pull'].includes(id) ? Object.keys(val) : id))
        .filter((id) => !id.startsWith('$')),
      ignoreMissing: true
    }
    const hiddenAttrs = getHiddenAttrs(client, _class)
    model = (await buildModel(ops)).filter((x) => !hiddenAttrs.has(x.key))
  } else if (dtx.mixinTx !== undefined) {
    const _class = dtx.mixinTx.mixin
    const ops = {
      client,
      _class,
      keys: Object.keys(dtx.mixinTx.attributes).filter((id) => !id.startsWith('$')),
      ignoreMissing: true
    }
    const hiddenAttrs = getHiddenAttrs(client, _class)
    model = (await buildModel(ops)).filter((x) => !hiddenAttrs.has(x.key))
  }
  return model
}

function getHiddenAttrs (client: TxOperations, _class: Ref<Class<Doc>>): Set<string> {
  return new Set(
    [...client.getHierarchy().getAllAttributes(_class).entries()]
      .filter(([, attr]) => attr.hidden === true)
      .map(([k]) => k)
  )
}

function getModifiedAttributes (tx: DisplayTx): any[] {
  if (tx.tx._class === core.class.TxUpdateDoc) {
    return ([tx.tx, ...tx.txes.map(({ tx }) => tx)] as unknown as Array<TxUpdateDoc<Doc>>).map(
      ({ operations }) => operations
    )
  }
  if (tx.tx._class === core.class.TxMixin) {
    return ([tx.tx, ...tx.txes.map(({ tx }) => tx)] as unknown as Array<TxMixin<Doc, Doc>>).map(
      ({ attributes }) => attributes
    )
  }
  return [{}]
}

async function buildRemovedDoc (client: TxOperations, objectId: Ref<Doc>): Promise<Doc | undefined> {
  const txes = await client.findAll(core.class.TxCUD, { objectId }, { sort: { modifiedOn: 1 } })
  let doc: Doc
  let createTx = txes.find((tx) => tx._class === core.class.TxCreateDoc)
  if (createTx === undefined) {
    const collectionTxes = txes.filter((tx) => tx._class === core.class.TxCollectionCUD) as Array<
    TxCollectionCUD<Doc, AttachedDoc>
    >
    createTx = collectionTxes.find((p) => p.tx._class === core.class.TxCreateDoc)
  }
  if (createTx === undefined) return
  doc = TxProcessor.createDoc2Doc(createTx as TxCreateDoc<Doc>)
  for (const tx of txes) {
    if (tx._class === core.class.TxUpdateDoc) {
      doc = TxProcessor.updateDoc2Doc(doc, tx as TxUpdateDoc<Doc>)
    } else if (tx._class === core.class.TxMixin) {
      const mixinTx = tx as TxMixin<Doc, Doc>
      doc = TxProcessor.updateMixin4Doc(doc, mixinTx.mixin, mixinTx.attributes)
    }
  }
  return doc
}

async function getAllRealValues (client: TxOperations, values: any[], _class: Ref<Class<Doc>>): Promise<any[]> {
  if (!client.getHierarchy().isDerived(_class, core.class.Doc) || values.some((value) => typeof value !== 'string')) {
    return values
  }
  const realValues = await client.findAll(_class, { _id: { $in: values } })
  const realValuesIds = realValues.map(({ _id }) => _id)
  return [
    ...realValues,
    ...(await Promise.all(
      values
        .filter((value) => !realValuesIds.includes(value))
        .map(async (value) => await buildRemovedDoc(client, value))
    ))
  ].filter((v) => v != null)
}

export async function getValue (client: TxOperations, m: AttributeModel, tx: DisplayTx): Promise<any> {
  function combineAttributes (attributes: any[], key: string, operator: string, arrayKey: string): any[] {
    return Array.from(
      new Set(
        attributes.flatMap((attr) =>
          Array.isArray(attr[operator]?.[key]?.[arrayKey]) ? attr[operator]?.[key]?.[arrayKey] : attr[operator]?.[key]
        )
      )
    ).filter((v) => v != null)
  }
  const utxs = getModifiedAttributes(tx)
  const value = {
    set: utxs[0][m.key],
    added: await getAllRealValues(client, combineAttributes(utxs, m.key, '$push', '$each'), m._class),
    removed: await getAllRealValues(client, combineAttributes(utxs, m.key, '$pull', '$in'), m._class)
  }
  if (value.set !== undefined) {
    ;[value.set] = await getAllRealValues(client, [value.set], m._class)
  }
  return value
}

export function filterCollectionTxes (txes: DisplayTx[]): DisplayTx[] {
  return txes.map(filterCollectionTx).filter(Boolean) as DisplayTx[]
}

function filterCollectionTx (tx: DisplayTx): DisplayTx | undefined {
  if (tx.collectionAttribute === undefined) return tx
  const txes = tx.txes.reduceRight(
    (txes, ctx) => {
      const filtredTxes = txes.filter(
        ({ tx: { _class }, doc }) => doc?._id !== ctx.doc?._id || _class === core.class.TxUpdateDoc
      )
      return ctx.tx._class === core.class.TxUpdateDoc || filtredTxes.length === txes.length
        ? [ctx, ...txes]
        : filtredTxes
    },
    [tx]
  )
  const txDocIds = txes.map(({ doc }) => doc?._id).filter(Boolean) as Array<Ref<Doc>>
  const ctx = txes.pop()
  if (ctx !== undefined) {
    ctx.txes = txes
    ctx.txDocIds = new Set(txDocIds)
  }
  return ctx
}
