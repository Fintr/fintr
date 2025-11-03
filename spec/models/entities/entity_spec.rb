# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Entities::Entity, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
    it { is_expected.to have_many(:loans).class_name('Transactions::Loan').with_foreign_key(:entity_id).dependent(:nullify) }
  end

  describe 'validations' do
    subject { build(:entity) }

    it { is_expected.to validate_presence_of(:full_name) }
    it { is_expected.to validate_presence_of(:entity_type) }

    describe 'uniqueness of full_name scoped to space_id and entity_type' do
      let(:space) { create(:space) }

      it 'validates uniqueness of full_name within the same space and entity_type' do
        create(:entity, full_name: 'Test Entity', space: space, entity_type: 'loan')
        duplicate = build(:entity, full_name: 'Test Entity', space: space, entity_type: 'loan')
        expect(duplicate).not_to be_valid
        expect(duplicate.errors[:full_name]).to include('Already exists for this space')
      end

      it 'allows same full_name with different entity_type in the same space' do
        create(:entity, full_name: 'Test Entity', space: space, entity_type: 'loan')
        different_type = build(:entity, full_name: 'Test Entity', space: space, entity_type: 'other')
        expect(different_type).to be_valid
      end

      it 'allows same full_name with same entity_type in different space' do
        space1 = create(:space)
        space2 = create(:space)
        create(:entity, full_name: 'Test Entity', space: space1, entity_type: 'loan')
        different_space = build(:entity, full_name: 'Test Entity', space: space2, entity_type: 'loan')
        expect(different_space).to be_valid
      end
    end
  end

  describe 'scopes' do
    let(:space1) { create(:space) }
    let(:space2) { create(:space) }

    describe '.for_space' do
      it 'returns entities for the given space' do
        entity1 = create(:entity, space: space1, full_name: 'Entity One')
        entity2 = create(:entity, space: space2, full_name: 'Entity Two')
        entity3 = create(:entity, space: space1, full_name: 'Entity Three')

        result = described_class.for_space(space1)
        expect(result).to include(entity1, entity3)
        expect(result).not_to include(entity2)
      end
    end

    describe '.for_type' do
      it 'returns entities for the given entity_type' do
        loan_entity = create(:entity, entity_type: 'loan', full_name: 'Loan Entity')
        other_entity = create(:entity, entity_type: 'other', full_name: 'Other Entity')

        result = described_class.for_type('loan')
        expect(result).to include(loan_entity)
        expect(result).not_to include(other_entity)
      end
    end

    describe '.loans' do
      it 'returns only entities with entity_type "loan"' do
        loan_entity = create(:entity, entity_type: 'loan', full_name: 'Loan Entity')
        other_entity = create(:entity, entity_type: 'other', full_name: 'Other Entity')

        result = described_class.loans
        expect(result).to include(loan_entity)
        expect(result).not_to include(other_entity)
      end
    end
  end

  describe 'instance methods' do
    describe '#display_name' do
      it 'returns the full_name' do
        entity = create(:entity, full_name: 'John Doe')
        expect(entity.display_name).to eq('John Doe')
      end
    end
  end

  describe 'factory' do
    it 'creates a valid entity' do
      entity = build(:entity)
      expect(entity).to be_valid
    end

    it 'creates an entity with all required attributes' do
      entity = create(:entity)
      expect(entity.full_name).to be_present
      expect(entity.entity_type).to be_present
      expect(entity.space).to be_present
    end
  end

  describe 'associations behavior' do
    let(:space) { create(:space) }
    let(:entity) { create(:entity, space: space) }

    describe 'when entity has loans' do
      it 'prevents deletion due to not null constraint on entity_id' do
        loan = create(:loan, entity: entity, space: space)
        expect(loan.entity_id).to eq(entity.id)

        expect { entity.destroy }.to raise_error(ActiveRecord::NotNullViolation)
      end
    end

    describe 'association presence' do
      it 'can have associated loans' do
        loan = create(:loan, entity: entity, space: space)
        expect(loan).to be_persisted
        expect(entity.loans).to include(loan)
      end
    end
  end
end
