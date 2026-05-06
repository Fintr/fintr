# frozen_string_literal: true

if ENV["USER_AUTH0_ID"].blank?
  raise StandardError, "Please set up 'USER_AUTH0_ID' in your environment variables"
end

user_details = [
    { full_name: 'Miko Dagatan', email: 'miguel.dagatan@gmail.com' },
    { full_name: 'Joel Paolo Paraiso', email: 'joelpaoloparaiso@gmail.com' }
  ]

ENV["USER_AUTH0_ID"].split(',').each.with_index do |auth_id, index|
  user = Auth::User.find_or_initialize_by(auth_id:)

  user.assign_attributes(user_details[index])
  user.save!

  Auth::Operations::CreateUserAndSpace.new.call({
    auth_id:,
    full_name: user_details[index][:full_name],
    email: user_details[index][:email]
  })
end
