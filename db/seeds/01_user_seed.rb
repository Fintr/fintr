# frozen_string_literal: true

if Auth::User.count.zero?
  raise StandardError, "You need to create a user first through the front end. Just log in!"
end
