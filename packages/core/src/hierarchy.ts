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

import { FindOptions, Lookup, ToClassRefT, WithLookup } from '.'
import type { AnyAttribute, Class, Classifier, Doc, Domain, Interface, Mixin, Obj, Ref } from './classes'
import { ClassifierKind } from './classes'
import core from './component'
import { _createMixinProxy, _mixinClass, _toDoc } from './proxy'
import type { Tx, TxCreateDoc, TxMixin, TxRemoveDoc, TxUpdateDoc } from './tx'
import { TxProcessor } from './tx'

/**
 * @public
 */
export class Hierarchy {
  private readonly classifiers = new Map<Ref<Classifier>, Classifier>()
  private readonly attributes = new Map<Ref<Classifier>, Map<string, AnyAttribute>>()
  private readonly attributesById = new Map<Ref<AnyAttribute>, AnyAttribute>()
  private readonly descendants = new Map<Ref<Classifier>, Ref<Classifier>[]>()
  private readonly ancestors = new Map<Ref<Classifier>, Ref<Classifier>[]>()
  private readonly proxies = new Map<Ref<Mixin<Doc>>, ProxyHandler<Doc>>()

  private createMixinProxyHandler (mixin: Ref<Mixin<Doc>>): ProxyHandler<Doc> {
    const value = this.getClass(mixin)
    const ancestor = this.getClass(value.extends as Ref<Class<Obj>>)
    const ancestorProxy = ancestor.kind === ClassifierKind.MIXIN ? this.getMixinProxyHandler(ancestor._id) : null
    return _createMixinProxy(value, ancestorProxy)
  }

  private getMixinProxyHandler (mixin: Ref<Mixin<Doc>>): ProxyHandler<Doc> {
    const handler = this.proxies.get(mixin)
    if (handler === undefined) {
      const handler = this.createMixinProxyHandler(mixin)
      this.proxies.set(mixin, handler)
      return handler
    }
    return handler
  }

  as<D extends Doc, M extends D>(doc: D, mixin: Ref<Mixin<M>>): M {
    return new Proxy(doc, this.getMixinProxyHandler(mixin)) as M
  }

  static toDoc<D extends Doc>(doc: D): D {
    return _toDoc(doc)
  }

  static mixinClass<D extends Doc, M extends D>(doc: D): Ref<Mixin<M>> | undefined {
    return _mixinClass(doc)
  }

  static mixinOrClass<D extends Doc, M extends D>(doc: D): Ref<Mixin<M> | Class<Doc>> {
    const m = _mixinClass(doc)
    return m ?? doc._class
  }

  hasMixin<D extends Doc, M extends D>(doc: D, mixin: Ref<Mixin<M>>): boolean {
    const d = Hierarchy.toDoc(doc)
    return typeof (d as any)[mixin] === 'object'
  }

  isMixin (_class: Ref<Class<Doc>>): boolean {
    const data = this.classifiers.get(_class)
    return data !== undefined && this._isMixin(data)
  }

  getAncestors (_class: Ref<Classifier>): Ref<Classifier>[] {
    const result = this.ancestors.get(_class)
    if (result === undefined) {
      throw new Error('ancestors not found: ' + _class)
    }
    return result
  }

  getClass (_class: Ref<Class<Obj>>): Class<Obj> {
    const data = this.classifiers.get(_class)
    if (data === undefined || this.isInterface(data)) {
      throw new Error('class not found: ' + _class)
    }
    return data
  }

  getInterface (_interface: Ref<Interface<Doc>>): Interface<Doc> {
    const data = this.classifiers.get(_interface)
    if (data === undefined || !this.isInterface(data)) {
      throw new Error('interface not found: ' + _interface)
    }
    return data
  }

  getDomain (_class: Ref<Class<Obj>>): Domain {
    const klazz = this.getClass(_class)
    if (klazz.domain !== undefined) {
      return klazz.domain
    }
    klazz.domain = this.findDomain(klazz)
    return klazz.domain
  }

