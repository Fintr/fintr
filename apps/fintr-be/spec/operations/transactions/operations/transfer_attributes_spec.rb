# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::TransferAttributes do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:from_transfer) do
    create(:transfer,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           transaction_cost: Money.from_amount(10, "PHP"),
           date: Time.zone.today,
           description: "Original transfer",
           schedule_type: "one_time",
           balance_state: "calculated")
  end
  let(:to_transfer) do
    create(:transfer,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(50, "PHP"),
           transaction_cost: Money.from_amount(5, "PHP"),
           date: Time.zone.today + 1.day,
           description: "Target transfer",
           schedule_type: "one_time",
           balance_state: "pending")
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when from_record is missing' do
        result = operation.validate(params: { to_record: to_transfer })
        expect(result).to be_failure
        expect(result.failure).to include(:from_record)
      end

      it 'fails when to_record is missing' do
        result = operation.validate(params: { from_record: from_transfer })
        expect(result).to be_failure
        expect(result.failure).to include(:to_record)
      end
    end

    context 'with invalid from_record' do
      it 'fails when from_record is not an ActiveRecord::Base' do
        # Create a mock object that's not an ActiveRecord::Base
        mock_record = double("MockRecord").as_null_object # rubocop:disable RSpec/VerifiedDoubles
        allow(mock_record).to receive(:is_a?).with(ActiveRecord::Base).and_return(false)
        allow(mock_record).to receive(:changed?).and_return(true)
        allow(mock_record).to receive(:id).and_return("mock-id")
        allow(mock_record).to receive(:space_id).and_return("mock-space-id")
        allow(mock_record).to receive(:class).and_return(String)

        result = operation.validate(params: { from_record: mock_record, to_record: to_transfer })
        expect(result).to be_failure
        expect(result.failure[:from_record]).to include("must be a record")
      end

      it 'fails when from_record has not changed' do
        result = operation.validate(params: { from_record: from_transfer, to_record: to_transfer })
        expect(result).to be_failure
        expect(result.failure).to include(from_record: ["must be a changed record"])
      end
    end

    context 'with invalid to_record' do
      it 'fails when to_record is not an ActiveRecord::Base' do
        from_transfer.assign_attributes(description: "Changed")
        # Create a mock object that's not an ActiveRecord::Base
        mock_record = double("MockRecord").as_null_object # rubocop:disable RSpec/VerifiedDoubles
        allow(mock_record).to receive(:is_a?).with(ActiveRecord::Base).and_return(false)
        allow(mock_record).to receive(:id).and_return("mock-id")
        allow(mock_record).to receive(:space_id).and_return("mock-space-id")
        allow(mock_record).to receive(:class).and_return(String)

        result = operation.validate(params: { from_record: from_transfer, to_record: mock_record })
        expect(result).to be_failure
        expect(result.failure).to include(to_record: ["must be a record"])
      end
    end

    context 'with invalid record combination' do
      it 'fails when from_record and to_record are the same' do
        from_transfer.assign_attributes(description: "Changed")
        result = operation.validate(params: { from_record: from_transfer, to_record: from_transfer })
        expect(result).to be_failure
        expect(result.failure).to include(from_record: ["must be different"])
      end

      it 'fails when from_record and to_record are from different spaces' do
        different_space = create(:personal_space)
        different_account1 = create(:account, space: different_space)
        different_account2 = create(:account, space: different_space)
        different_transfer = create(:transfer, space: different_space, from_account: different_account1, to_account: different_account2)
        from_transfer.assign_attributes(description: "Changed")
        result = operation.validate(params: { from_record: from_transfer, to_record: different_transfer })
        expect(result).to be_failure
        expect(result.failure).to include(from_record: ["must be from the same space"])
      end

      it 'fails when from_record and to_record are different types' do
        transaction = create(:transaction, space:)
        from_transfer.assign_attributes(description: "Changed")
        result = operation.validate(params: { from_record: from_transfer, to_record: transaction })
        expect(result).to be_failure
        expect(result.failure).to include(from_record: ["must be of the same type"])
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation' do
        from_transfer.assign_attributes(description: "Changed")
        result = operation.validate(params: { from_record: from_transfer, to_record: to_transfer })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:valid_params) do
      {
        from_record: from_transfer,
        to_record: to_transfer
      }
    end

    before do
      from_transfer.assign_attributes(description: "Changed description")
    end

    context 'with valid parameters' do
      it 'transfers attributes successfully' do
        result = operation.call(valid_params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.description).to eq("Changed description")
        expect(updated_to_transfer.amount).to eq(Money.from_amount(100, "PHP"))
        expect(updated_to_transfer.transaction_cost).to eq(Money.from_amount(10, "PHP"))
      end

      it 'does not transfer excluded attributes' do
        result = operation.call(valid_params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.id).not_to eq(from_transfer.id)
        expect(updated_to_transfer.space_id).to eq(to_transfer.space_id)
        expect(updated_to_transfer.created_at).to eq(to_transfer.created_at)
        expect(updated_to_transfer.updated_at).to eq(to_transfer.updated_at)
      end

      it 'transfers date when from_record date changed' do
        original_from_date = from_transfer.date
        original_to_date = to_transfer.date
        new_date = Time.zone.today + 5.days
        from_transfer.assign_attributes(date: new_date)
        allow(Utils::Dates).to receive(:days_difference_normalized).and_return(5)

        result = operation.call(valid_params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.date).to eq(original_to_date + 5.days)
        expect(Utils::Dates).to have_received(:days_difference_normalized)
      end

      it 'does not transfer date when from_record date did not change' do
        original_date = to_transfer.date
        result = operation.call(valid_params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.date).to eq(original_date)
      end

      it 'updates schedule for one_time transfer' do
        result = operation.call(valid_params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.schedule).to eq({})
      end

      it 'updates schedule for repeat transfer' do
        from_transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_week")
        to_transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_month")
        allow(Utils::Recurrence).to receive(:schedule).and_return({ "interval" => 1, "frequency" => "weekly" })

        result = operation.call(valid_params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.schedule).to eq({ "interval" => 1, "frequency" => "weekly" })
      end

      it 'updates schedule for installment transfer' do
        from_transfer.assign_attributes(schedule_type: "installment")
        to_transfer.assign_attributes(schedule_type: "installment")
        # Add the installment_period method to the transfer object
        def to_transfer.installment_period
          nil
        end
        allow(Utils::Recurrence).to receive(:schedule).and_return({ "interval" => 1, "frequency" => "monthly" })

        result = operation.call(valid_params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.schedule).to eq({ "interval" => 1, "frequency" => "monthly" })
      end
    end

    context 'with invalid parameters' do
      it 'fails when from_record is not changed' do
        # Create a fresh transfer without any changes
        unchanged_transfer = create(:transfer, user:, space:, from_account:, to_account:)
        params = { from_record: unchanged_transfer, to_record: to_transfer }
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(from_record: ["must be a changed record"])
      end

      it 'fails when from_record and to_record are the same' do
        from_transfer.assign_attributes(description: "Changed")
        params = { from_record: from_transfer, to_record: from_transfer }
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(from_record: ["must be different"])
      end
    end

    context 'when operations fail' do
      it 'propagates failure from transfer_attributes' do
        allow(operation).to receive(:transfer_attributes).and_return(Failure(error: "Transfer failed"))
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates failure from transfer_date' do
        allow(operation).to receive(:transfer_date).and_return(Failure(error: "Date transfer failed"))
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates failure from update_schedule' do
        allow(operation).to receive(:update_schedule).and_return(Failure(error: "Schedule update failed"))
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end
  end

  describe 'private methods' do
    describe '#transfer_attributes' do
      let(:params) { { from_record: from_transfer, to_record: to_transfer } }

      it 'transfers all attributes except excluded ones' do
        from_transfer.assign_attributes(
          description: "New description",
          amount: Money.from_amount(200, "PHP"),
          transaction_cost: Money.from_amount(20, "PHP")
        )

        result = operation.send(:transfer_attributes, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.description).to eq("New description")
        expect(updated_to_transfer.amount).to eq(Money.from_amount(200, "PHP"))
        expect(updated_to_transfer.transaction_cost).to eq(Money.from_amount(20, "PHP"))
      end

      it 'does not transfer excluded attributes' do
        original_id = to_transfer.id
        original_space_id = to_transfer.space_id
        original_created_at = to_transfer.created_at
        original_updated_at = to_transfer.updated_at

        result = operation.send(:transfer_attributes, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.id).to eq(original_id)
        expect(updated_to_transfer.space_id).to eq(original_space_id)
        expect(updated_to_transfer.created_at).to eq(original_created_at)
        expect(updated_to_transfer.updated_at).to eq(original_updated_at)
      end

      it 'does not transfer date attribute' do
        original_date = to_transfer.date
        from_transfer.assign_attributes(date: Time.zone.today + 10.days)

        result = operation.send(:transfer_attributes, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.date).to eq(original_date)
      end
    end

    describe '#transfer_date' do
      let(:params) { { from_record: from_transfer, to_record: to_transfer } }

      it 'transfers date when from_record date changed' do
        original_from_date = from_transfer.date
        original_to_date = to_transfer.date
        new_date = Time.zone.today + 5.days
        from_transfer.assign_attributes(date: new_date)
        allow(Utils::Dates).to receive(:days_difference_normalized).and_return(5)

        result = operation.send(:transfer_date, to_record: to_transfer, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.date).to eq(original_to_date + 5.days)
      end

      it 'does not transfer date when from_record date did not change' do
        original_date = to_transfer.date
        result = operation.send(:transfer_date, to_record: to_transfer, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.date).to eq(original_date)
      end

      it 'calls Utils::Dates.days_difference_normalized with correct parameters' do
        old_date = Time.zone.today
        new_date = Time.zone.today + 3.days
        from_transfer.assign_attributes(date: new_date)
        allow(Utils::Dates).to receive(:days_difference_normalized).and_return(3)

        result = operation.send(:transfer_date, to_record: to_transfer, params: params)
        expect(result).to be_success

        expect(Utils::Dates).to have_received(:days_difference_normalized).with(
          from_date: old_date,
          to_date: new_date
        )
      end

      it 'handles negative day differences' do
        original_to_date = to_transfer.date
        new_date = Time.zone.today - 2.days
        from_transfer.assign_attributes(date: new_date)
        allow(Utils::Dates).to receive(:days_difference_normalized).and_return(-2)

        result = operation.send(:transfer_date, to_record: to_transfer, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.date).to eq(original_to_date - 2.days)
      end
    end

    describe '#update_schedule' do
      let(:params) { { from_record: from_transfer, to_record: to_transfer } }

      it 'sets empty schedule for one_time transfer' do
        to_transfer.assign_attributes(schedule_type: "one_time")
        result = operation.send(:update_schedule, to_record: to_transfer, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.schedule).to eq({})
      end

      it 'creates schedule for repeat transfer' do
        from_transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_week")
        to_transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_month")
        allow(Utils::Recurrence).to receive(:schedule).and_return({ "interval" => 1, "frequency" => "weekly" })

        result = operation.send(:update_schedule, to_record: to_transfer, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.schedule).to eq({ "interval" => 1, "frequency" => "weekly" })
      end

      it 'creates schedule for installment transfer' do
        from_transfer.assign_attributes(schedule_type: "installment")
        to_transfer.assign_attributes(schedule_type: "installment")
        # Add the installment_period method to the transfer object
        def to_transfer.installment_period
          nil
        end
        allow(Utils::Recurrence).to receive(:schedule).and_return({ "interval" => 1, "frequency" => "monthly" })

        result = operation.send(:update_schedule, to_record: to_transfer, params: params)
        expect(result).to be_success

        updated_to_transfer = result.value!
        expect(updated_to_transfer.schedule).to eq({ "interval" => 1, "frequency" => "monthly" })
      end

      it 'calls Utils::Recurrence.schedule with correct parameters for repeat transfer' do
        from_transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_week")
        to_transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_month", date: Time.zone.today + 5.days)
        allow(Utils::Recurrence).to receive(:schedule).and_return({})

        result = operation.send(:update_schedule, to_record: to_transfer, params: params)
        expect(result).to be_success

        expect(Utils::Recurrence).to have_received(:schedule).with(
          date: to_transfer.date,
          repeat_interval: "every_week",
          installment_period: nil
        )
      end

      it 'calls Utils::Recurrence.schedule with correct parameters for installment transfer' do
        from_transfer.assign_attributes(schedule_type: "installment")
        to_transfer.assign_attributes(schedule_type: "installment", date: Time.zone.today + 5.days)
        # Add the installment_period method to the transfer object
        def to_transfer.installment_period
          nil
        end
        allow(Utils::Recurrence).to receive(:schedule).and_return({})

        result = operation.send(:update_schedule, to_record: to_transfer, params: params)
        expect(result).to be_success

        expect(Utils::Recurrence).to have_received(:schedule).with(
          date: to_transfer.date,
          repeat_interval: :installment,
          installment_period: nil
        )
      end

      it 'uses :installment as repeat_interval for installment transfers' do
        from_transfer.assign_attributes(schedule_type: "installment")
        to_transfer.assign_attributes(schedule_type: "installment")
        # Add the installment_period method to the transfer object
        def to_transfer.installment_period
          nil
        end
        allow(Utils::Recurrence).to receive(:schedule).and_return({})

        result = operation.send(:update_schedule, to_record: to_transfer, params: params)
        expect(result).to be_success

        expect(Utils::Recurrence).to have_received(:schedule).with(
          date: to_transfer.date,
          repeat_interval: :installment,
          installment_period: nil
        )
      end
    end
  end
end
