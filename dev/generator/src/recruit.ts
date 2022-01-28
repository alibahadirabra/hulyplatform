import contact, { Channel, Employee, EmployeeAccount, Person } from '@anticrm/contact'
import core, {
  AttachedData,
  Data,
  generateId,
  MeasureContext,
  MeasureMetricsContext, metricsToString, MixinUpdate, Ref,
  TxOperations
} from '@anticrm/core'
import recruit from '@anticrm/model-recruit'
import { Applicant, Candidate, Vacancy } from '@anticrm/recruit'
import { genRanks, State } from '@anticrm/task'
import faker from 'faker'
import jpeg, { BufferRet } from 'jpeg-js'
import { Client } from 'minio'
import { addAttachments, AttachmentOptions } from './attachments'
import { addComments, CommentOptions } from './comments'
import { connect } from './connect'
import { createUpdateSpaceKanban } from './kanban'
import { findOrUpdate, findOrUpdateAttached } from './utils'
export interface RecruitOptions {
  random: boolean // random id prefix.
  contacts: number // how many contacts to add
  vacancy: number // Will add number of vacancies with applications.
  // Comment generation control
  comments: CommentOptions
  // Attachment generation control
  attachments: AttachmentOptions

  applicants: {
    min: number
    max: number
    applicantUpdateFactor: number
  }
  lite: boolean
}

export async function generateContacts (
  transactorUrl: string,
  dbName: string,
  options: RecruitOptions,
  minio: Client
): Promise<void> {
  const connection = await connect(transactorUrl, dbName)

  const accounts = await connection.findAll(contact.class.EmployeeAccount, {})
  const accountIds = accounts.map((a) => a._id)
  const emoloyeeIds = accounts.map((a) => a.employee)

  const account = faker.random.arrayElement(accounts)

  const client = new TxOperations(connection, account._id)

  const candidates: Ref<Candidate>[] = []

  const ctx = new MeasureMetricsContext('recruit', { contacts: options.contacts })

  for (let i = 0; i < options.contacts; i++) {
    await ctx.with('candidate', {}, (ctx) => genCandidate(ctx, i, minio, dbName, options, candidates, client))
  }
  // Work on Vacancy/Applications.
  for (let i = 0; i < options.vacancy; i++) {
    await ctx.with('vacancy', {}, (ctx) =>
      genVacansyApplicants(ctx, accountIds, options, i, client, minio, dbName, candidates, emoloyeeIds)
    )
  }

  await connection.close()
  ctx.end()

  console.info(metricsToString(ctx.metrics, 'Client'))
}
async function genVacansyApplicants (
  ctx: MeasureContext,
  accountIds: Ref<EmployeeAccount>[],
  options: RecruitOptions,
  i: number,
  client: TxOperations,
  minio: Client,
  dbName: string,
  candidates: Ref<Candidate>[],
  emoloyeeIds: Ref<Employee>[]
): Promise<void> {
  const vacancy: Data<Vacancy> = {
    name: faker.company.companyName(),
    description: faker.lorem.sentences(2),
    fullDescription: faker.lorem.sentences(10),
    location: faker.address.city(),
    company: faker.company.companyName(),
    members: accountIds,
    private: false,
    archived: false
  }
  const vacancyId = (options.random ? `vacancy-${generateId()}-${i}` : `vacancy-genid-${i}`) as Ref<Vacancy>

  console.log('Creating vacandy', vacancy.name)

  // Update or create candidate
  await ctx.with('update', {}, (ctx) =>
    findOrUpdate(ctx, client, core.space.Model, recruit.class.Vacancy, vacancyId, vacancy)
  )

  console.log('Vacandy generated', vacancy.name)

  if (!options.lite) {
    await ctx.with('add-attachments', {}, () =>
      addAttachments(
        options.attachments,
        client,
        minio,
        dbName,
        vacancyId,
        vacancyId,
        recruit.class.Vacancy,
        'attachments'
      )
    )
  }

  console.log('Vacandy attachments generated', vacancy.name)

  const states = await ctx.with('create-kanbad', {}, (ctx) => createUpdateSpaceKanban(ctx, vacancyId, client))

  console.log('States generated', vacancy.name)

  const applicantsForCount = options.applicants.min + faker.datatype.number(options.applicants.max)

  const applicantsFor = faker.random.arrayElements(candidates, applicantsForCount)
  const rankGen = genRanks(candidates.length)
  for (const candidateId of applicantsFor) {
    await ctx.with('applicant', {}, (ctx) =>
      genApplicant(ctx, vacancyId, candidateId, emoloyeeIds, states, client, options, minio, dbName, rankGen)
    )
  }
}

