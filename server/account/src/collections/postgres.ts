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
import { QueryResultRow, type Pool } from 'pg'
import { generateId, type Data, type Version } from '@hcengineering/core'

import type {
  DbCollection,
  Query,
  ObjectId,
  Operations,
  Workspace,
  WorkspaceDbCollection,
  WorkspaceInfo,
  WorkspaceOperation,
  AccountDB,
  Account,
  Invite,
  OtpRecord,
  UpgradeStatistic
} from '../types'

export abstract class PostgresDbCollection<T extends Record<string, any>> implements DbCollection<T> {
  constructor (
    readonly name: string,
    readonly client: Pool
  ) {}

  async exists (): Promise<boolean> {
    const tableInfo = await this.client.query(
      `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = $1
    `,
      [this.name]
    )

    return (tableInfo.rowCount ?? 0) > 0
  }

  async init (): Promise<void> {
    // Create tables, indexes, etc.
  }

  protected buildSelectClause (): string {
    return `SELECT * FROM ${this.name}`
  }

  protected buildWhereClause (query: Query<T>, lastRefIdx: number = 0): [string, any[]] {
    const whereChunks: string[] = []
    const values: any[] = []
    let currIdx: number = lastRefIdx

    for (const key of Object.keys(query)) {
      const qKey = query[key]
      const operator = typeof qKey === 'object' ? Object.keys(qKey)[0] : ''
      switch (operator) {
        case '$in': {
          const inVals = Object.values(qKey as object)[0]
          const inVars: string[] = []
          for (const val of inVals) {
            currIdx++
            inVars.push(`$${currIdx}`)
            values.push(val)
          }
          whereChunks.push(`"${key}" IN (${inVars.join(', ')})`)
          break
        }
        case '$lt': {
          currIdx++
          whereChunks.push(`"${key}" < $${currIdx}`)
          values.push(Object.values(qKey as object)[0])
          break
        }
        case '$lte': {
          currIdx++
          whereChunks.push(`"${key}" <= $${currIdx}`)
          values.push(Object.values(qKey as object)[0])
          break
        }
        case '$gt': {
          currIdx++
          whereChunks.push(`"${key}" > $${currIdx}`)
          values.push(Object.values(qKey as object)[0])
          break
        }
        case '$gte': {
          currIdx++
          whereChunks.push(`"${key}" >= $${currIdx}`)
          values.push(Object.values(qKey as object)[0])
          break
        }
        default: {
          currIdx++
          whereChunks.push(`"${key}" = $${currIdx}`)
          values.push(qKey)
        }
      }
    }

    return [`WHERE ${whereChunks.join(' AND ')}`, values]
  }

  protected buildSortClause (sort: { [P in keyof T]?: 'ascending' | 'descending' }): string {
    const sortChunks: string[] = []

    for (const key of Object.keys(sort)) {
      sortChunks.push(`"${key}" ${sort[key] === 'ascending' ? 'ASC' : 'DESC'}`)
    }

    return `ORDER BY ${sortChunks.join(', ')}`
  }

  protected convertToObj (row: QueryResultRow): T {
    return row as T
  }

  async find (query: Query<T>, sort?: { [P in keyof T]?: 'ascending' | 'descending' }, limit?: number): Promise<T[]> {
    const sqlChunks: string[] = [this.buildSelectClause()]
    const [whereClause, whereValues] = this.buildWhereClause(query)

    sqlChunks.push(whereClause)

    if (sort !== undefined) {
      sqlChunks.push(this.buildSortClause(sort))
    }

    if (limit !== undefined) {
      sqlChunks.push(`LIMIT ${limit}`)
    }

    const finalSql: string = sqlChunks.join(' ')
    const result = await this.client.query(finalSql, whereValues)

    return result.rows.map((row) => this.convertToObj(row))
  }

  async findOne (query: Query<T>): Promise<T | null> {
    return (await this.find(query, undefined, 1))[0] ?? null
  }

