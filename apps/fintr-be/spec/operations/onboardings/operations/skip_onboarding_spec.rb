# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::SkipOnboarding do
  subject(:skip_onboarding_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }

  let(:valid_params) do
    {
      user_id: user.id,
      space_id: space.id
    }
  end

  describe "#validate" do
    context "when valid params" do
      it "returns a successful result" do
        result = skip_onboarding_operation.validate(valid_params)
        expect(result).to be_success
      end

      it "returns the validated params in hash" do
        result = skip_onboarding_operation.validate(valid_params)
        expect(result.value!).to eq(valid_params)
      end
    end

    context "when invalid params" do
      it "returns a failure result when user_id is missing" do
        result = skip_onboarding_operation.validate(valid_params.except(:user_id))
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end

      it "returns a failure result when space_id is missing" do
        result = skip_onboarding_operation.validate(valid_params.except(:space_id))
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ["is missing"])
      end
    end
  end

  describe "#call" do
    let(:onboarding) do
      instance_double(
        Onboarding,
        id: SecureRandom.uuid,
        user: user,
        step: "income",
        data: ActiveSupport::HashWithIndifferentAccess.new({ "currency" => "PHP" })
      )
    end

    before do
      allow(Onboarding).to receive(:find_by).with(user_id: user.id).and_return(onboarding)
      allow(onboarding).to receive(:update!).and_return(true)

      allow(Transactions::Operations::Categories::CreateCategory)
        .to receive(:new)
        .and_return(instance_double(Transactions::Operations::Categories::CreateCategory,
                                    call: Dry::Monads::Success(true)))

      allow(Budgets::Operations::CreateBudget)
        .to receive(:new)
        .and_return(instance_double(Budgets::Operations::CreateBudget,
                                    call: Dry::Monads::Success(true)))

      allow(Transactions::Operations::Accounts::CreateAccount)
        .to receive(:new)
        .and_return(instance_double(Transactions::Operations::Accounts::CreateAccount,
                                    call: Dry::Monads::Success(true)))
    end

    context "when valid params and existing onboarding" do
      it "returns a successful result" do
        result = skip_onboarding_operation.call(valid_params)
        expect(result).to be_success
      end

      it "stores default budgets in onboarding data" do
        skip_onboarding_operation.call(valid_params)
        expected_budgets = described_class::DEFAULT_CATEGORIES.map do |name|
          { "name" => name, "amount" => "0" }
        end
        expect(onboarding).to have_received(:update!).with(
          data: onboarding.data.merge("budgets" => expected_budgets)
        )
      end

      it "marks onboarding as completed" do
        skip_onboarding_operation.call(valid_params)
        expect(onboarding).to have_received(:update!).with(step: "completed")
      end

      it "creates a category for each default category" do
        skip_onboarding_operation.call(valid_params)
        expect(Transactions::Operations::Categories::CreateCategory)
          .to have_received(:new)
          .exactly(described_class::DEFAULT_CATEGORIES.length).times
      end

      it "creates a budget for each default category" do
        skip_onboarding_operation.call(valid_params)
        expect(Budgets::Operations::CreateBudget)
          .to have_received(:new)
          .exactly(described_class::DEFAULT_CATEGORIES.length).times
      end

      it "creates the default Cash account" do
        skip_onboarding_operation.call(valid_params)
        expect(Transactions::Operations::Accounts::CreateAccount)
          .to have_received(:new).once
        expect(Transactions::Operations::Accounts::CreateAccount.new)
          .to have_received(:call).with(
            user_id: user.id,
            space_id: space.id,
            name: described_class::DEFAULT_ACCOUNT_NAME,
            balance: 0.to_d,
            account_category: described_class::DEFAULT_ACCOUNT_CATEGORY
          )
      end
    end

    context "when onboarding is not found" do
      before do
        allow(Onboarding).to receive(:find_by).with(user_id: user.id).and_return(nil)
      end

      it "returns a failure result" do
        result = skip_onboarding_operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to eq(error: "Onboarding not found")
      end

      it "does not create any categories" do
        skip_onboarding_operation.call(valid_params)
        expect(Transactions::Operations::Categories::CreateCategory).not_to have_received(:new)
      end

      it "does not create any accounts" do
        skip_onboarding_operation.call(valid_params)
        expect(Transactions::Operations::Accounts::CreateAccount).not_to have_received(:new)
      end
    end

    context "when validation fails" do
      it "returns a failure result with validation errors" do
        result = skip_onboarding_operation.call(valid_params.except(:user_id))
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end
    end

    context "when a nested operation fails" do
      before do
        allow(Transactions::Operations::Categories::CreateCategory)
          .to receive(:new)
          .and_return(instance_double(Transactions::Operations::Categories::CreateCategory,
                                      call: Dry::Monads::Failure(error: "Category creation failed")))
      end

      it "returns a failure result" do
        result = skip_onboarding_operation.call(valid_params)
        expect(result).to be_failure
      end

      it "does not mark onboarding as completed" do
        skip_onboarding_operation.call(valid_params)
        expect(onboarding).not_to have_received(:update!).with(step: "completed")
      end
    end
  end
end