async function genApplicant (
  ctx: MeasureContext,
  vacancyId: Ref<Vacancy>,
  candidateId: Ref<Candidate>,
  emoloyeeIds: Ref<Employee>[],
  states: Ref<State>[],
  client: TxOperations,
  options: RecruitOptions,
  minio: Client,
  dbName: string,
  rankGen: Generator<string, void, unknown>
): Promise<void> {
  const applicantId = `vacancy-${vacancyId}-${candidateId}` as Ref<Applicant>
  const rank = rankGen.next().value

  const applicant: AttachedData<Applicant> = {
    number: faker.datatype.number(),
    assignee: faker.random.arrayElement(emoloyeeIds),
    state: faker.random.arrayElement(states),
    doneState: null,
    rank: rank as string
  }

  // Update or create candidate
  await findOrUpdateAttached(ctx, client, vacancyId, recruit.class.Applicant, applicantId, applicant, {
    attachedTo: candidateId,
    attachedClass: recruit.mixin.Candidate,
    collection: 'applications'
  })

  await ctx.with('add-comment', {}, () =>
    addComments(options.comments, client, vacancyId, applicantId, recruit.class.Vacancy, 'comments')
  )

  if (!options.lite) {
    await ctx.with('add-attachment', {}, () =>
      addAttachments(
        options.attachments,
        client,
        minio,
        dbName,
        vacancyId,
        applicantId,
        recruit.class.Applicant,
        'attachments'
      )
    )
  }

  if (faker.datatype.number(100) > options.applicants.applicantUpdateFactor) {
    await ctx.with('update-collection', {}, () =>
      client.updateCollection(
        recruit.class.Applicant,
        vacancyId,
        applicantId,
        candidateId,
        recruit.class.Applicant,
        'applications',
        {
          state: faker.random.arrayElement(states)
        }
      )
    )
  }
}

const liteAvatar = generateAvatar(0)

// @measure('Candidate')
async function genCandidate (
  ctx: MeasureContext,
  i: number,
  minio: Client,
  dbName: string,
  options: RecruitOptions,
  candidates: Ref<Candidate>[],
  client: TxOperations
): Promise<void> {
  const fName = faker.name.firstName()
  const lName = faker.name.lastName()

  const { imgId, jpegImageData } = options.lite ? liteAvatar : generateAvatar(i)

  if (!options.lite) {
    await ctx.with('avatar', {}, () =>
      minio.putObject(dbName, imgId, jpegImageData.data, jpegImageData.data.length, { 'Content-Type': 'image/jpeg' })
    )
  }
  const candidate: Data<Person> = {
    name: fName + ',' + lName,
    city: faker.address.city(),
    avatar: imgId
  }

  const candidateMixin: MixinUpdate<Person, Candidate> = {
    title: faker.name.title(),
    onsite: faker.datatype.boolean(),
    remote: faker.datatype.boolean(),
    source: faker.lorem.lines(1)
  }

  const candidateId = (options.random ? `candidate-${generateId()}-${i}` : `candidate-genid-${i}`) as Ref<Candidate>
  candidates.push(candidateId)
  const channelId = (options.random ? `channel-${generateId()}-${i}` : `channel-genid-${i}`) as Ref<Channel>

  // Update or create candidate
  await ctx.with('find-update', {}, async () => {
    await findOrUpdate(ctx, client, recruit.space.CandidatesPublic, contact.class.Person, candidateId, candidate)
    await findOrUpdateAttached(ctx, client, recruit.space.CandidatesPublic, contact.class.Channel, channelId, {
      provider: contact.channelProvider.Email,
      value: faker.internet.email(fName, lName)
    }, {
      attachedTo: candidateId,
      attachedClass: contact.class.Person,
      collection: 'channels'
    })
    await client.updateMixin(candidateId, contact.class.Person, recruit.space.CandidatesPublic, recruit.mixin.Candidate, candidateMixin)
  })

  await ctx.with('add-comment', {}, () =>
    addComments(
      options.comments,
      client,
      recruit.space.CandidatesPublic,
      candidateId,
      contact.class.Person,
      'comments'
    )
  )

  if (!options.lite) {
    await ctx.with('add-attachment', {}, () =>
      addAttachments(
        options.attachments,
        client,
        minio,
        dbName,
        recruit.space.CandidatesPublic,
        candidateId,
        contact.class.Person,
        'attachments'
      )
    )
  }
  console.log('Candidate', candidates.length, fName, lName, ' generated')
}

function generateAvatar (pos: number): { imgId: string, jpegImageData: BufferRet } {
  const imgId = generateId()
  const width = 128
  const height = 128
  const frameData = Buffer.alloc(width * height * 4)
  let i = 0

  const baseR = faker.datatype.number(255)
  const baseG = faker.datatype.number(255)
  const baseB = faker.datatype.number(255)

  while (i < frameData.length) {
    frameData[i++] = (baseR + faker.datatype.number(100)) % 255 // red
    frameData[i++] = (baseG + faker.datatype.number(100)) % 255 // green
    frameData[i++] = (baseB + faker.datatype.number(100)) % 255 // blue
    frameData[i++] = 0xff // alpha - ignored in JPEGs
  }
  const rawImageData = {
    data: frameData,
    width: width,
    height: height
  }
  const jpegImageData = jpeg.encode(rawImageData, 50)
  return { imgId, jpegImageData }
}
