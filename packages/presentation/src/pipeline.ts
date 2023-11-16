import {
  Class,
  Client,
  Doc,
  DocumentQuery,
  FindOptions,
  FindResult,
  Hierarchy,
  ModelDb,
  Ref,
  Tx,
  TxResult,
  WithLookup,
  toFindResult
  WithLookup,
  SearchQuery,
  SearchOptions,
  SearchResult
} from '@hcengineering/core'
import { Resource } from '@hcengineering/platform'

/**
 * @public
 */
export interface PresentationMiddleware {
  next?: PresentationMiddleware

  tx: (tx: Tx) => Promise<TxResult>

  notifyTx: (tx: Tx) => Promise<void>

  findAll: <T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ) => Promise<FindResult<T>>

  findOne: <T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ) => Promise<WithLookup<T> | undefined>

  subscribe: <T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options: FindOptions<T> | undefined,
    refresh: () => void
  ) => Promise<{
    unsubscribe: () => void
    query?: DocumentQuery<T>
    options?: FindOptions<T>
  }>

  close: () => Promise<void>
}

/**
 * @public
 */
export type PresentationMiddlewareCreator = (client: Client, next?: PresentationMiddleware) => PresentationMiddleware

/**
 * @public
 */
export interface PresentationPipeline extends Client, Exclude<PresentationMiddleware, 'next'> {
  close: () => Promise<void>
}

/**
 * @public
 */
export class PresentationPipelineImpl implements PresentationPipeline {
  private head: PresentationMiddleware | undefined

  private constructor (readonly client: Client) {}

  getHierarchy (): Hierarchy {
    return this.client.getHierarchy()
  }

  getModel (): ModelDb {
    return this.client.getModel()
  }

  async notifyTx (tx: Tx): Promise<void> {
    await this.head?.notifyTx(tx)
  }

  static create (client: Client, constructors: PresentationMiddlewareCreator[]): PresentationPipeline {
    const pipeline = new PresentationPipelineImpl(client)
    pipeline.head = pipeline.buildChain(constructors)
    return pipeline
  }

  private buildChain (constructors: PresentationMiddlewareCreator[]): PresentationMiddleware | undefined {
    let current: PresentationMiddleware | undefined
    for (let index = constructors.length - 1; index >= 0; index--) {
      const element = constructors[index]
      current = element(this.client, current)
    }
    return current
  }

  async findAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    return this.head !== undefined
      ? await this.head.findAll(_class, query, options)
      : await this.client.findAll(_class, query, options)
  }

  async searchFulltext (query: SearchQuery, options: SearchOptions): Promise<SearchResult> {
    return await this.client.searchFulltext(query, options)
  }

  async findOne<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<WithLookup<T> | undefined> {
    return this.head !== undefined
      ? await this.head.findOne(_class, query, options)
      : await this.client.findOne(_class, query, options)
  }

  async subscribe<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options: FindOptions<T> | undefined,
    refresh: () => void
  ): Promise<{
      unsubscribe: () => void
      query?: DocumentQuery<T>
      options?: FindOptions<T>
    }> {
    return this.head !== undefined
      ? await this.head.subscribe(_class, query, options, refresh)
      : { unsubscribe: () => {} }
  }

  async tx (tx: Tx): Promise<TxResult> {
    if (this.head === undefined) {
      return await this.client.tx(tx)
    } else {
      return await this.head.tx(tx)
    }
  }

  async close (): Promise<void> {
    await this.head?.close()
  }
}

/**
 * @public
 */
export abstract class BasePresentationMiddleware {
  constructor (protected readonly client: Client, readonly next?: PresentationMiddleware) {}

  async provideNotifyTx (tx: Tx): Promise<void> {
    await this.next?.notifyTx(tx)
  }

  async provideClose (): Promise<void> {
    await this.next?.close()
  }

  async findAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    return await this.provideFindAll(_class, query, options)
  }

  async findOne<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<WithLookup<T> | undefined> {
    return await this.provideFindOne(_class, query, options)
  }

  async subscribe<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options: FindOptions<T> | undefined,
    refresh: () => void
  ): Promise<{
      unsubscribe: () => void
      query?: DocumentQuery<T>
      options?: FindOptions<T>
    }> {
    return await this.provideSubscribe(_class, query, options, refresh)
  }

  protected async provideTx (tx: Tx): Promise<TxResult> {
    if (this.next !== undefined) {
      return await this.next.tx(tx)
    }
    return await this.client.tx(tx)
  }

  protected async provideFindAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    if (this.next !== undefined) {
      return await this.next.findAll(_class, query, options)
    }
    return await this.client.findAll(_class, query, options)
  }

  protected async provideFindOne<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<WithLookup<T> | undefined> {
    if (this.next !== undefined) {
      return await this.next.findOne(_class, query, options)
    }
    return await this.client.findOne(_class, query, options)
  }

  protected async provideSubscribe<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options: FindOptions<T> | undefined,
    refresh: () => void
  ): Promise<{
      unsubscribe: () => void
      query?: DocumentQuery<T>
      options?: FindOptions<T>
    }> {
    if (this.next !== undefined) {
      return await this.next.subscribe(_class, query, options, refresh)
    }
    return { unsubscribe: () => {} }
  }
}

/**
 * @public
 */
export interface PresentationMiddlewareFactory extends Doc {
  createPresentationMiddleware: Resource<PresentationMiddlewareCreator>
}

/**
 * @public
 */
export class OptimizeQueryMiddleware extends BasePresentationMiddleware implements PresentationMiddleware {
  private constructor (client: Client, next?: PresentationMiddleware) {
    super(client, next)
  }

  static create (client: Client, next?: PresentationMiddleware): OptimizeQueryMiddleware {
    return new OptimizeQueryMiddleware(client, next)
  }

  async notifyTx (tx: Tx): Promise<void> {
    await this.provideNotifyTx(tx)
  }

  async close (): Promise<void> {
    return await this.provideClose()
  }

  async tx (tx: Tx): Promise<TxResult> {
    return await this.provideTx(tx)
  }

  async subscribe<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options: FindOptions<T> | undefined,
    refresh: () => void
  ): Promise<{
      unsubscribe: () => void
      query?: DocumentQuery<T>
      options?: FindOptions<T>
    }> {
    return await this.provideSubscribe(_class, query, options, refresh)
  }

  async findAll<T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T> | undefined
  ): Promise<FindResult<T>> {
    if (_class == null || typeof query !== 'object' || ('_class' in query && query._class == null)) {
      console.error('_class must be specified in query', query)
      return toFindResult([], 0)
    }
    return await this.provideFindAll(_class, query, options)
  }
}
