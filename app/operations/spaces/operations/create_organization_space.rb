module Spaces
  module Operations
    class CreateOrganizationSpace < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:name).filled(:string)
          required(:currency).filled(:string)
          optional(:invitation_code).maybe(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        validated_params = step validate(params:)
        
        ActiveRecord::Base.transaction do
          space = step create_organization_space(validated_params)
          _     = step join_user_to_space(validated_params, space)
          _     = step assign_admin_role(validated_params, space)
          _     = step create_default_categories(space)
          
          space
        end
      end

      private

      def create_organization_space(params)
        code = generate_space_code(params[:name])
        
        space = Spaces::OrganizationSpace.new(
          name: params[:name],
          code: code,
          currency: params[:currency]
        )
        
        space.save!
        Success(space)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages)
      end

      def join_user_to_space(params, space)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user
        
        space_user = Spaces::SpaceUser.create!(user: user, space: space)
        Success(space_user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages)
      end

      def assign_admin_role(params, space)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user
        
        user.add_role(:admin, space)
        Success()
      end

      def create_default_categories(space)
        space.create_default_transaction_categories
        Success()
      end

      def generate_space_code(name)
        base_code = name.parameterize(separator: "-")
        code = base_code
        counter = 1
        
        while Spaces::Space.exists?(code: code)
          code = "#{base_code}-#{counter}"
          counter += 1
        end
        
        code
      end
    end
  end
end