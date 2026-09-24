# frozen_string_literal: true

module Auth
  # Local/dev credentials so Playwright can sign in to the personal workspace
  # without Google OAuth. Password grant is configured on Auth0 for this email.
  module PlaywrightPersonalWorkspace
    DEFAULT_EMAIL = "miguel.dagatan@gmail.com"
    DEFAULT_PASSWORD = "FintrPlaywright!Personal2026"
    SPACE_CODE = "miguel-dagatan-gmail-com-personal-space"

    module_function

    def email
      ENV["E2E_PERSONAL_EMAIL"].presence || DEFAULT_EMAIL
    end

    def password
      ENV["E2E_PERSONAL_PASSWORD"].presence || DEFAULT_PASSWORD
    end
  end
end