  async insertOne<K extends keyof T>(data: Partial<T>, idKey?: K): Promise<any> {
    const keys: string[] = idKey !== undefined ? [idKey as any] : []
    keys.push(...Object.keys(data))

    const id = generateId()
    const values: any[] = idKey !== undefined ? [id] : []
    values.push(...Object.values(data))

    const sql = `INSERT INTO ${this.name} (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map((_, idx) => `$${idx + 1}`).join(', ')})`

    await this.client.query(sql, values)

    return id
  }

  protected buildUpdateClause (ops: Operations<T>, lastRefIdx: number = 0): [string, any[]] {
    const updateChunks: string[] = []
    const values: any[] = []
    let currIdx: number = lastRefIdx

    for (const key of Object.keys(ops)) {
      switch (key) {
        case '$inc': {
          const inc = ops.$inc as Partial<T>

          for (const incKey of Object.keys(inc)) {
            currIdx++
            updateChunks.push(`"${incKey}" = "${incKey}" + $${currIdx}`)
            values.push(inc[incKey])
          }
          break
        }
        default: {
          currIdx++
          updateChunks.push(`"${key}" = $${currIdx}`)
          values.push(ops[key])
        }
      }
    }

    return [`SET ${updateChunks.join(', ')}`, values]
  }

  async updateOne (query: Query<T>, ops: Operations<T>): Promise<void> {
    const sqlChunks: string[] = [`UPDATE ${this.name}`]
    const [updateClause, updateValues] = this.buildUpdateClause(ops)
    const [whereClause, whereValues] = this.buildWhereClause(query, updateValues.length)

    sqlChunks.push(updateClause)
    sqlChunks.push(whereClause)

    const finalSql = sqlChunks.join(' ')
    await this.client.query(finalSql, [...updateValues, ...whereValues])
  }

  async deleteMany (query: Query<T>): Promise<void> {
    const sqlChunks: string[] = [`DELETE FROM ${this.name}`]
    const [whereClause, whereValues] = this.buildWhereClause(query)

    sqlChunks.push(whereClause)

    const finalSql = sqlChunks.join(' ')
    await this.client.query(finalSql, whereValues)
  }
}

export class AccountPostgresDbCollection extends PostgresDbCollection<Account> implements DbCollection<Account> {
  constructor (readonly client: Pool) {
    super('account', client)
  }

  async init (): Promise<void> {
    if (await this.exists()) return

    await this.client.query(
      `CREATE TABLE ${this.name} (
        _id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        hash BYTEA,
        salt BYTEA NOT NULL,
        first VARCHAR(255) NOT NULL,
        last VARCHAR(255) NOT NULL,
        admin BOOLEAN,
        confirmed BOOLEAN,
        "lastWorkspace" BIGINT,
        "createdOn" BIGINT NOT NULL,
        "lastVisit" BIGINT,
        "githubId" VARCHAR(100),
        "openId" VARCHAR(100),
        PRIMARY KEY(_id)
      )`
    )

    await this.client.query(`
      CREATE INDEX ${this.name}_email ON ${this.name} ("email")
    `)
  }

  protected buildSelectClause (): string {
    return `SELECT 
      _id, 
      email, 
      hash, 
      salt, 
      first, 
      last, 
      admin, 
      confirmed, 
      "lastWorkspace", 
      "createdOn", 
      "lastVisit", 
      "githubId",
      "openId",
      array(
        SELECT workspace 
        FROM workspace_assignment t 
        WHERE t.account = ${this.name}._id
      ) as workspaces FROM ${this.name}`
  }

  async insertOne<K extends keyof Account>(data: Partial<Account>, idKey?: K): Promise<any> {
    if (data.workspaces !== undefined) {
      if (data.workspaces.length > 0) {
        throw new Error('Cannot assign workspaces directly')
      }

      delete data.workspaces
    }

    return await super.insertOne(data, idKey)
  }
}

export class WorkspacePostgresDbCollection extends PostgresDbCollection<Workspace> implements WorkspaceDbCollection {
  constructor (readonly client: Pool) {
    super('workspace', client)
  }

