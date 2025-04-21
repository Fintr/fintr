module Transactions
  module Operations
    class CreateTransaction < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:integer)
          required(:space_code).value(:string)
          required(:amount).value(:decimal)
          required(:date).value(:date)
          optional(:description).value(:string)
          required(:category_name).value(:string)
          required(:account_name).value(:string)

          # Schedule type and related fields
          required(:schedule_type).value(:string)
          optional(:repeat_interval).value(:string)
          optional(:repeat_count).value(:integer)
          optional(:installment_period).value(:string)
          optional(:installment_count).value(:integer)
        end

        # Validate that schedule_type is valid
        rule(:schedule_type) do
          key.failure("must be one of: one_time, repeat") unless [ "one_time", "repeat" ].include?(value)
        end

        # Validate repeat fields are present when schedule_type is 'repeat'
        rule(:repeat_interval, :schedule_type) do
          key(:repeat_interval).failure("must be provided for repeat transactions") if values[:schedule_type] == "repeat" && value.nil?
        end

        rule(:repeat_count, :schedule_type) do
          key(:repeat_count).failure("must be provided for repeat transactions") if values[:schedule_type] == "repeat" && value.nil?
        end

        rule(:installment_period, :schedule_type) do
          key(:installment_period).failure("must be provided for installment transactions") if values[:schedule_type] == "installment" && value.nil?
        end

        rule(:installment_count, :schedule_type) do
          key(:installment_count).failure("must be provided for installment transactions") if values[:schedule_type] == "installment" && value.nil?
        end

        # Validate repeat_interval is valid when provided
        rule(:repeat_interval) do
          valid_intervals = Transaction.repeat_intervals.values

          key.failure("must be a valid interval") if value && !valid_intervals.include?(value)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success()
      end

      def call(params:)
        ActiveRecord::Base.transaction do
          _           = step validate(params:)
          space       = step find_space(params:)
          category    = step find_category(params:)
          account     = step find_account(params:)
          new_balance = step adjust_balance(params:, account:, category:)
          params      = step transform_params(params:, space:, category:, account:)
          transaction = step create_transaction(params:, category:, new_balance:)

          transaction
        end
      end

      private

      def find_category(params:)
        category = Transactions::Category.find_by(name: params[:category_name])
        return Failure(category_name: "not found") unless category

        Success(category)
      end

      def find_space(params:)
        space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "not found") unless space

        Success(space)
      end

      def find_account(params:)
        account = Transactions::Account.find_by(name: params[:account_name])
        return Failure(account_name: "not found") unless account

        Success(account)
      end

      def transform_params(params:, space:, category:, account:)
        params[:category_id] = category.id
        params[:account_id] = account.id
        params[:space_id] = space.id
        params.delete(:category_name)
        params.delete(:account_name)
        params.delete(:space_code)
        Success(params)
      end

      def adjust_balance(params:, account:, category:)
        add_amount = category.income? ? params[:amount] : -params[:amount]
        new_balance = account.balance.amount + add_amount

        account.update!(balance: new_balance)
        Success(new_balance)
      rescue ActiveRecord::RecordInvalid
        Failure(account_name: "Balance cannot be negative, new_balance: #{new_balance}")
      end

      def create_transaction(params:, category:, new_balance:)
        transaction_type = category.income? ? Transactions::Income : Transactions::Expense

        transaction = transaction_type.new(
          user_id: params[:user_id],
          space_id: params[:space_id],
          date: params[:date],
          amount: params[:amount],
          balance: params[:amount], # This may need calculation logic based on account balance
          description: params[:description],
          category_id: params[:category_id],
          account_id: params[:account_id],
          schedule_type: params[:schedule_type],
          repeat_interval: params[:repeat_interval],
          repeat_count: params[:repeat_count],
          installment_period: params[:installment_period],
          installment_count: params[:installment_count]
        )

        Failure(transaction.errors) if transaction.invalid?

        transaction.save!

        Success(transaction)
      end
    end
  end
end
