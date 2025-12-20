# frozen_string_literal: true

module Spaces
  class SpaceUser < ApplicationRecord
    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :user, class_name: "Auth::User", optional: true
    belongs_to :invited_by, class_name: "Auth::User", optional: true

    validates :access_code, uniqueness: true, allow_nil: true
    validates :invitation_status, presence: true
    validates :invitation_expires_at, presence: true, if: :invitation_pending?

    enum :invitation_status, {
      active: "active",      # Direct membership (no invitation)
      pending: "pending",    # Invitation created but not used
      used: "used",          # Invitation used
      expired: "expired",    # Invitation expired
      revoked: "revoked"     # Invitation revoked
    }, default: "active", prefix: :invitation

    scope :invited, -> { where.not(invited_by_id: nil) }
    scope :direct_members, -> { where(invited_by_id: nil) }
    scope :active_invitations, -> { where(invitation_status: :pending).where("invitation_expires_at > ?", Time.current) }
    scope :expired_invitations, -> { where(invitation_status: :pending).where("invitation_expires_at < ?", Time.current) }

    before_validation :generate_access_code, on: :create, if: :invitation_pending?
    before_validation :set_invitation_expiration, on: :create, if: :invitation_pending?

    validate :user_can_only_have_one_of_each_space_type, on: :create
    validate :invitation_fields_consistency

    def invitation_expired?
      invitation_pending? && invitation_expires_at < Time.current
    end

    def use_invitation!(user)
      return false unless invitation_pending?

      update!(
        user: user,
        invitation_status: :used,
        invitation_used_at: Time.current
      )
      true
    end

    def revoke_invitation!
      update!(invitation_status: :revoked) if invitation_pending?
    end

    private

    def user_can_only_have_one_of_each_space_type
      return unless user && space&.type == "Spaces::PersonalSpace"

      # Allow joining personal spaces via invitation (invited_by is present)
      # Only prevent owning multiple personal spaces (direct membership without invitation)
      return if invited_by_id.present?

      # Only prevent multiple direct memberships to personal spaces
      # Allow multiple organization spaces and joining personal spaces via invitation
      existing_personal_space = SpaceUser
                                  .joins(:space)
                                  .where.not(id: id)
                                  .where(invited_by_id: nil)
                                  .exists?(user_id: user_id, spaces: { type: "Spaces::PersonalSpace" })

      if existing_personal_space
        errors.add(:user_id, "already owns a personal space")
      end
    end

    def invitation_fields_consistency
      if invited_by_id.present?
        errors.add(:access_code, "is required for invitations") if access_code.blank?
        errors.add(:invitation_expires_at, "is required for invitations") if invitation_expires_at.blank?
      else
        errors.add(:invited_by_id, "cannot be present for direct membership") if invited_by_id.present?
        errors.add(:access_code, "cannot be present for direct membership") if access_code.present?
        errors.add(:invitation_expires_at, "cannot be present for direct membership") if invitation_expires_at.present?
      end
    end

    def generate_access_code
      self.access_code = SecureRandom.alphanumeric(16).upcase if access_code.blank?
    end

    def set_invitation_expiration
      self.invitation_expires_at = 7.days.from_now if invitation_expires_at.blank?
    end
  end
end