  async init (): Promise<void> {
    if (await this.exists()) return

    await this.client.query(
      `CREATE TABLE ${this.name} (
        _id VARCHAR(255) NOT NULL,
        workspace VARCHAR(255) NOT NULL,
        disabled BOOLEAN,
        "versionMajor" SMALLINT NOT NULL,
        "versionMinor" SMALLINT NOT NULL,
        "versionPatch" SMALLINT NOT NULL,
        branding VARCHAR(255),
        "workspaceUrl" VARCHAR(255),
        "workspaceName" VARCHAR(255),
        "createdOn" BIGINT NOT NULL,
        "lastVisit" BIGINT,
        "createdBy" VARCHAR(255),
        mode VARCHAR(60),
        progress SMALLINT,
        endpoint VARCHAR(255),
        region VARCHAR(100),
        "lastProcessingTime" BIGINT,
        attempts SMALLINT,
        message VARCHAR(1000),
        "backupInfo" JSONB,
        PRIMARY KEY(_id)
      )`
    )

    await this.client.query(`
      CREATE INDEX ${this.name}_workspace ON ${this.name} ("workspace")
    `)

    // NOTE: as SKIP LOCKED is not supported in Cockroachdb, we need our own skip locked implementation
    await this.client.query(`
      CREATE OR REPLACE FUNCTION is_ws_locked(varchar(255)) RETURNS BOOLEAN AS $$
      DECLARE
          id varchar(255);
          ws_id varchar(255);
          is_locked boolean;
      BEGIN
          ws_id := $1;
          is_locked := FALSE;

          BEGIN
              -- we use FOR UPDATE to attempt a lock and NOWAIT to get the error immediately 
              id := _id FROM public.workspace WHERE _id = ws_id FOR UPDATE NOWAIT;
              EXCEPTION
                  WHEN lock_not_available THEN
                      is_locked := TRUE;
          END;

          RETURN is_locked;

      END;
      $$ LANGUAGE 'plpgsql' VOLATILE COST 100;
    `)
  }

  protected buildSelectClause (): string {
    return `SELECT 
      _id, 
      workspace,
      disabled,
      json_build_object(
          'major', "versionMajor", 
          'minor', "versionMinor", 
          'patch', "versionPatch"
        ) version,
      branding,
      "workspaceUrl",
      "workspaceName",
      "createdOn",
      "lastVisit",
      "createdBy",
      mode,
      progress,
      endpoint,
      region,
      "lastProcessingTime",
      attempts,
      message,
      "backupInfo",
      array(
        SELECT account 
        FROM workspace_assignment t
        WHERE t.workspace = ${this.name}._id
      ) as accounts FROM ${this.name}`
  }

  objectToDb (data: Partial<Workspace>): any {
    const dbData: any = {
      ...data
    }

    if (data.accounts !== undefined) {
      if (data.accounts.length > 0) {
        throw new Error('Cannot assign workspaces directly')
      }

      delete dbData.accounts
    }

    const version = data.version
    if (data.version !== undefined) {
      delete dbData.version
      dbData.versionMajor = version?.major ?? 0
      dbData.versionMinor = version?.minor ?? 0
      dbData.versionPatch = version?.patch ?? 0
    }

    return dbData
  }

  async insertOne<K extends keyof Workspace>(data: Partial<Workspace>, idKey?: K): Promise<any> {
    return await super.insertOne(this.objectToDb(data), idKey)
  }

  async updateOne (query: Query<Workspace>, ops: Operations<Workspace>): Promise<void> {
    await super.updateOne(query, this.objectToDb(ops))
  }

  async countWorkspacesInRegion (region: string, upToVersion?: Data<Version>, visitedSince?: number): Promise<number> {
    const sqlChunks: string[] = [`SELECT COUNT(_id) FROM ${this.name}`]
    const whereChunks: string[] = []
    const values: any[] = []
    let nextValIdx = 1

    whereChunks.push('(disabled = FALSE OR disabled IS NULL)')

    if (upToVersion !== undefined) {
      whereChunks.push(
        '(("versionMajor" < $1) OR ("versionMajor" = $1 AND "versionMinor" < $2) OR ("versionMajor" = $1 AND "versionMinor" = $2 AND "versionPatch" < $3))'
      )
      values.push(...[upToVersion?.major, upToVersion?.minor, upToVersion?.patch])
      nextValIdx = 4
    }

    if (region !== '') {
      whereChunks.push(`region = $${nextValIdx}`)
      values.push(region)
      nextValIdx++
    } else {
      whereChunks.push("(region IS NULL OR region = '')")
    }

    if (visitedSince !== undefined) {
      whereChunks.push(`"lastVisit" > $${nextValIdx}`)
      values.push(visitedSince)
    }

    sqlChunks.push(`WHERE ${whereChunks.join(' AND ')}`)

    const res = await this.client.query(sqlChunks.join(' '), values)

    return res.rows[0].count
  }

