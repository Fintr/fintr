# frozen_string_literal: true

module Auth
  module Operations
    class CreateUserAndSpace < Dry::Operation
      IDENTIFIED_CONTACTS_LIST_NAME = "identified_contacts".freeze

      def call(params)
        user = nil

        ActiveRecord::Base.transaction do
          user = step create_user(params)
          space_attributes = step create_space_attributes(user)
          space = step create_own_space(user, space_attributes)
          _ = step join_own_space(user, space)
          _ = step assign_admin_role_to_user(user, space)
        end

        _ = step add_contact_to_identified_contacts_list(user)
        user
      end

      private

      def create_user(params)
        # First try to find user by auth_id
        user = Auth::User.find_by(auth_id: params[:auth_id])

        # If not found by auth_id, try to find by email (for users who logged in with different methods)
        if user.nil? && params[:email].present?
          user = Auth::User.find_by(email: params[:email])

          if user.present?
            # Return the existing user without updating auth_id
            # This allows the same user to authenticate with different methods
            return Success(user)
          end
        end

        # If still not found, create a new user
        if user.nil?
          user = Auth::User.new(auth_id: params[:auth_id])
        end

        # Only assign attributes from token; do not overwrite full_name or email with nil
        # so existing users keep their names when Auth0 token omits them
        attrs = params.slice(*User.clean_attributes)
        attrs.delete(:full_name) if attrs[:full_name].blank?
        attrs.delete(:email) if attrs[:email].blank?
        user.assign_attributes(attrs)
        return Success(user) unless user.changed?

        user.save!
        Success(user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: user.errors, error: e, expected: true)
      end

      def create_space_attributes(user)
        code = "#{user.email} personal space".parameterize(separator: "-")
        hash = {
          name: "#{Utils::Name.possessive(user.full_name)} Space",
          code:,
          currency: "PHP"
        }
        Success(hash)
      end

      def create_own_space(user, space_attributes)
        return Success(user.personal_spaces.first) if user.personal_spaces.first.present?

        space = Spaces::PersonalSpace.find_or_initialize_by(code: space_attributes[:code])
        return Success(space) if space.persisted?

        space.assign_attributes(space_attributes)
        space.owner = user
        space.save!

        space.create_default_transaction_categories

        Success(space)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: space.errors, error: e, expected: true)
      end

      def join_own_space(user, space)
        space_user = Spaces::SpaceUser.find_or_initialize_by(user:, space:)
        return Success(space_user) if space_user.persisted?

        space_user.save!
        Success(space_user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: space_user.errors, error: e, expected: true)
      end

      def assign_admin_role_to_user(user, space)
        user.add_role(:admin, space)
        Success()
      end

      def add_contact_to_identified_contacts_list(user)
        return Success() unless ENV["BREVO_API_KEY"].present?
        return Success() if user.email.blank?

        Integrations::Marketing::Brevo::Client.new.upsert_contact_to_list(
          email: user.email,
          list_name: IDENTIFIED_CONTACTS_LIST_NAME,
          full_name: user.full_name
        )

        Success()
      rescue StandardError => e
        Rails.logger.error("Brevo identified contact sync failed for #{user.email}: #{e.message}")
        Success()
      end
    end
  end
end
