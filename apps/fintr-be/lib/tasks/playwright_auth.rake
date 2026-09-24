# frozen_string_literal: true

namespace :playwright do
  desc "Reset the Auth0 password Playwright uses for the personal workspace"
  task reset_personal_password: :environment do
    email = Auth::PlaywrightPersonalWorkspace.email
    password = Auth::PlaywrightPersonalWorkspace.password
    connection = ENV["AUTH0_CONNECTION"].presence || "Username-Password-Authentication"
    user = Auth::User.find_by!(email:)
    client = Auth::M2mClient.client

    client.patch_user(
      user.auth_id,
      {
        password:,
        connection:,
      }
    )

    result = Auth::Operations::AuthenticateUser.new.call(
      username: email,
      password:
    )
    raise "Password login failed: #{result.failure}" unless result.success?

    puts "Playwright can log in as #{email} for #{Auth::PlaywrightPersonalWorkspace::SPACE_CODE}"
  end
end
