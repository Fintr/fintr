# frozen_string_literal: true

module Spaces
  module Serializers
    class SpaceSerializer < Blueprinter::Base
      identifier :id

      fields :code,
             :name,
             :type,
             :currency,
             :default_transaction_currency

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

      field :has_new_invitation do |space, options|
        current_user = options[:current_user]
        return false unless current_user

        space_user = space.space_users.find { |su| su.user_id == current_user.id }
        space_user&.invitation_unseen? || false
      end

      field :is_owner do |space, options|
        current_user = options[:current_user]
        return false unless current_user

        space.owned_by?(current_user)
      end

      field :owner_id do |space|
        space.owner_id
      end

      field :member_count do |space|
        space.member_count
      end

      field :composition_key do |space|
        space.composition_key
      end
    end
  end
end

