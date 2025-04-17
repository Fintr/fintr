# frozen_string_literal: true

module Auth
  module Operations
    class CreateUserAndSpace < Dry::Operation
      def call(params)
        user              = step create_user(params)
        space_attributes  = step create_space_attributes(user)
        space             = step create_own_space(space_attributes)
        _                 = step join_own_space(user, space)
        _                 = step assign_admin_role_to_user(user, space)
        user
      end

      private

      def create_user(params)
        user = User.find_or_initialize_by(auth_id: params[:auth_id])
        user.assign_attributes(params.slice(*User.clean_attributes))
        return Success(user) unless user.changed?
        user.save!
        Success(user)
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

      def create_own_space(space_attributes)
        space = Spaces::PersonalSpace.find_or_initialize_by(code: space_attributes[:code])
        return Success(space) if space.persisted?

        space.assign_attributes(space_attributes)
        space.save!
        Success(space)
      end

      def join_own_space(user, space)
        space_user = SpaceUser.find_or_initialize_by(user:, space:)
        return Success(space_user) if space_user.persisted?

        space_user.save!
        Success(space_user)
      end

      def assign_admin_role_to_user(user, space)
        user.add_role(:admin, space)
        Success()
      end
    end
  end
end
