# frozen_string_literal: true

module Spaces
  module Serializers
    class SpaceUserSerializer < Blueprinter::Base
      identifier :id

      fields :email,
             :full_name

      field :role do |user, options|
        space = options[:space]
        return "member" unless space

        if user.has_role?(:admin, space)
          "admin"
        elsif user.has_role?(:member, space)
          "member"
        else
          "member" # default
        end
      end

      field :joined_at do |user, options|
        space = options[:space]
        return nil unless space

        user.space_users.find_by(space: space)&.created_at
      end
    end
  end
end
