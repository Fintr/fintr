# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Imports::Import, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user).class_name("Auth::User") }
    it { is_expected.to belong_to(:space).class_name("Spaces::Space") }
    it { is_expected.to have_many(:import_records).dependent(:destroy) }
    it { is_expected.to have_one_attached(:file) }
  end

  describe 'validations' do
    subject { build(:import) }

    it { is_expected.to validate_presence_of(:import_location) }
    it { is_expected.to validate_inclusion_of(:import_location).in_array(%w[onboarding settings]) }
  end

  describe 'enums' do
    it 'defines status as an enum with string values' do
      expect(described_class.statuses).to eq(
        "pending" => "pending",
        "processing" => "processing",
        "completed" => "completed",
        "failed" => "failed",
        "reverted" => "reverted"
      )
    end

    it 'allows setting a valid status' do
      import = build(:import, status: "pending")
      expect(import).to be_valid
      expect(import.status).to eq("pending")
      expect(import).to be_pending
    end

    it 'allows setting status to processing' do
      import = build(:import, status: "processing")
      expect(import).to be_valid
      expect(import).to be_processing
    end

    it 'allows setting status to completed' do
      import = build(:import, status: "completed")
      expect(import).to be_valid
      expect(import).to be_completed
    end

    it 'allows setting status to failed' do
      import = build(:import, status: "failed")
      expect(import).to be_valid
      expect(import).to be_failed
    end

    it 'allows setting status to reverted' do
      import = build(:import, status: "reverted")
      expect(import).to be_valid
      expect(import).to be_reverted
    end
  end

  describe 'scopes' do
    describe '.recent' do
      let!(:older_import) { create(:import, created_at: 2.days.ago) }
      let!(:newer_import) { create(:import, created_at: 1.day.ago) }

      it 'returns imports ordered by created_at in descending order' do
        recent_imports = described_class.recent
        expect(recent_imports.first).to eq(newer_import)
        expect(recent_imports.last).to eq(older_import)
      end
    end

    describe '.for_space' do
      let(:space1) { create(:space) }
      let(:space2) { create(:space) }
      let!(:import1) { create(:import, space: space1) }
      let!(:import2) { create(:import, space: space2) }

      it 'returns imports for the specified space' do
        space1_imports = described_class.for_space(space1)
        expect(space1_imports).to include(import1)
        expect(space1_imports).not_to include(import2)
      end
    end
  end

  describe 'instance methods' do
    let(:import) { create(:import) }

    describe '#can_revert?' do
      context 'when import is completed with successful records' do
        let(:import) { create(:import, status: "completed") }
        let!(:successful_record) { create(:import_record, :success, import: import) }

        it 'returns true' do
          expect(import.can_revert?).to be true
        end
      end

      context 'when import is failed with successful records' do
        let(:import) { create(:import, status: "failed") }
        let!(:successful_record) { create(:import_record, :success, import: import) }

        it 'returns true' do
          expect(import.can_revert?).to be true
        end
      end

      context 'when import is completed but has no successful records' do
        let(:import) { create(:import, status: "completed") }
        let!(:failed_record) { create(:import_record, :failed, import: import) }

        it 'returns false' do
          expect(import.can_revert?).to be false
        end
      end

      context 'when import is pending' do
        let(:import) { create(:import, status: "pending") }
        let!(:successful_record) { create(:import_record, :success, import: import) }

        it 'returns false' do
          expect(import.can_revert?).to be false
        end
      end
    end

    describe '#failed_records' do
      let!(:failed_record) { create(:import_record, :failed, import: import) }
      let!(:successful_record) { create(:import_record, :success, import: import) }
      let!(:edited_record) { create(:import_record, :edited, import: import) }

      it 'returns only failed and edited records' do
        failed_records = import.failed_records
        expect(failed_records).to include(failed_record)
        expect(failed_records).to include(edited_record)
        expect(failed_records).not_to include(successful_record)
      end
    end

    describe '#successful_records' do
      let!(:failed_record) { create(:import_record, :failed, import: import) }
      let!(:successful_record) { create(:import_record, :success, import: import) }

      it 'returns only successful records' do
        successful_records = import.successful_records
        expect(successful_records).to include(successful_record)
        expect(successful_records).not_to include(failed_record)
      end
    end

    describe '#success?' do
      context 'when there are no failed records' do
        let!(:successful_record) { create(:import_record, :success, import: import) }

        it 'returns true' do
          expect(import.success?).to be true
        end
      end

      context 'when there are failed records' do
        let!(:failed_record) { create(:import_record, :failed, import: import) }

        it 'returns false' do
          expect(import.success?).to be false
        end
      end

      context 'when there are edited records' do
        let!(:edited_record) { create(:import_record, :edited, import: import) }

        it 'returns false' do
          expect(import.success?).to be false
        end
      end
    end
  end

  describe 'factory' do
    it 'creates a valid import' do
      import = build(:import)
      expect(import).to be_valid
    end

    it 'creates an import with all required attributes' do
      import = create(:import)
      expect(import.user).to be_present
      expect(import.space).to be_present
      expect(import.status).to eq("pending")
      expect(import.import_location).to be_present
    end
  end
end
