# frozen_string_literal: true

class SpaceUser < ApplicationRecord
  belongs_to :space
  belongs_to :user

  validate :user_can_only_have_one_of_each_space_type, on: :create # Usually best on create

  private

  def user_can_only_have_one_of_each_space_type
    return unless user && space&.type.in?([ "Spaces::PersonalSpace", "Spaces::OrganizationSpace" ])

    space_type_to_check = space.type
    existing_space_user = SpaceUser
                            .joins(:space)
                            .exists?(user_id: user_id, spaces: { type: space_type_to_check })

    if existing_space_user
      errors.add(:user_id, "already belongs to a #{space_type_to_check.split('::').last.underscore.humanize.downcase}")
    end
  end
end
