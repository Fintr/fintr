# frozen_string_literal: true

module Spaces
  module Serializers
    class SpaceUserSerializer < Blueprinter::Base
      identifier :id

      field :email do |user|
        user.email
      end

      field :full_name do |user|
        user.full_name.presence || user.email.presence || "Unknown"
      end

      field :role do |user, options|
        space = options[:space]
        return "member" unless space

        # Owner takes priority over admin/member roles
        # Compare as strings to handle UUID type mismatches
        if space.owner_id.to_s == user.id.to_s
          "owner"
        elsif user.has_role?(:admin, space)
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
