# frozen_string_literal: true

module Auth
  module Operations
    class CreateUserAndSpace < Dry::Operation
      def call(params)
        ActiveRecord::Base.transaction do
          user              = step create_user(params)
          space_attributes  = step create_space_attributes(user)
          space             = step create_own_space(user, space_attributes)
          _                 = step join_own_space(user, space)
          _                 = step assign_admin_role_to_user(user, space)
          user
        end
      end

      private

      def create_user(params)
        # First try to find user by auth_id
        user = Auth::User.find_by(auth_id: params[:auth_id])

        # If not found by auth_id, try to find by email (for users who logged in with different methods)
        if user.nil? && params[:email].present?
          user = Auth::User.find_by(email: params[:email])

          if user.present?
            puts("🔄 Found existing user by email (#{params[:email]}) with auth_id: #{user.auth_id}")
            puts("🔄 Current request auth_id: #{params[:auth_id]}")
            puts("🔄 Using existing user instead of creating new one")
            # Return the existing user without updating auth_id
            # This allows the same user to authenticate with different methods
            return Success(user)
          end
        end

        # If still not found, create a new user
        if user.nil?
          puts("🆕 Creating new user with auth_id: #{params[:auth_id]}")
          user = Auth::User.new(auth_id: params[:auth_id])
        end

        user.assign_attributes(params.slice(*User.clean_attributes))
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
    end
  end
end
