# frozen_string_literal: true

if ENV["USER_AUTH0_ID"].blank?
  raise StandardError, "Please set up 'USER_AUTH0_ID' in your environment variables"
end

user = Auth::User.find_or_initialize_by(auth_id: ENV["USER_AUTH0_ID"])

user.assign_attributes(
  full_name: "Miko Dagatan",
  email: "miko@fintr.be"
)

user.save!

Auth::Operations::CreateUserAndSpace.new.call({
  auth_id: ENV["USER_AUTH0_ID"],
  full_name: "Miko Dagatan",
  email: "miko@fintr.be"
})
