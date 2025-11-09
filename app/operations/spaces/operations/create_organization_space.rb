# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class CreateOrganizationSpace < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:name).filled(:string)
          required(:currency).filled(:string)
          required(:reference_space_id).filled(:string)
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

        transaction do
          user            = step find_user(validated_params)
          reference_space = step find_reference_space(validated_params)
          space           = step create_organization_space(validated_params)
          _               = step join_user_to_space(validated_params, space, user)
          _               = step assign_admin_role(space, user)
          _               = step copy_categories(space, reference_space)
          _               = step copy_accounts(space, reference_space)

          space
        end
      end

      private

      def find_user(params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user

        Success(user)
      end

      def find_reference_space(params)
        space = Spaces::Space.find_by(id: params[:reference_space_id])
        return Failure(errors: { reference_space: ["not found"] }) unless space

        Success(space)
      end

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
        Failure(errors: e.record.errors.full_messages, error: e, expected: true)
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

      def join_user_to_space(params, space, user)
        space_user = Spaces::SpaceUser.create!(user: user, space: space)
        Success(space_user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages, error: e, expected: true)
      end

      def assign_admin_role(space, user)
        user.add_role(:admin, space)
        Success()
      end

      def copy_categories(space, reference_space)
        categories = reference_space.categories

        categories.each do |category|
          Transactions::Category.create!(
            name: category.name,
            category_type: category.category_type,
            space: space
          )
        end

        Success()
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages, error: e, expected: true)
      end

      def copy_accounts(space, reference_space)
        accounts = reference_space.accounts

        accounts.each do |account|
          Transactions::Account.create!(
            name: account.name,
            space: space,
            account_category: account.account_category,
            balance: Money.new(0, account.balance_currency)
          )
        end

        Success()
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages, error: e, expected: true)
      end
    end
  end
end
