import { test } from '@playwright/test'
import { PlatformUser, PlatformURILiveness, checkIfUrlContains } from '../utils'
import { LoginPage } from '../model/login-page'
import { SelectWorkspacePage } from '../model/select-workspace-page'
import { CommonTrackerPage } from '../model/tracker/common-tracker-page'
import { TrackerNavigationMenuPage } from '../model/tracker/tracker-navigation-menu-page'
import { SignUpPage } from '../model/signup-page'

test.describe('login test @livness ', () => {
  let loginPage: LoginPage
  let commonTrackerPage: CommonTrackerPage
  let signupPage: SignUpPage
  let trackerNavigationMenuPage: TrackerNavigationMenuPage
  let selectWorkspacePage: SelectWorkspacePage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    commonTrackerPage = new CommonTrackerPage(page)
    signupPage = new SignUpPage(page)
    trackerNavigationMenuPage = new TrackerNavigationMenuPage(page)
    selectWorkspacePage = new SelectWorkspacePage(page)
    await loginPage.goto(PlatformURILiveness)
  })

  test('check login', async () => {
    await loginPage.goto(PlatformURILiveness)
    await loginPage.login(PlatformUser, '1234')
    await selectWorkspacePage.selectWorkspace('Jasmin Workspace')
    await commonTrackerPage.checkIfMainPanelIsVisible()
    await trackerNavigationMenuPage.checkIfTrackerSidebarIsVisible()
  })

  test('check login with wrong user and if the button is disabled ', async ({ page }) => {
    await loginPage.goto(PlatformURILiveness)
    await loginPage.checkIfLoginButtonIsDissaabled()
    await loginPage.login(PlatformUser, 'wrong-password')
    await loginPage.checkIfErrorMessageIsShown()
  })

  test('check if user is able to go to to recovery, then login and then signup', async ({ page }) => {
    await loginPage.goto(PlatformURILiveness)
    await checkIfUrlContains(page, '/login')
    await loginPage.checkIfLoginButtonIsDissaabled()
    await loginPage.clickOnRecover()
    await checkIfUrlContains(page, '/password')
    await loginPage.checkIfPasswordRecoveryIsVisible()
    await loginPage.clickOnRecoveryLogin()
    await checkIfUrlContains(page, '/login')
    await loginPage.checkIfLoginButtonIsDissaabled()
    await loginPage.clickOnRecover()
    await loginPage.clickOnRecoverySignUp()
    await signupPage.checkIfSignUpButtonIsDisabled()
    await checkIfUrlContains(page, '/signup')
  })
})
