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
        user = Auth::User.find_or_initialize_by(auth_id: params[:auth_id])
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
