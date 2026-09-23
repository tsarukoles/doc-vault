export class LoginPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.goto('/login');
  }

  async submit(username) {
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }
}
