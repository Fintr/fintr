# frozen_string_literal: true

module Spaces
  module Serializers
    class SpaceSerializer < Blueprinter::Base
      identifier :id

      fields :code,
             :name,
             :type,
             :currency

      field :isPersonal do |space|
        space.is_a?(::Spaces::PersonalSpace)
      end

      field :isOrganization do |space|
        space.is_a?(::Spaces::OrganizationSpace)
      end

      field :userRole do |space, options|
        current_user = options[:current_user]
        return "member" unless current_user

        if current_user.has_role?(:admin, space)
          "admin"
        elsif current_user.has_role?(:member, space)
          "member"
        else
          "member" # default
        end
      end

      field :createdAt do |space|
        space.created_at
      end

      field :updatedAt do |space|
        space.updated_at
      end
    end
  end
end
