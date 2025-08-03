# frozen_string_literal: true

namespace :admins do
  desc "Create initial admins"
  task create_initial: :environment do
    %w[
      miguel.dagatan@gmail.com
      joelpaoloparaiso@gmail.com
      stanleyhugo06@gmail.com
    ].each do |email|
      next unless user = Auth::User.find_by(email:)
      next unless user.has_role?(:admin)

      user.add_role(:admin)
    end
  end
end