  private findDomain (klazz: Class<Doc>): Domain {
    let _klazz = klazz
    while (_klazz.extends !== undefined) {
      _klazz = this.getClass(_klazz.extends)
      if (_klazz.domain !== undefined) {
        return _klazz.domain
      }
    }
    throw new Error(`domain not found: ${klazz._id} `)
  }

  tx (tx: Tx): void {
    switch (tx._class) {
      case core.class.TxCreateDoc:
        this.txCreateDoc(tx as TxCreateDoc<Doc>)
        return
      case core.class.TxUpdateDoc:
        this.txUpdateDoc(tx as TxUpdateDoc<Doc>)
        return
      case core.class.TxRemoveDoc:
        this.txRemoveDoc(tx as TxRemoveDoc<Doc>)
        return
      case core.class.TxMixin:
        this.txMixin(tx as TxMixin<Doc, Doc>)
    }
  }

  private txCreateDoc (tx: TxCreateDoc<Doc>): void {
    if (
      tx.objectClass === core.class.Class ||
      tx.objectClass === core.class.Interface ||
      tx.objectClass === core.class.Mixin
    ) {
      const _id = tx.objectId as Ref<Classifier>
      this.classifiers.set(_id, TxProcessor.createDoc2Doc(tx as TxCreateDoc<Classifier>))
      this.addAncestors(_id)
      this.addDescendant(_id)
    } else if (tx.objectClass === core.class.Attribute) {
      const createTx = tx as TxCreateDoc<AnyAttribute>
      this.addAttribute(TxProcessor.createDoc2Doc(createTx))
    }
  }

  private txUpdateDoc (tx: TxUpdateDoc<Doc>): void {
    if (tx.objectClass === core.class.Attribute) {
      const updateTx = tx as TxUpdateDoc<AnyAttribute>
      const doc = this.attributesById.get(updateTx.objectId)
      if (doc === undefined) return
      this.addAttribute(TxProcessor.updateDoc2Doc(doc, updateTx))
    }
  }

  private txRemoveDoc (tx: TxRemoveDoc<Doc>): void {
    if (tx.objectClass === core.class.Attribute) {
      const removeTx = tx as TxRemoveDoc<AnyAttribute>
      const doc = this.attributesById.get(removeTx.objectId)
      if (doc === undefined) return
      const map = this.attributes.get(doc.attributeOf)
      map?.delete(doc.name)
      this.attributesById.delete(removeTx.objectId)
    }
  }

  private txMixin (tx: TxMixin<Doc, Doc>): void {
    if (this.isDerived(tx.objectClass, core.class.Class)) {
      const obj = this.getClass(tx.objectId as Ref<Class<Obj>>) as any
      TxProcessor.updateMixin4Doc(obj, tx.mixin, tx.attributes)
    }
  }

  /**
   * Check if passed _class is derived from `from` class.
   * It will iterave over parents.
   */
  isDerived<T extends Obj>(_class: Ref<Class<T>>, from: Ref<Class<T>>): boolean {
    let cl: Ref<Class<T>> | undefined = _class
    while (cl !== undefined) {
      if (cl === from) return true
      cl = this.getClass(cl).extends
    }
    return false
  }

  /**
   * Return first non interface/mixin parent
   */
  getBaseClass<T extends Doc>(_class: Ref<Mixin<T>>): Ref<Class<T>> {
    let cl: Ref<Class<T>> | undefined = _class
    while (cl !== undefined) {
      const clz = this.getClass(cl)
      if (this.isClass(clz)) return cl
      cl = clz.extends
    }
    return core.class.Doc
  }

  /**
   * Check if passed _class implements passed interfaces `from`.
   * It will check for class parents and they interfaces.
   */
  isImplements<T extends Doc>(_class: Ref<Class<T>>, from: Ref<Interface<T>>): boolean {
    let cl: Ref<Class<T>> | undefined = _class
    while (cl !== undefined) {
      const klazz = this.getClass(cl)
      if (this.isExtends(klazz.implements ?? [], from)) {
        return true
      }
      cl = klazz.extends
    }
    return false
  }