  async getPendingWorkspace (
    region: string,
    version: Data<Version>,
    operation: WorkspaceOperation,
    processingTimeoutMs: number
  ): Promise<WorkspaceInfo | undefined> {
    const sqlChunks: string[] = [`SELECT * FROM ${this.name}`]
    const whereChunks: string[] = []
    const values: any[] = []

    const pendingCreationSql = "mode IN ('pending-creation', 'creating')"
    const versionSql =
      '("versionMajor" < $1) OR ("versionMajor" = $1 AND "versionMinor" < $2) OR ("versionMajor" = $1 AND "versionMinor" = $2 AND "versionPatch" < $3)'
    const pendingUpgradeSql = `(((disabled = FALSE OR disabled IS NULL) AND (mode = 'active' OR mode IS NULL) AND ${versionSql} AND "lastVisit" > $4) OR ((disabled = FALSE OR disabled IS NULL) AND mode = 'upgrading'))`
    const operationSql =
      operation === 'create'
        ? pendingCreationSql
        : operation === 'upgrade'
          ? pendingUpgradeSql
          : `(${pendingCreationSql} OR ${pendingUpgradeSql})`
    if (operation === 'upgrade' || operation === 'all') {
      values.push(version.major, version.minor, version.patch, Date.now() - 24 * 60 * 60 * 1000)
    }
    whereChunks.push(operationSql)

    // TODO: support returning pending deletion workspaces when we will actually want
    // to clear them with the worker.

    whereChunks.push('(attempts IS NULL OR attempts <= 3)')
    whereChunks.push('("lastProcessingTime" IS NULL OR "lastProcessingTime" < $5)')
    values.push(Date.now() - processingTimeoutMs)

    if (region !== '') {
      whereChunks.push('region = $6')
      values.push(region)
    } else {
      whereChunks.push("(region IS NULL OR region = '')")
    }

    whereChunks.push('is_ws_locked(_id) = FALSE')

    sqlChunks.push(`WHERE ${whereChunks.join(' AND ')}`)
    sqlChunks.push('ORDER BY "lastVisit" DESC')
    sqlChunks.push('LIMIT 1')

    // We must have all the conditions in the DB query and we cannot filter anything in the code
    // because of possible concurrency between account services.
    // is_ws_locked function locks the retrieved row for update.
    await this.client.query('BEGIN')
    const res = await this.client.query(sqlChunks.join(' '), values)

    if ((res.rowCount ?? 0) > 0) {
      await this.client.query(
        `UPDATE ${this.name} SET attempts = attempts + 1, "lastProcessingTime" = $1 WHERE _id = $2`,
        [Date.now(), res.rows[0]._id]
      )
    }

    await this.client.query('COMMIT')

    return res.rows[0] as WorkspaceInfo
  }
}

export class OtpPostgresDbCollection extends PostgresDbCollection<OtpRecord> implements DbCollection<OtpRecord> {
  constructor (readonly client: Pool) {
    super('otp', client)
  }

  async init (): Promise<void> {
    if (await this.exists()) return

    await this.client.query(
      `CREATE TABLE ${this.name} (
        account VARCHAR(255) NOT NULL REFERENCES account (_id),
        otp VARCHAR(20) NOT NULL,
        expires BIGINT NOT NULL,
        "createdOn" BIGINT NOT NULL,
        PRIMARY KEY(account, otp)
      )`
    )
  }
}

export class InvitePostgresDbCollection extends PostgresDbCollection<Invite> implements DbCollection<Invite> {
  constructor (readonly client: Pool) {
    super('invite', client)
  }

