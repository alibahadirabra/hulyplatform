import faker from 'faker'

import contact from '@hcengineering/contact'
import core, {
  TxOperations,
  MeasureMetricsContext,
  metricsToString,
  AttachedData,
  generateId,
  Ref,
  SortingOrder
} from '@hcengineering/core'
import tracker, { calcRank, Issue, IssuePriority, IssueStatus } from '../../../plugins/tracker/lib'

import { connect } from './connect'

let objectId: Ref<Issue> = generateId()
const space = tracker.team.DefaultTeam

const object: AttachedData<Issue> = {
  title: '',
  description: '',
  assignee: null,
  project: null,
  sprint: null,
  number: 0,
  rank: '',
  status: '' as Ref<IssueStatus>,
  priority: IssuePriority.NoPriority,
  dueDate: null,
  comments: 0,
  subIssues: 0,
  parents: [],
  reportedTime: 0,
  estimation: 0,
  reports: 0,
  childInfo: []
}

export interface IssueOptions {
  count: number // how many issues to add
}

export async function generateIssues (transactorUrl: string, dbName: string, options: IssueOptions): Promise<void> {
  const connection = await connect(transactorUrl, dbName)
  const accounts = await connection.findAll(contact.class.EmployeeAccount, {})
  const account = faker.random.arrayElement(accounts)
  const client = new TxOperations(connection, account._id)
  const ctx = new MeasureMetricsContext('recruit', {})

  for (let index = 0; index < options.count; index++) {
    console.log(`Generating issue ${index + 1}...`)
    await genIssue(client)
  }

  await connection.close()
  ctx.end()

  console.info(metricsToString(ctx.metrics, 'Client'))
}

async function genIssue (client: TxOperations): Promise<void> {
  const lastOne = await client.findOne<Issue>(
    tracker.class.Issue,
    { status: object.status },
    { sort: { rank: SortingOrder.Descending } }
  )
  const incResult = await client.updateDoc(
    tracker.class.Team,
    core.space.Space,
    space,
    {
      $inc: { sequence: 1 }
    },
    true
  )
  const value: AttachedData<Issue> = {
    title: faker.name.title(),
    description: faker.lorem.paragraphs(),
    assignee: object.assignee,
    project: object.project,
    sprint: object.sprint,
    number: (incResult as any).object.sequence,
    status: object.status,
    priority: object.priority,
    rank: calcRank(lastOne, undefined),
    comments: 0,
    subIssues: 0,
    dueDate: object.dueDate,
    parents: [],
    reportedTime: 0,
    estimation: object.estimation,
    reports: 0,
    relations: [],
    childInfo: []
  }
  await client.addCollection(
    tracker.class.Issue,
    space,
    tracker.ids.NoParent,
    tracker.class.Issue,
    'subIssues',
    value,
    objectId
  )
  objectId = generateId()
}