  /**
   * Check if interface is extends passed interface.
   */
  private isExtends<T extends Doc>(extendsOrImplements: Ref<Interface<Doc>>[], from: Ref<Interface<T>>): boolean {
    const result: Ref<Interface<Doc>>[] = []
    const toVisit = [...extendsOrImplements]
    while (toVisit.length > 0) {
      const ref = toVisit.shift() as Ref<Interface<Doc>>
      if (ref === from) {
        return true
      }
      addIf(result, ref)
      toVisit.push(...this.ancestorsOf(ref))
    }
    return false
  }

  getDescendants<T extends Obj>(_class: Ref<Class<T>>): Ref<Class<Obj>>[] {
    const data = this.descendants.get(_class)
    if (data === undefined) {
      throw new Error('descendants not found: ' + _class)
    }
    return data
  }

  private addDescendant (_class: Ref<Classifier>): void {
    const hierarchy = this.getAncestors(_class)
    for (const cls of hierarchy) {
      const list = this.descendants.get(cls)
      if (list === undefined) {
        this.descendants.set(cls, [_class])
      } else {
        list.push(_class)
      }
    }
  }

  private addAncestors (_class: Ref<Classifier>): void {
    const cl: Ref<Classifier>[] = [_class]
    const visited = new Set<Ref<Classifier>>()
    while (cl.length > 0) {
      const classifier = cl.shift() as Ref<Classifier>
      if (addNew(visited, classifier)) {
        const list = this.ancestors.get(_class)
        if (list === undefined) {
          this.ancestors.set(_class, [classifier])
        } else {
          addIf(list, classifier)
        }
        cl.push(...this.ancestorsOf(classifier))
      }
    }
  }

  /**
   * Return extends and implemnets as combined list of references
   */
  private ancestorsOf (classifier: Ref<Classifier>): Ref<Classifier>[] {
    const attrs = this.classifiers.get(classifier)
    const result: Ref<Classifier>[] = []
    if (this.isClass(attrs) || this._isMixin(attrs)) {
      const cls = attrs as Class<Doc>
      if (cls.extends !== undefined) {
        result.push(cls.extends)
      }
      result.push(...(cls.implements ?? []))
    }
    if (this.isInterface(attrs)) {
      result.push(...((attrs as Interface<Doc>).extends ?? []))
    }
    return result
  }

  private isClass (attrs?: Classifier): boolean {
    return attrs?.kind === ClassifierKind.CLASS
  }

  private _isMixin (attrs?: Classifier): boolean {
    return attrs?.kind === ClassifierKind.MIXIN
  }

  private isInterface (attrs?: Classifier): boolean {
    return attrs?.kind === ClassifierKind.INTERFACE
  }

  private addAttribute (attribute: AnyAttribute): void {
    const _class = attribute.attributeOf
    let attributes = this.attributes.get(_class)
    if (attributes === undefined) {
      attributes = new Map<string, AnyAttribute>()
      this.attributes.set(_class, attributes)
    }
    attributes.set(attribute.name, attribute)
    this.attributesById.set(attribute._id, attribute)
  }

  getAllAttributes (clazz: Ref<Classifier>, to?: Ref<Classifier>): Map<string, AnyAttribute> {
    const result = new Map<string, AnyAttribute>()
    let ancestors = this.getAncestors(clazz)
    if (to !== undefined) {
      const toAncestors = this.getAncestors(to)
      for (const uto of toAncestors) {
        if (ancestors.includes(uto)) {
          to = uto
          break
        }
      }
      ancestors = ancestors.filter(
        (c) => c !== to && (this.isInterface(this.classifiers.get(c)) || this.isDerived(c, to as Ref<Class<Doc>>))
      )
    }

    for (let index = ancestors.length - 1; index >= 0; index--) {
      const cls = ancestors[index]
      const attributes = this.attributes.get(cls)
      if (attributes !== undefined) {
        for (const [name, attr] of attributes) {
          result.set(name, attr)
        }
      }
    }

    return result
  }

