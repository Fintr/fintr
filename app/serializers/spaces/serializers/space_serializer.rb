# frozen_string_literal: true

module Spaces
  module Serializers
    class SpaceSerializer < Blueprinter::Base
      identifier :id

      fields :code,
             :name,
             :type,
             :currency

      field :is_personal do |space|
        space.is_a?(::Spaces::PersonalSpace)
      end

      field :is_organization do |space|
        space.is_a?(::Spaces::OrganizationSpace)
      end

      field :user_role do |space, options|
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

      field :created_at do |space|
        space.created_at
      end

      field :updated_at do |space|
        space.updated_at
      end
    end
  end
end
