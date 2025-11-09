# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Imports::ImportRecord, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:import).class_name('Imports::Import') }
  end

  describe 'enums' do
    describe 'status enum' do
      it 'defines the correct enum values' do
        expect(described_class.statuses).to eq({
          'pending' => 'pending',
          'success' => 'success',
          'failed' => 'failed',
          'edited' => 'edited'
        })
      end

      it 'provides enum query methods' do
        pending_record = build(:import_record, status: :pending)
        success_record = build(:import_record, status: :success)
        failed_record = build(:import_record, status: :failed)
        edited_record = build(:import_record, status: :edited)

        expect(pending_record.pending?).to be true
        expect(pending_record.success?).to be false

        expect(success_record.success?).to be true
        expect(success_record.pending?).to be false

        expect(failed_record.failed?).to be true
        expect(failed_record.success?).to be false

        expect(edited_record.edited?).to be true
        expect(edited_record.failed?).to be false
      end
    end
  end

  describe 'scopes' do
    let(:import) { create(:import) }

    describe '.successful' do
      it 'returns records with success status and record_id present' do
        successful_record = create(
          :import_record,
          import: import,
          status: :success,
          record_id: SecureRandom.uuid,
          record_type: 'Transactions::Transaction'
        )
        failed_record = create(
          :import_record,
          import: import,
          status: :failed
        )
        success_without_record = create(
          :import_record,
          import: import,
          status: :success,
          record_id: nil
        )

        expect(described_class.successful).to include(successful_record)
        expect(described_class.successful).not_to include(failed_record)
        expect(described_class.successful).not_to include(success_without_record)
      end
    end

    describe '.failed' do
      it 'returns records with failed or edited status' do
        failed_record = create(
          :import_record,
          import: import,
          status: :failed
        )
        edited_record = create(
          :import_record,
          import: import,
          status: :edited
        )
        success_record = create(
          :import_record,
          import: import,
          status: :success,
          record_id: SecureRandom.uuid
        )

        expect(described_class.failed).to include(failed_record, edited_record)
        expect(described_class.failed).not_to include(success_record)
      end
    end

    describe '.editable' do
      it 'returns records with failed or edited status' do
        failed_record = create(
          :import_record,
          import: import,
          status: :failed
        )
        edited_record = create(
          :import_record,
          import: import,
          status: :edited
        )
        success_record = create(
          :import_record,
          import: import,
          status: :success,
          record_id: SecureRandom.uuid
        )

        expect(described_class.editable).to include(failed_record, edited_record)
        expect(described_class.editable).not_to include(success_record)
      end
    end
  end

  describe 'instance methods' do
    let(:import) { create(:import) }

    describe '#record' do
      context 'when record_id and record_type are present' do
        let(:transaction) { create(:expense_transaction) }
        let(:import_record) do
          create(
            :import_record,
            import: import,
            record_id: transaction.id,
            record_type: 'Transactions::Transaction'
          )
        end

        it 'returns the associated record' do
          expect(import_record.record).to eq(transaction)
        end
      end

      context 'when record_id is nil' do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            record_id: nil,
            record_type: 'Transactions::Transaction'
          )
        end

        it 'returns nil' do
          expect(import_record.record).to be_nil
        end
      end

      context 'when record_type is nil' do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            record_id: SecureRandom.uuid,
            record_type: nil
          )
        end

        it 'returns nil' do
          expect(import_record.record).to be_nil
        end
      end

      context 'when both record_id and record_type are nil' do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            record_id: nil,
            record_type: nil
          )
        end

        it 'returns nil' do
          expect(import_record.record).to be_nil
        end
      end
    end

    describe '#editable?' do
      it 'returns true when status is failed' do
        import_record = create(
          :import_record,
          import: import,
          status: :failed
        )

        expect(import_record.editable?).to be true
      end

      it 'returns true when status is edited' do
        import_record = create(
          :import_record,
          import: import,
          status: :edited
        )

        expect(import_record.editable?).to be true
      end

      it 'returns false when status is pending' do
        import_record = create(
          :import_record,
          import: import,
          status: :pending
        )

        expect(import_record.editable?).to be false
      end

      it 'returns false when status is success' do
        import_record = create(
          :import_record,
          import: import,
          status: :success
        )

        expect(import_record.editable?).to be false
      end
    end

    describe '#record=' do
      let(:import_record) { create(:import_record, import: import) }
      let(:transaction) { create(:expense_transaction) }

      it 'sets record_type to the model class name' do
        import_record.record = transaction
        expect(import_record.record_type).to eq('Transactions::Expense')
      end

      it 'sets record_id to the model id' do
        import_record.record = transaction
        expect(import_record.record_id).to eq(transaction.id)
      end

      it 'sets status to success' do
        import_record.record = transaction
        expect(import_record.status).to eq('success')
      end
    end

    describe '#import_data' do
      context 'when edited_data is present' do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            original_data: { 'amount' => 50.0 },
            edited_data: { 'amount' => 100.0 }
          )
        end

        it 'returns edited_data' do
          expect(import_record.import_data).to eq({ 'amount' => 100.0 })
        end
      end

      context 'when edited_data is not present' do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            original_data: { 'amount' => 50.0 },
            edited_data: {}
          )
        end

        it 'returns original_data' do
          expect(import_record.import_data).to eq({ 'amount' => 50.0 })
        end
      end

      context 'when edited_data is nil' do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            original_data: { 'amount' => 50.0 },
            edited_data: nil
          )
        end

        it 'returns original_data' do
          expect(import_record.import_data).to eq({ 'amount' => 50.0 })
        end
      end
    end

    describe '#mark_as_edited' do
      let(:import_record) do
        create(
          :import_record,
          import: import,
          status: :failed,
          original_data: { 'amount' => 50.0 },
          edited_data: {}
        )
      end

      it 'sets edited_data to the provided data' do
        new_data = { 'amount' => 100.0, 'description' => 'Updated' }
        import_record.mark_as_edited(new_data)
        expect(import_record.edited_data).to eq(new_data)
      end

      it 'sets status to edited' do
        import_record.mark_as_edited({ 'amount' => 100.0 })
        expect(import_record.status).to eq('edited')
      end

      it 'saves the record' do
        new_data = { 'amount' => 100.0 }
        import_record.mark_as_edited(new_data)
        import_record.reload
        expect(import_record.edited_data).to eq(new_data)
        expect(import_record.status).to eq('edited')
      end
    end
  end

  describe 'factory' do
    it 'creates a valid import_record' do
      import_record = build(:import_record)
      expect(import_record).to be_valid
    end

    it 'creates an import_record with all required associations' do
      import_record = create(:import_record)
      expect(import_record.import).to be_present
      expect(import_record.row_number).to be_present
      expect(import_record.status).to be_present
    end

    context 'with different statuses' do
      it 'creates a pending import_record' do
        import_record = create(:import_record, status: :pending)
        expect(import_record).to be_pending
      end

      it 'creates a success import_record' do
        import_record = create(:import_record, :success)
        expect(import_record).to be_success
        expect(import_record.record_id).to be_present
        expect(import_record.record_type).to be_present
      end

      it 'creates a failed import_record' do
        import_record = create(:import_record, :failed)
        expect(import_record).to be_failed
        expect(import_record.import_errors).to be_present
      end

      it 'creates an edited import_record' do
        import_record = create(:import_record, :edited)
        expect(import_record).to be_edited
        expect(import_record.edited_data).to be_present
      end
    end
  end
end
