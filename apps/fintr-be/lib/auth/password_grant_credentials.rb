# frozen_string_literal: true

module Auth
  # Resource Owner Password Grant and refresh flows must use the same Auth0
  # application credentials as login (M2M app), not the SPA signup client.
  module PasswordGrantCredentials
    TOKEN_SCOPE = "openid profile email read:current_user read:users read:transactions offline_access"

    module_function

    def fetch
      {
        auth0_domain: ENV["M2M_AUTH0_DOMAIN"],
        client_id: ENV["M2M_AUTH0_CLIENT_ID"],
        client_secret: ENV["M2M_AUTH0_CLIENT_SECRET"],
        audience: ENV["AUTH0_AUDIENCE"]
      }
    end

    def configured?
      creds = fetch
      creds[:auth0_domain].present? &&
        creds[:client_id].present? &&
        creds[:client_secret].present?
    end
  end
end