  getAttribute (classifier: Ref<Classifier>, name: string): AnyAttribute {
    const attr = this.findAttribute(classifier, name)
    if (attr === undefined) {
      throw new Error('attribute not found: ' + name)
    }
    return attr
  }

  private findAttribute (classifier: Ref<Classifier>, name: string): AnyAttribute | undefined {
    const list = [classifier]
    const visited = new Set<Ref<Classifier>>()
    while (list.length > 0) {
      const cl = list.shift() as Ref<Classifier>
      if (addNew(visited, cl)) {
        const attribute = this.attributes.get(cl)?.get(name)
        if (attribute !== undefined) {
          return attribute
        }
        // Check ancestorsOf
        list.push(...this.ancestorsOf(cl))
      }
    }
  }

  updateLookupMixin<T extends Doc>(
    _class: Ref<Class<T>>,
    result: WithLookup<T>,
    options?: FindOptions<T>
  ): WithLookup<T> {
    const baseClass = this.getBaseClass(_class)
    const vResult = baseClass !== _class ? this.as(result, _class) : result
    const lookup = result.$lookup
    if (lookup !== undefined) {
      // We need to check if lookup type is mixin and cast to it if required.
      const lu = options?.lookup as Lookup<Doc>
      if (lu?._id !== undefined) {
        for (const [k, v] of Object.entries(lu._id)) {
          const _cl = getClass(v as ToClassRefT<T, keyof T>)
          if (this.isMixin(_cl)) {
            const mval = (lookup as any)[k]
            if (mval !== undefined) {
              if (Array.isArray(mval)) {
                ;(lookup as any)[k] = mval.map((it) => this.as(it, _cl))
              } else {
                ;(lookup as any)[k] = this.as(mval, _cl)
              }
            }
          }
        }
      }
      for (const [k, v] of Object.entries(lu ?? {})) {
        if (k === '_id') {
          continue
        }
        const _cl = getClass(v as ToClassRefT<T, keyof T>)
        if (this.isMixin(_cl)) {
          const mval = (lookup as any)[k]
          if (mval != null) {
            ;(lookup as any)[k] = this.as(mval, _cl)
          }
        }
      }
    }
    return vResult
  }

  clone (obj: any): any {
    if (typeof obj === 'function') {
      return obj
    }
    const result: any = Array.isArray(obj) ? [] : {}
    for (const key in obj) {
      // include prototype properties
      const value = obj[key]
      const type = {}.toString.call(value).slice(8, -1)
      if (type === 'Array') {
        result[key] = this.clone(value)
      }
      if (type === 'Object') {
        const m = Hierarchy.mixinClass(value)
        const valClone = this.clone(value)
        result[key] = m !== undefined ? this.as(valClone, m) : valClone
      } else if (type === 'Date') {
        result[key] = new Date(value.getTime())
      } else {
        result[key] = value
      }
    }
    return result
  }

  domains (): Domain[] {
    const classes = Array.from(this.classifiers.values()).filter(
      (it) => this.isClass(it) || this._isMixin(it)
    ) as Class<Doc>[]
    return (classes.map((it) => it.domain).filter((it) => it !== undefined) as Domain[]).filter(
      (it, idx, array) => array.findIndex((pt) => pt === it) === idx
    )
  }
}

function addNew<T> (val: Set<T>, value: T): boolean {
  if (val.has(value)) {
    return false
  }
  val.add(value)
  return true
}

function addIf<T> (array: T[], value: T): void {
  if (!array.includes(value)) {
    array.push(value)
  }
}

function getClass<T extends Doc> (vvv: ToClassRefT<T, keyof T>): Ref<Class<T>> {
  if (Array.isArray(vvv)) {
    return vvv[0]
  }
  return vvv
}
