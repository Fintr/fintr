# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::CreateLoan do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(10_000, 'PHP'), name: 'Test Account') }

  let(:valid_params) do
    {
      user_id: user.id.to_s,
      space_id: space.id.to_s,
      principal_amount: 100_000.0,
      interest_rate: 10.0,
      date: Date.new(2024, 1, 1),
      loan_type: 'borrowed',
      entity_name: 'Test Lender',
      account_name: account.name,
      loan_term_months: 12,
      description: 'Test loan description'
    }
  end

  describe '#validate' do
    context 'when valid params are provided' do
      it 'returns a successful result' do
        result = operation.send(:validate, params: valid_params)
        expect(result).to be_success
      end

      it 'returns the validated params' do
        result = operation.send(:validate, params: valid_params)
        validated_params = result.value!
        expect(validated_params[:user_id]).to eq(user.id.to_s)
        expect(validated_params[:space_id]).to eq(space.id.to_s)
        expect(validated_params[:principal_amount]).to eq(100_000.0)
        expect(validated_params[:interest_rate]).to eq(10.0)
        expect(validated_params[:loan_type]).to eq('borrowed')
      end
    end

    context 'when user_id is missing' do
      let(:params_without_user_id) do
        valid_params.except(:user_id)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_user_id)
        expect(result).to be_failure
      end

      it 'returns user_id error' do
        result = operation.send(:validate, params: params_without_user_id)
        expect(result.failure).to have_key(:user_id)
        expect(result.failure[:user_id]).to include("is missing")
      end
    end

    context 'when space_id is missing' do
      let(:params_without_space_id) do
        valid_params.except(:space_id)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_space_id)
        expect(result).to be_failure
      end

      it 'returns space_id error' do
        result = operation.send(:validate, params: params_without_space_id)
        expect(result.failure).to have_key(:space_id)
        expect(result.failure[:space_id]).to include("is missing")
      end
    end

    context 'when principal_amount is missing' do
      let(:params_without_principal_amount) do
        valid_params.except(:principal_amount)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_principal_amount)
        expect(result).to be_failure
      end

      it 'returns principal_amount error' do
        result = operation.send(:validate, params: params_without_principal_amount)
        expect(result.failure).to have_key(:principal_amount)
        expect(result.failure[:principal_amount]).to include("is missing")
      end
    end

    context 'when principal_amount is zero' do
      let(:params_with_zero_principal) do
        valid_params.merge(principal_amount: 0)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_zero_principal)
        expect(result).to be_failure
      end

      it 'returns principal_amount validation error' do
        result = operation.send(:validate, params: params_with_zero_principal)
        expect(result.failure).to have_key(:principal_amount)
      end
    end

    context 'when principal_amount is negative' do
      let(:params_with_negative_principal) do
        valid_params.merge(principal_amount: -100)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_negative_principal)
        expect(result).to be_failure
      end

      it 'returns principal_amount validation error' do
        result = operation.send(:validate, params: params_with_negative_principal)
        expect(result.failure).to have_key(:principal_amount)
      end
    end

    context 'when interest_rate is missing' do
      let(:params_without_interest_rate) do
        valid_params.except(:interest_rate)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_interest_rate)
        expect(result).to be_failure
      end

      it 'returns interest_rate error' do
        result = operation.send(:validate, params: params_without_interest_rate)
        expect(result.failure).to have_key(:interest_rate)
        expect(result.failure[:interest_rate]).to include("is missing")
      end
    end

    context 'when interest_rate is negative' do
      let(:params_with_negative_interest_rate) do
        valid_params.merge(interest_rate: -1)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_negative_interest_rate)
        expect(result).to be_failure
      end

      it 'returns interest_rate validation error' do
        result = operation.send(:validate, params: params_with_negative_interest_rate)
        expect(result.failure).to have_key(:interest_rate)
      end
    end

    context 'when interest_rate is 100 or greater' do
      let(:params_with_high_interest_rate) do
        valid_params.merge(interest_rate: 100)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_high_interest_rate)
        expect(result).to be_failure
      end

      it 'returns interest_rate validation error' do
        result = operation.send(:validate, params: params_with_high_interest_rate)
        expect(result.failure).to have_key(:interest_rate)
        expect(result.failure[:interest_rate]).to include("must be between 0 and 100")
      end
    end

    context 'when date is missing' do
      let(:params_without_date) do
        valid_params.except(:date)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_date)
        expect(result).to be_failure
      end

      it 'returns date error' do
        result = operation.send(:validate, params: params_without_date)
        expect(result.failure).to have_key(:date)
        expect(result.failure[:date]).to include("is missing")
      end
    end

    context 'when loan_type is missing' do
      let(:params_without_loan_type) do
        valid_params.except(:loan_type)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_loan_type)
        expect(result).to be_failure
      end

      it 'returns loan_type error' do
        result = operation.send(:validate, params: params_without_loan_type)
        expect(result.failure).to have_key(:loan_type)
        expect(result.failure[:loan_type]).to include("is missing")
      end
    end

    context 'when loan_type is invalid' do
      let(:params_with_invalid_loan_type) do
        valid_params.merge(loan_type: 'invalid')
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_invalid_loan_type)
        expect(result).to be_failure
      end

      it 'returns loan_type validation error' do
        result = operation.send(:validate, params: params_with_invalid_loan_type)
        expect(result.failure).to have_key(:loan_type)
        expect(result.failure[:loan_type]).to include("must be one of: borrowed, lent")
      end
    end

    context 'when entity_name is missing' do
      let(:params_without_entity_name) do
        valid_params.except(:entity_name)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_entity_name)
        expect(result).to be_failure
      end

      it 'returns entity_name error' do
        result = operation.send(:validate, params: params_without_entity_name)
        expect(result.failure).to have_key(:entity_name)
        expect(result.failure[:entity_name]).to include("is missing")
      end
    end

    context 'when account_name is missing' do
      let(:params_without_account_name) do
        valid_params.except(:account_name)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_account_name)
        expect(result).to be_failure
      end

      it 'returns account_name error' do
        result = operation.send(:validate, params: params_without_account_name)
        expect(result.failure).to have_key(:account_name)
        expect(result.failure[:account_name]).to include("is missing")
      end
    end

    context 'when loan_term_months is missing' do
      let(:params_without_loan_term_months) do
        valid_params.except(:loan_term_months)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_loan_term_months)
        expect(result).to be_failure
      end

      it 'returns loan_term_months error' do
        result = operation.send(:validate, params: params_without_loan_term_months)
        expect(result.failure).to have_key(:loan_term_months)
        expect(result.failure[:loan_term_months]).to include("is missing")
      end
    end

    context 'when loan_term_months is zero' do
      let(:params_with_zero_loan_term_months) do
        valid_params.merge(loan_term_months: 0)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_zero_loan_term_months)
        expect(result).to be_failure
      end

      it 'returns loan_term_months validation error' do
        result = operation.send(:validate, params: params_with_zero_loan_term_months)
        expect(result.failure).to have_key(:loan_term_months)
      end
    end

    context 'when loan_term_months is negative' do
      let(:params_with_negative_loan_term_months) do
        valid_params.merge(loan_term_months: -1)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_negative_loan_term_months)
        expect(result).to be_failure
      end

      it 'returns loan_term_months validation error' do
        result = operation.send(:validate, params: params_with_negative_loan_term_months)
        expect(result.failure).to have_key(:loan_term_months)
      end
    end

    context 'when valid loan types are provided' do
      %w[borrowed lent].each do |type|
        it "accepts #{type} as a valid loan type" do
          params = valid_params.merge(loan_type: type)
          result = operation.send(:validate, params: params)
          expect(result).to be_success
        end
      end
    end

    context 'when interest_rate is zero' do
      it 'accepts zero as a valid interest rate' do
        params = valid_params.merge(interest_rate: 0)
        result = operation.send(:validate, params: params)
        expect(result).to be_success
      end
    end

    context 'when optional description is provided' do
      it 'accepts description as optional parameter' do
        params = valid_params.merge(description: 'Optional description')
        result = operation.send(:validate, params: params)
        expect(result).to be_success
      end
    end

    context 'when description is not provided' do
      it 'accepts params without description' do
        params = valid_params.except(:description)
        result = operation.send(:validate, params: params)
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    before do
      allow(Utils::ActiveStorage).to receive(:attach_file).and_return(true)
      allow(Ai::Embeddings::GenerateEmbeddingJob).to receive(:perform_later)
    end

    context 'with valid parameters for borrowed loan' do
      subject(:call_operation) { operation.call(valid_params) }

      it { is_expected.to be_success }

      it 'creates a loan' do
        expect { call_operation }.to change(Transactions::Loan, :count).by(1)
      end

      it 'creates the loan with correct attributes' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Loan)
        expect(result.user_id).to eq(user.id)
        expect(result.space_id).to eq(space.id)
        expect(result.principal_amount.amount).to eq(100_000.0)
        expect(result.interest_rate).to eq(10.0)
        expect(result.date).to eq(Date.new(2024, 1, 1))
        expect(result.loan_type).to eq('borrowed')
        expect(result.loan_term_months).to eq(12)
        expect(result.currency).to eq('PHP')
        expect(result.status).to eq('active')
      end

      it 'sets outstanding_balance equal to principal_amount' do
        result = call_operation.value!
        expect(result.outstanding_balance.amount).to eq(100_000.0)
      end

      it 'calculates maturity_date correctly' do
        result = call_operation.value!
        expected_maturity_date = Date.new(2024, 1, 1) + 12.months
        expect(result.maturity_date).to eq(expected_maturity_date)
      end

      it 'creates or finds the entity' do
        expect { call_operation }.to change(Entities::Entity, :count).by(1)
      end

      it 'associates the loan with the correct entity' do
        result = call_operation.value!
        entity = Entities::Entity.find_by(space_id: space.id, entity_type: 'loan', full_name: 'Test Lender')
        expect(result.entity_id).to eq(entity.id)
      end

      it 'increases the account balance for borrowed loan' do
        initial_balance = account.reload.balance.amount
        call_operation
        final_balance = account.reload.balance.amount
        expect(final_balance).to eq(initial_balance + 100_000.0)
      end

      it 'persists the loan to the database' do
        result = call_operation.value!
        expect(result).to be_persisted
      end

      it 'does not call attach_file when file is not provided' do
        call_operation
        expect(Utils::ActiveStorage).not_to have_received(:attach_file)
      end

      it 'schedules embedding generation job' do
        call_operation
        expect(Ai::Embeddings::GenerateEmbeddingJob).to have_received(:perform_later).with(
          embeddable_id: kind_of(String),
          embeddable_type: 'Transactions::Loan',
          space_id: space.id
        )
      end
    end

    context 'with valid parameters for lent loan' do
      subject(:call_operation) { operation.call(lent_params) }

      let(:lent_params) do
        valid_params.merge(loan_type: 'lent')
      end

      it { is_expected.to be_success }

      it 'creates a loan with lent type' do
        result = call_operation.value!
        expect(result.loan_type).to eq('lent')
      end

      it 'decreases the account balance for lent loan' do
        initial_balance = account.reload.balance.amount
        call_operation
        final_balance = account.reload.balance.amount
        expect(final_balance).to eq(initial_balance - 100_000.0)
      end
    end

    context 'when entity already exists' do
      let!(:existing_entity) do
        create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender')
      end

      it 'uses the existing entity instead of creating a new one' do
        expect { operation.call(valid_params) }.not_to change(Entities::Entity, :count)
      end

      it 'associates the loan with the existing entity' do
        result = operation.call(valid_params).value!
        expect(result.entity_id).to eq(existing_entity.id)
      end
    end

    context 'when validation fails' do
      let(:invalid_params) do
        valid_params.except(:principal_amount)
      end

      it 'returns a failure result' do
        result = operation.call(invalid_params)
        expect(result).to be_failure
      end

      it 'returns validation errors' do
        result = operation.call(invalid_params)
        expect(result.failure).to have_key(:principal_amount)
      end
    end

    context 'when account is not found' do
      let(:params_with_nonexistent_account) do
        valid_params.merge(account_name: 'Non-existent Account')
      end

      it 'returns a failure result' do
        result = operation.call(params_with_nonexistent_account)
        expect(result).to be_failure
      end

      it 'returns account_name error' do
        result = operation.call(params_with_nonexistent_account)
        expect(result.failure).to have_key(:account_name)
        expect(result.failure[:account_name]).to include("not found")
      end
    end

    context 'when entity creation fails' do
      before do
        allow(Entities::Entity).to receive(:find_or_create_by!).and_raise(StandardError.new("Database error"))
      end

      it 'returns a failure result' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end

      it 'returns entity_name error' do
        result = operation.call(valid_params)
        expect(result.failure).to have_key(:entity_name)
        expect(result.failure[:entity_name]).to include("could not be created")
      end
    end

    context 'when loan creation fails' do
      before do
        allow_any_instance_of(Transactions::Loan).to receive(:save!).and_raise(StandardError.new("Database error"))
      end

      it 'returns a failure result' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end
    end

    context 'when account balance update fails' do
      before do
        allow_any_instance_of(Transactions::Account).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(account))
      end

      it 'returns a failure result' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end

      it 'returns errors in the failure' do
        result = operation.call(valid_params)
        expect(result.failure).to have_key(:errors)
      end
    end
  end

  describe '#find_or_create_entity' do
    context 'when entity does not exist' do
      it 'creates a new entity' do
        expect {
          operation.send(:find_or_create_entity, params: valid_params)
        }.to change(Entities::Entity, :count).by(1)
      end

      it 'creates entity with correct attributes' do
        result = operation.send(:find_or_create_entity, params: valid_params)
        entity = result.value!
        expect(entity.space_id).to eq(space.id)
        expect(entity.entity_type).to eq('loan')
        expect(entity.full_name).to eq('Test Lender')
      end

      it 'returns a successful result' do
        result = operation.send(:find_or_create_entity, params: valid_params)
        expect(result).to be_success
      end
    end

    context 'when entity already exists' do
      let!(:existing_entity) do
        create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender')
      end

      it 'does not create a new entity' do
        expect {
          operation.send(:find_or_create_entity, params: valid_params)
        }.not_to change(Entities::Entity, :count)
      end

      it 'returns the existing entity' do
        result = operation.send(:find_or_create_entity, params: valid_params)
        entity = result.value!
        expect(entity.id).to eq(existing_entity.id)
      end

      it 'returns a successful result' do
        result = operation.send(:find_or_create_entity, params: valid_params)
        expect(result).to be_success
      end
    end

    context 'when entity creation fails' do
      before do
        allow(Entities::Entity).to receive(:find_or_create_by!).and_raise(StandardError.new("Database error"))
      end

      it 'returns a failure result' do
        result = operation.send(:find_or_create_entity, params: valid_params)
        expect(result).to be_failure
      end

      it 'returns entity_name error' do
        result = operation.send(:find_or_create_entity, params: valid_params)
        expect(result.failure).to have_key(:entity_name)
        expect(result.failure[:entity_name]).to include("could not be created")
      end

      it 'includes the error in the failure' do
        result = operation.send(:find_or_create_entity, params: valid_params)
        expect(result.failure).to have_key(:error)
      end
    end
  end

  describe '#find_account' do
    context 'when account exists' do
      it 'returns the account' do
        result = operation.send(:find_account, params: valid_params)
        account_result = result.value!
        expect(account_result.id).to eq(account.id)
      end

      it 'returns a successful result' do
        result = operation.send(:find_account, params: valid_params)
        expect(result).to be_success
      end

      it 'finds only kept accounts' do
        deleted_account = create(:account, space: space, name: 'Deleted Account')
        deleted_account.discard
        result = operation.send(:find_account, params: valid_params.merge(account_name: 'Deleted Account'))
        expect(result).to be_failure
      end
    end

    context 'when account does not exist' do
      let(:params_with_nonexistent_account) do
        valid_params.merge(account_name: 'Non-existent Account')
      end

      it 'returns a failure result' do
        result = operation.send(:find_account, params: params_with_nonexistent_account)
        expect(result).to be_failure
      end

      it 'returns account_name error' do
        result = operation.send(:find_account, params: params_with_nonexistent_account)
        expect(result.failure).to have_key(:account_name)
        expect(result.failure[:account_name]).to include("not found")
      end
    end
  end

  describe '#transform_params' do
    let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }

    it 'transforms principal_amount to principal_amount_cents' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params[:principal_amount_cents]).to eq(10_000_000) # 100,000 * 100
    end

    it 'sets outstanding_balance_cents equal to principal_amount_cents' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params[:outstanding_balance_cents]).to eq(transformed_params[:principal_amount_cents])
    end

    it 'sets currency to PHP' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params[:currency]).to eq('PHP')
    end

    it 'sets status to active' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params[:status]).to eq('active')
    end

    it 'calculates maturity_date correctly' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expected_maturity_date = Date.new(2024, 1, 1) + 12.months
      expect(transformed_params[:maturity_date]).to eq(expected_maturity_date)
    end

    it 'adds entity_id to params' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params[:entity_id]).to eq(entity.id)
    end

    it 'adds account_id to params' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params[:account_id]).to eq(account.id)
    end

    it 'removes principal_amount from params' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params).not_to have_key(:principal_amount)
    end

    it 'removes entity_name from params' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params).not_to have_key(:entity_name)
    end

    it 'removes account_name from params' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params).not_to have_key(:account_name)
    end

    it 'removes file from params' do
      file = fixture_file_upload('test.jpg', 'image/jpeg')
      params_with_file = valid_params.merge(file: file)
      result = operation.send(:transform_params, params: params_with_file, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params).not_to have_key(:file)
    end

    it 'removes file_id from params' do
      params_with_file_id = valid_params.merge(file_id: 'test-id')
      result = operation.send(:transform_params, params: params_with_file_id, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params).not_to have_key(:file_id)
    end

    it 'preserves other loan attributes' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      transformed_params = result.value!
      expect(transformed_params[:interest_rate]).to eq(10.0)
      expect(transformed_params[:loan_type]).to eq('borrowed')
      expect(transformed_params[:loan_term_months]).to eq(12)
      expect(transformed_params[:description]).to eq('Test loan description')
    end

    it 'returns a successful result' do
      result = operation.send(:transform_params, params: valid_params, entity: entity, account: account)
      expect(result).to be_success
    end
  end

  describe '#create_loan' do
    let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }
    let(:transformed_params) do
      {
        user_id: user.id,
        space_id: space.id,
        entity_id: entity.id,
        account_id: account.id,
        principal_amount_cents: 10_000_000,
        outstanding_balance_cents: 10_000_000,
        interest_rate: 10.0,
        date: Date.new(2024, 1, 1),
        loan_term_months: 12,
        maturity_date: Date.new(2024, 1, 1) + 12.months,
        loan_type: 'borrowed',
        currency: 'PHP',
        status: 'active',
        description: 'Test loan description'
      }
    end

    it 'creates a loan' do
      expect {
        operation.send(:create_loan, params: transformed_params)
      }.to change(Transactions::Loan, :count).by(1)
    end

    it 'returns the created loan' do
      result = operation.send(:create_loan, params: transformed_params)
      loan = result.value!
      expect(loan).to be_a(Transactions::Loan)
      expect(loan.principal_amount.amount).to eq(100_000.0)
    end

    it 'returns a successful result' do
      result = operation.send(:create_loan, params: transformed_params)
      expect(result).to be_success
    end

    it 'persists the loan to the database' do
      result = operation.send(:create_loan, params: transformed_params)
      loan = result.value!
      expect(loan).to be_persisted
    end

    context 'when loan creation fails' do
      before do
        allow_any_instance_of(Transactions::Loan).to receive(:save!).and_raise(StandardError.new("Database error"))
      end

      it 'returns a failure result' do
        result = operation.send(:create_loan, params: transformed_params)
        expect(result).to be_failure
      end

      it 'includes the error in the failure' do
        result = operation.send(:create_loan, params: transformed_params)
        expect(result.failure).to have_key(:error)
      end
    end
  end

  describe '#update_account_balance' do
    let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }
    let(:loan) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account,
        principal_amount_cents: 10_000_000,
        outstanding_balance_cents: 10_000_000,
        loan_type: 'borrowed',
        currency: 'PHP'
      )
    end

    context 'when loan type is borrowed' do
      it 'increases the account balance' do
        initial_balance = account.reload.balance.amount
        operation.send(:update_account_balance, loan: loan, account: account)
        final_balance = account.reload.balance.amount
        expect(final_balance).to eq(initial_balance + 100_000.0)
      end

      it 'returns a successful result' do
        result = operation.send(:update_account_balance, loan: loan, account: account)
        expect(result).to be_success
      end

      it 'returns the updated account' do
        result = operation.send(:update_account_balance, loan: loan, account: account)
        expect(result.value!).to eq(account)
      end
    end

    context 'when loan type is lent' do
      let(:lent_loan) do
        create(
          :loan,
          user: user,
          space: space,
          entity: entity,
          account: account,
          principal_amount_cents: 10_000_000,
          outstanding_balance_cents: 10_000_000,
          loan_type: 'lent',
          currency: 'PHP'
        )
      end

      it 'decreases the account balance' do
        initial_balance = account.reload.balance.amount
        operation.send(:update_account_balance, loan: lent_loan, account: account)
        final_balance = account.reload.balance.amount
        expect(final_balance).to eq(initial_balance - 100_000.0)
      end

      it 'returns a successful result' do
        result = operation.send(:update_account_balance, loan: lent_loan, account: account)
        expect(result).to be_success
      end
    end

    context 'when account balance update fails' do
      before do
        allow(account).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(account))
        allow(account).to receive(:errors).and_return(instance_double(ActiveModel::Errors, to_hash: { balance: ['error'] }))
      end

      it 'returns a failure result' do
        result = operation.send(:update_account_balance, loan: loan, account: account)
        expect(result).to be_failure
      end

      it 'returns errors in the failure' do
        result = operation.send(:update_account_balance, loan: loan, account: account)
        expect(result.failure).to have_key(:errors)
      end

      it 'includes the error in the failure' do
        result = operation.send(:update_account_balance, loan: loan, account: account)
        expect(result.failure).to have_key(:error)
      end
    end
  end

  describe '#attach_file' do
    let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }
    let(:loan) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account
      )
    end

    before do
      allow(Utils::ActiveStorage).to receive(:attach_file).and_return(true)
    end

    context 'when file is provided' do
      let(:file) { fixture_file_upload('test.jpg', 'image/jpeg') }
      let(:params_with_file) { valid_params.merge(file: file) }

      it 'calls Utils::ActiveStorage.attach_file' do
        operation.send(:attach_file, loan: loan, params: params_with_file)
        expect(Utils::ActiveStorage).to have_received(:attach_file).with(
          loan.files,
          file,
          space.id.to_s
        )
      end

      it 'returns a successful result' do
        result = operation.send(:attach_file, loan: loan, params: params_with_file)
        expect(result).to be_success
      end

      it 'returns the loan' do
        result = operation.send(:attach_file, loan: loan, params: params_with_file)
        expect(result.value!).to eq(loan)
      end
    end

    context 'when file is not provided' do
      it 'does not call Utils::ActiveStorage.attach_file' do
        operation.send(:attach_file, loan: loan, params: valid_params)
        expect(Utils::ActiveStorage).not_to have_received(:attach_file)
      end

      it 'returns a successful result' do
        result = operation.send(:attach_file, loan: loan, params: valid_params)
        expect(result).to be_success
      end

      it 'returns the loan' do
        result = operation.send(:attach_file, loan: loan, params: valid_params)
        expect(result.value!).to eq(loan)
      end
    end

    context 'when file is blank' do
      let(:params_with_blank_file) { valid_params.merge(file: '') }

      it 'does not call Utils::ActiveStorage.attach_file' do
        operation.send(:attach_file, loan: loan, params: params_with_blank_file)
        expect(Utils::ActiveStorage).not_to have_received(:attach_file)
      end

      it 'returns a successful result' do
        result = operation.send(:attach_file, loan: loan, params: params_with_blank_file)
        expect(result).to be_success
      end
    end
  end

  describe '#generate_embedding_async' do
    let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }
    let(:loan) do
      create(
        :loan,
        user: user,
        space: space,
        entity: entity,
        account: account
      )
    end

    before do
      allow(Ai::Embeddings::GenerateEmbeddingJob).to receive(:perform_later)
    end

    it 'schedules the embedding generation job' do
      operation.send(:generate_embedding_async, loan: loan)
      expect(Ai::Embeddings::GenerateEmbeddingJob).to have_received(:perform_later).with(
        embeddable_id: loan.id,
        embeddable_type: 'Transactions::Loan',
        space_id: space.id
      )
    end

    it 'returns a successful result' do
      result = operation.send(:generate_embedding_async, loan: loan)
      expect(result).to be_success
    end

    it 'returns the loan' do
      result = operation.send(:generate_embedding_async, loan: loan)
      expect(result.value!).to eq(loan)
    end
  end
end