  async init (): Promise<void> {
    if (await this.exists()) return

    await this.client.query(
      `CREATE TABLE ${this.name} (
          _id VARCHAR(255) NOT NULL,
          workspace VARCHAR(255) NOT NULL,
          exp BIGINT NOT NULL,
          "emailMask" VARCHAR(100),
          "limit" SMALLINT,
          role VARCHAR(40),
          "personId" VARCHAR(255),
          PRIMARY KEY(_id)
      )`
    )
  }

  protected buildSelectClause (): string {
    return `SELECT 
      _id, 
      json_build_object(
          'name', "workspace"
        ) workspace,
      exp,
      "emailMask",
      "limit",
      role,
      "personId"
    FROM ${this.name}`
  }

  objectToDb (data: Partial<Invite>): any {
    const dbData: any = {
      ...data
    }

    if (data.workspace !== undefined) {
      dbData.workspace = data.workspace.name
    }

    return dbData
  }

  async insertOne<K extends keyof Invite>(data: Partial<Invite>, idKey?: K): Promise<any> {
    return await super.insertOne(this.objectToDb(data), idKey)
  }

  async updateOne (query: Query<Invite>, ops: Operations<Invite>): Promise<void> {
    await super.updateOne(query, this.objectToDb(ops))
  }
}

export class UpgradePostgresDbCollection
  extends PostgresDbCollection<UpgradeStatistic>
  implements DbCollection<UpgradeStatistic> {
  constructor (readonly client: Pool) {
    super('upgrade', client)
  }

  async init (): Promise<void> {
    if (await this.exists()) return

    await this.client.query(
      `CREATE TABLE ${this.name} (
          region VARCHAR(100) NOT NULL,
          version VARCHAR(100) NOT NULL,
          "startTime" BIGINT NOT NULL,
          total INTEGER NOT NULL,
          "toProcess" INTEGER NOT NULL,
          "lastUpdate" BIGINT,
          PRIMARY KEY(region, version)
      )`
    )
  }
}

export class PostgresAccountDB implements AccountDB {
  readonly wsAssignmentName = 'workspace_assignment'

  workspace: WorkspacePostgresDbCollection
  account: PostgresDbCollection<Account>
  otp: PostgresDbCollection<OtpRecord>
  invite: PostgresDbCollection<Invite>
  upgrade: PostgresDbCollection<UpgradeStatistic>

  constructor (readonly client: Pool) {
    this.workspace = new WorkspacePostgresDbCollection(client)
    this.account = new AccountPostgresDbCollection(client)
    this.otp = new OtpPostgresDbCollection(client)
    this.invite = new InvitePostgresDbCollection(client)
    this.upgrade = new UpgradePostgresDbCollection(client)
  }

  async init (): Promise<void> {
    await Promise.all([this.workspace.init(), this.account.init(), this.upgrade.init()])

    await Promise.all([this.otp.init(), this.invite.init()])

    await this._init()
  }

  async _init (): Promise<void> {
    const tableInfo = await this.client.query(
      `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = $1
    `,
      [this.wsAssignmentName]
    )

    if ((tableInfo.rowCount ?? 0) > 0) {
      return
    }

    await this.client.query(
      `CREATE TABLE ${this.wsAssignmentName} (
          workspace VARCHAR(255) NOT NULL REFERENCES workspace (_id),
          account VARCHAR(255) NOT NULL REFERENCES account (_id),
          PRIMARY KEY(workspace, account)
      )`
    )
  }

  async assignWorkspace (accountId: ObjectId, workspaceId: ObjectId): Promise<void> {
    const sql = `INSERT INTO ${this.wsAssignmentName} (workspace, account) VALUES ($1, $2)`

    await this.client.query(sql, [workspaceId, accountId])
  }

  async unassignWorkspace (accountId: ObjectId, workspaceId: ObjectId): Promise<void> {
    const sql = `DELETE FROM ${this.wsAssignmentName} WHERE workspace = $1 AND account = $2`

    await this.client.query(sql, [workspaceId, accountId])
  }
}
