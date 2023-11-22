import { test } from '@playwright/test'
import { generateId, PlatformSetting, PlatformSettingSecond, PlatformURI } from '../utils'
import { allure } from 'allure-playwright'
import { NewIssue } from '../model/tracker/types'
import { IssuesPage } from '../model/tracker/issues-page'
import { IssuesDetailsPage } from '../model/tracker/issues-details-page'
import { LeftSideMenuPage } from '../model/left-side-menu-page'

test.use({
  storageState: PlatformSetting
})

test.describe('Collaborative test for issue', () => {
  test.beforeEach(async ({ page }) => {
    await allure.parentSuite('Collaborative test')
    await (await page.goto(`${PlatformURI}/workbench/sanity-ws/tracker/`))?.finished()
  })

  test('Issues can be assigned to another users', async ({ page, browser }) => {
    const newIssue: NewIssue = {
      title: 'Collaborative test for issue',
      description: 'Collaborative test for issue',
      status: 'Backlog',
      priority: 'Urgent',
      assignee: 'Appleseed John',
      createLabel: true,
      labels: `CREATE-ISSUE-${generateId()}`,
      component: 'No component',
      estimation: '2',
      milestone: 'No Milestone',
      duedate: 'today',
      filePath: 'cat.jpeg'
    }

    await (await page.goto(`${PlatformURI}/workbench/sanity-ws/tracker/`))?.finished()

    const issuesPage = new IssuesPage(page)
    await issuesPage.createNewIssue(newIssue)
    await issuesPage.linkSidebarAll.click()
    await issuesPage.modelSelectorAll.click()
    await issuesPage.searchIssueByName(newIssue.title)
    await issuesPage.openIssueByName(newIssue.title)

    // check by another user
    const userSecondContext = await browser.newContext({ storageState: PlatformSettingSecond })
    const userSecondPage = await userSecondContext.newPage()
    await (await userSecondPage.goto(`${PlatformURI}/workbench/sanity-ws/tracker/`))?.finished()

    const issuesPageSecond = new IssuesPage(userSecondPage)
    await issuesPageSecond.linkSidebarAll.click()
    await issuesPageSecond.modelSelectorAll.click()
    await issuesPageSecond.searchIssueByName(newIssue.title)
    await issuesPageSecond.openIssueByName(newIssue.title)

    const issuesDetailsPageSecond = new IssuesDetailsPage(userSecondPage)
    await issuesDetailsPageSecond.checkIssue({
      ...newIssue,
      milestone: 'Milestone',
      estimation: '2h'
    })
  })

  test('Issues status can be changed by another users', async ({ page, browser }) => {
    const issue: NewIssue = {
      title: 'Issues status can be changed by another users',
      description: 'Collaborative test for issue'
    }

    await (await page.goto(`${PlatformURI}/workbench/sanity-ws/tracker/`))?.finished()
    const issuesPage = new IssuesPage(page)
    await issuesPage.linkSidebarAll.click()
    await issuesPage.modelSelectorBacklog.click()
    await issuesPage.searchIssueByName(issue.title)
    await issuesPage.openIssueByName(issue.title)

    const issuesDetailsPage = new IssuesDetailsPage(page)
    await issuesDetailsPage.editIssue({ status: 'In Progress' })

    // check by another user
    const userSecondContext = await browser.newContext({ storageState: PlatformSettingSecond })
    const userSecondPage = await userSecondContext.newPage()
    await (await userSecondPage.goto(`${PlatformURI}/workbench/sanity-ws/tracker/`))?.finished()

    const issuesPageSecond = new IssuesPage(userSecondPage)
    await issuesPageSecond.linkSidebarAll.click()
    await issuesPageSecond.modelSelectorActive.click()
    // not active for another user
    await issuesPageSecond.checkIssueNotExist(issue.title)

    await issuesPageSecond.modelSelectorAll.click()
    await issuesPageSecond.searchIssueByName(issue.title)
    await issuesPageSecond.openIssueByName(issue.title)

    const issuesDetailsPageSecond = new IssuesDetailsPage(userSecondPage)
    await issuesDetailsPageSecond.checkIssue({
      ...issue,
      status: 'In Progress'
    })
  })

  test('First user change assignee, second user should see assigned issue', async ({ page, browser }) => {
    const issue: NewIssue = {
      title: 'First user change assignee, second user should see assigned issue',
      description: 'Issue for collaborative test'
    }

    await (await page.goto(`${PlatformURI}/workbench/sanity-ws/tracker/`))?.finished()
    const issuesPage = new IssuesPage(page)
    await issuesPage.linkSidebarAll.click()
    await issuesPage.modelSelectorBacklog.click()
    await issuesPage.searchIssueByName(issue.title)
    await issuesPage.openIssueByName(issue.title)

    const issuesDetailsPage = new IssuesDetailsPage(page)
    await issuesDetailsPage.editIssue({ assignee: 'Dirak Kainin' })

    // check by another user
    const userSecondContext = await browser.newContext({ storageState: PlatformSettingSecond })
    const userSecondPage = await userSecondContext.newPage()

    // check notification
    const leftSideMenuPage = new LeftSideMenuPage(page)
    await leftSideMenuPage.buttonNotification.click()

    // check issue
    await (await userSecondPage.goto(`${PlatformURI}/workbench/sanity-ws/tracker/`))?.finished()

    const issuesPageSecond = new IssuesPage(userSecondPage)
    await issuesPageSecond.linkSidebarMyIssue.click()
    await issuesPageSecond.modelSelectorActive.click()

    await issuesPageSecond.modelSelectorAll.click()
    await issuesPageSecond.searchIssueByName(issue.title)
    await issuesPageSecond.openIssueByName(issue.title)

    const issuesDetailsPageSecond = new IssuesDetailsPage(userSecondPage)
    await issuesDetailsPageSecond.checkIssue({
      ...issue,
      status: 'In Progress'
    })
  })
})
